import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, createHmac, randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UserRole, PhoneNumberType } from 'prisma/generated/enums';
import { TelegramLoginDto } from './dto/telegram-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { QueueService } from '../queue/queue.service';
import {
  QUEUE_JOBS,
  SendOtpEmailJob,
  SendOtpTelegramJob,
  SendUserRegisteredAdminAlertJob,
  SendVerificationOtpJob,
} from '../queue/queue.jobs';
import { hashingPassword } from '../utils/hashingPassword';
import { prismaError } from '../utils/prismaError';
import { Prisma } from 'prisma/generated/client';
import { RegisterDto } from './dto/register.dto';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { TranslationService } from '../i18n/translation.service';
import { SettingsService } from '../settings/settings.service';
import { R2Service } from 'src/R2/r2.service';

interface JwtAccessPayload {
  sub: string;
  role: UserRole;
}

interface JwtRefreshPayload extends JwtAccessPayload {
  jti: string;
}

interface LoginUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly queue: QueueService,
    private readonly translation: TranslationService,
    private readonly settingsService: SettingsService,
    private readonly r2Service: R2Service,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private get refreshSecret(): string {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
    return secret;
  }

  private get refreshExpiresInSeconds(): number {
    return parseInt(
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
      10,
    );
  }

  // Window during which a jti that just lost a rotation race is still
  // honored — long enough to cover concurrent requests firing within the
  // same access-token-expiry event, short enough not to meaningfully weaken
  // single-use rotation.
  private readonly refreshGraceMs = 10_000;

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  private async storeOtp(userId: string, otp: string, channel: string) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.passwordResetToken.upsert({
      where: { userId },
      create: { userId, otp: this.hashOtp(otp), channel, expiresAt },
      update: { otp: this.hashOtp(otp), channel, expiresAt },
    });
  }

  private async sendVerificationOtp(userId: string, email: string) {
    const otp = this.generateOtp();
    await this.storeOtp(userId, otp, 'verification');
    await this.queue.send<SendVerificationOtpJob>(
      QUEUE_JOBS.SEND_VERIFICATION_OTP,
      { to: email, otp },
      { retryLimit: 3, retryDelay: 30, retryBackoff: true },
    );
  }

  // ─── Register ───────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const registrationEnabled = await this.settingsService.get<boolean>(
      'auth',
      'registrationEnabled',
    );
    if (!registrationEnabled) {
      throw new ForbiddenException(
        this.translation.t('errors.auth.registration_disabled'),
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      if (existing.isVerified) {
        throw new ConflictException(
          this.translation.t('errors.auth.already_verified'),
        );
      }

      // Account exists but never completed OTP verification — resend the
      // code instead of failing, so the user can pick up where they left off.
      await this.sendVerificationOtp(existing.id, dto.email);
      return { userId: existing.id };
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: await hashingPassword(dto.password),
          role: dto.role ?? UserRole.USER,
          isVerified: false,
          ...(dto.phone
            ? {
                phones: {
                  create: {
                    phoneNumber: dto.phone,
                    type: PhoneNumberType.PHONE,
                  },
                },
              }
            : {}),
        },
      });

      await this.sendVerificationOtp(user.id, dto.email);

      return { userId: user.id };
    } catch (error) {
      prismaError(error);
    }
  }

  async verifyAccount(dto: VerifyAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user)
      throw new BadRequestException(
        this.translation.t('errors.auth.invalid_otp'),
      );

    if (user.isVerified) {
      throw new BadRequestException(
        this.translation.t('errors.auth.already_verified'),
      );
    }

    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { userId: user.id },
    });

    if (
      !tokenRecord ||
      tokenRecord.channel !== 'verification' ||
      tokenRecord.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        this.translation.t('errors.auth.invalid_otp'),
      );
    }

    if (this.hashOtp(dto.otp) !== tokenRecord.otp) {
      throw new BadRequestException(
        this.translation.t('errors.auth.invalid_otp'),
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      }),
      this.prisma.passwordResetToken.delete({ where: { userId: user.id } }),
    ]);

    await this.queue.send<SendUserRegisteredAdminAlertJob>(
      QUEUE_JOBS.SEND_USER_REGISTERED_ADMIN_ALERT,
      { userId: user.id, name: user.name, email: user.email, source: 'otp' },
    );

    const { accessToken, refreshToken } = await this.login({
      id: user.id,
      role: user.role,
    });

    return { accessToken, refreshToken, userId: user.id };
  }

  async resendOtp(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Silent no-op — do not reveal whether the email exists, is already
    // verified, or is locked (enumeration-safe, mirrors forgotPassword()).
    if (!user || user.isLocked || user.isVerified) return;

    await this.sendVerificationOtp(user.id, email);
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  async validateUser(identifier: string, password: string) {
    // Leading '@' is the Telegram-handle convention — checked first so it
    // doesn't fall into the plain email branch below.
    const user = await (identifier.startsWith('@')
      ? this.prisma.user.findUnique({
          where: { telegramUsername: identifier.slice(1) },
        })
      : identifier.includes('@')
        ? this.prisma.user.findUnique({ where: { email: identifier } })
        : this.prisma.phone
            .findFirst({
              where: { phoneNumber: identifier, type: PhoneNumberType.PHONE },
              include: { user: true },
            })
            .then((p) => p?.user ?? null));

    // same return path as wrong password — prevents enumeration
    if (!user) return null;

    if (!user.isVerified) {
      // 403 so the frontend can distinguish this from wrong credentials (401)
      throw new ForbiddenException(
        this.translation.t('errors.auth.not_verified'),
      );
    }

    if (user.isLocked) {
      // 403 — identity is known but access is blocked
      throw new ForbiddenException(this.translation.t('errors.auth.locked'));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    const { password: _, ...result } = user;
    return result;
  }

  // ─── Token management ───────────────────────────────────────────────────────

  async login(user: LoginUser) {
    const accessPayload: JwtAccessPayload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(accessPayload);

    const jti = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { ...accessPayload, jti } satisfies JwtRefreshPayload,
      { secret: this.refreshSecret, expiresIn: this.refreshExpiresInSeconds },
    );

    const expiresAt = new Date(
      Date.now() + this.refreshExpiresInSeconds * 1000,
    );
    await this.prisma.refreshToken.create({
      data: { jti, userId: user.id, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(token: string) {
    let payload: JwtRefreshPayload;
    try {
      payload = this.jwtService.verify<JwtRefreshPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException(
        this.translation.t('errors.auth.invalid_refresh_token'),
      );
    }

    if (!payload.jti)
      throw new UnauthorizedException(
        this.translation.t('errors.auth.invalid_refresh_token'),
      );

    const stored = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    });

    if (
      stored &&
      stored.userId === payload.sub &&
      stored.expiresAt >= new Date()
    ) {
      const newJti = randomUUID();
      const expiresAt = new Date(
        Date.now() + this.refreshExpiresInSeconds * 1000,
      );

      const [newAccessToken, newRefreshToken] = await Promise.all([
        Promise.resolve(
          this.jwtService.sign({ sub: payload.sub, role: payload.role }),
        ),
        this.jwtService.signAsync(
          { sub: payload.sub, role: payload.role, jti: newJti },
          {
            secret: this.refreshSecret,
            expiresIn: this.refreshExpiresInSeconds,
          },
        ),
      ]);

      try {
        await this.prisma.refreshToken.update({
          where: { jti: payload.jti },
          data: {
            jti: newJti,
            expiresAt,
            previousJti: payload.jti,
            previousJtiExpiresAt: new Date(Date.now() + this.refreshGraceMs),
          },
        });

        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
      } catch (error) {
        // Lost a rotation race between the findUnique above and this update:
        // a concurrent refresh call already rotated this jti out from under
        // us. Fall through to the "already rotated" handling below instead
        // of surfacing a 500.
        const isMissingRecord =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025';
        if (!isMissingRecord) throw error;
      }
    }

    // Lost a rotation race: this jti was valid moments ago but a concurrent
    // refresh call already rotated it. If we're inside that rotation's grace
    // window, replay tokens for the jti it was rotated into instead of
    // rejecting a legitimate, merely-late request.
    const rotated = await this.prisma.refreshToken.findFirst({
      where: {
        previousJti: payload.jti,
        userId: payload.sub,
        previousJtiExpiresAt: { gt: new Date() },
      },
    });

    if (!rotated)
      throw new UnauthorizedException(
        this.translation.t('errors.auth.invalid_refresh_token'),
      );

    const [accessToken, refreshToken] = await Promise.all([
      Promise.resolve(
        this.jwtService.sign({ sub: payload.sub, role: payload.role }),
      ),
      this.jwtService.signAsync(
        { sub: payload.sub, role: payload.role, jti: rotated.jti },
        { secret: this.refreshSecret, expiresIn: this.refreshExpiresInSeconds },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  async logout(token: string | undefined) {
    if (!token) return;
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(token, {
        secret: this.refreshSecret,
      });
      if (payload.jti) {
        await this.prisma.refreshToken.deleteMany({
          where: { jti: payload.jti },
        });
      }
    } catch {
      // token already invalid — nothing to revoke
    }
  }

  // ─── Telegram login ──────────────────────────────────────────────────────────

  private verifyTelegramHash(data: TelegramLoginDto): boolean {
    const botToken = this.configService.get<string>('TG_BOT_TOKEN');
    if (!botToken) throw new Error('TG_BOT_TOKEN is not set');

    const { hash, ...fields } = data;

    // Build the data-check-string: sorted key=value pairs joined by \n
    const dataCheckString = Object.keys(fields)
      .sort()
      .filter((k) => fields[k as keyof typeof fields] !== undefined)
      .map((k) => `${k}=${fields[k as keyof typeof fields]}`)
      .join('\n');

    // Secret key = SHA-256 of the bot token (raw bytes, not hex)
    const secretKey = createHash('sha256').update(botToken).digest();

    const expectedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return expectedHash === hash;
  }

  async telegramLogin(data: TelegramLoginDto) {
    // 1. Verify Telegram signature
    if (!this.verifyTelegramHash(data)) {
      throw new UnauthorizedException(
        this.translation.t('errors.auth.invalid_telegram'),
      );
    }

    // 2. Reject stale auth_date (must be within 24 hours)
    const authDate = new Date(data.auth_date * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (authDate < oneDayAgo) {
      throw new UnauthorizedException(
        this.translation.t('errors.auth.telegram_expired'),
      );
    }

    // 3. Look up or auto-create user via Telegram ID
    const phone = await this.prisma.phone.findFirst({
      where: { phoneNumber: String(data.id), type: PhoneNumberType.TELEGRAM },
      include: { user: true },
    });

    let isNewUser = false;
    let user: Awaited<ReturnType<typeof this.prisma.user.create>>;

    if (phone) {
      user = phone.user;

      // Keep the stored @handle in sync — Telegram usernames can change,
      // and a stale one would silently break username-based login.
      const latestUsername = data.username ?? null;
      if (user.telegramUsername !== latestUsername) {
        try {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { telegramUsername: latestUsername },
          });
        } catch {
          // Another account already claimed this @handle (Telegram allows
          // reassignment after release) — not worth failing login over.
        }
      }
    } else {
      const registrationEnabled = await this.settingsService.get<boolean>(
        'auth',
        'registrationEnabled',
      );
      if (!registrationEnabled) {
        throw new ForbiddenException(
          this.translation.t('errors.auth.registration_disabled'),
        );
      }

      // First time — auto-register, Telegram has already verified their identity
      isNewUser = true;
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ');

      // Best-effort: pull their Telegram avatar into our own R2 bucket so
      // imgUrl stays a same-shape R2 key. A fetch failure shouldn't block
      // registration — they can always set a photo manually afterwards.
      let imgUrl: string | undefined;
      if (data.photo_url) {
        try {
          const uploaded = await this.r2Service.uploadFromUrl(
            data.photo_url,
            'profile',
          );
          imgUrl = uploaded.key;
        } catch (error) {
          this.logger.warn(
            `Failed to import Telegram profile photo for id=${data.id}: ${error}`,
          );
        }
      }

      user = await this.prisma.user.create({
        data: {
          name,
          email: null,
          telegramUsername: data.username ?? null,
          imgUrl,
          password: await hashingPassword(randomUUID()),
          hasPassword: false,
          role: UserRole.USER,
          isVerified: true,
          phones: {
            create: {
              phoneNumber: String(data.id),
              type: PhoneNumberType.TELEGRAM,
            },
          },
        },
      });
    }

    if (user.isLocked) {
      throw new ForbiddenException(this.translation.t('errors.auth.locked'));
    }

    if (isNewUser) {
      await this.queue.send<SendUserRegisteredAdminAlertJob>(
        QUEUE_JOBS.SEND_USER_REGISTERED_ADMIN_ALERT,
        {
          userId: user.id,
          name: user.name,
          email: user.email,
          source: 'telegram',
        },
      );
    }

    return { user, isNewUser };
  }

  // ─── Password reset ──────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const otp = this.generateOtp();

    if (dto.channel === 'telegram') {
      const telegram = dto.telegram!;
      if (!this.verifyTelegramHash(telegram)) {
        throw new UnauthorizedException(
          this.translation.t('errors.auth.invalid_telegram'),
        );
      }
      const authDate = new Date(telegram.auth_date * 1000);
      if (authDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
        throw new UnauthorizedException(
          this.translation.t('errors.auth.telegram_expired'),
        );
      }

      // The Telegram widget hash already proves the requester controls this
      // Telegram account, so a missing match is treated the same as a
      // not-found/unverified/locked account below — silent, no enumeration.
      const phone = await this.prisma.phone.findFirst({
        where: {
          phoneNumber: String(telegram.id),
          type: PhoneNumberType.TELEGRAM,
        },
        include: { user: true },
      });
      const user = phone?.user;
      if (!user || user.isLocked || !user.isVerified) return;

      await this.storeOtp(user.id, otp, dto.channel);
      await this.queue.send<SendOtpTelegramJob>(
        QUEUE_JOBS.SEND_OTP_TELEGRAM,
        { chatId: phone.phoneNumber, otp },
        { retryLimit: 3, retryDelay: 30, retryBackoff: true },
      );
    } else {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      // Silent return — do not reveal whether the email exists or is unverified
      if (!user || user.isLocked || !user.isVerified) return;

      await this.storeOtp(user.id, otp, dto.channel);
      await this.queue.send<SendOtpEmailJob>(
        QUEUE_JOBS.SEND_OTP_EMAIL,
        { to: dto.email!, otp },
        { retryLimit: 3, retryDelay: 30, retryBackoff: true },
      );
    }
  }

  async resetPassword(
    identifier: { email?: string; telegramId?: number },
    otp: string,
    newPassword: string,
  ) {
    const user = identifier.email
      ? await this.prisma.user.findUnique({
          where: { email: identifier.email },
        })
      : (
          await this.prisma.phone.findFirst({
            where: {
              phoneNumber: String(identifier.telegramId),
              type: PhoneNumberType.TELEGRAM,
            },
            include: { user: true },
          })
        )?.user;

    if (!user)
      throw new BadRequestException(
        this.translation.t('errors.auth.invalid_otp'),
      );

    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { userId: user.id },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException(
        this.translation.t('errors.auth.invalid_otp'),
      );
    }

    if (this.hashOtp(otp) !== tokenRecord.otp) {
      throw new BadRequestException(
        this.translation.t('errors.auth.invalid_otp'),
      );
    }

    const hashed = await hashingPassword(newPassword);

    // Update password, remove OTP record, and invalidate all sessions atomically
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, hasPassword: true },
      }),
      this.prisma.passwordResetToken.delete({ where: { userId: user.id } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);
  }

  // ─── Select role ─────────────────────────────────────────────────────────────

  async selectRole(userId: string, role: UserRole, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.hasPassword) {
      throw new BadRequestException(
        this.translation.t('errors.auth.password_already_set'),
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        role,
        password: await hashingPassword(password),
        hasPassword: true,
      },
    });
  }

  // ─── Change password ─────────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid)
      throw new BadRequestException(
        this.translation.t('errors.auth.wrong_current_password'),
      );
    const hashed = await hashingPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────────

  async googleLogin(googleUser: {
    email: string;
    name: string;
    photoUrl?: string;
  }) {
    let isNewUser = false;
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      const registrationEnabled = await this.settingsService.get<boolean>(
        'auth',
        'registrationEnabled',
      );
      if (!registrationEnabled) {
        throw new ForbiddenException(
          this.translation.t('errors.auth.registration_disabled'),
        );
      }

      isNewUser = true;

      // Best-effort: pull their Google avatar into our own R2 bucket so
      // imgUrl stays a same-shape R2 key. A fetch failure shouldn't block
      // registration — they can always set a photo manually afterwards.
      let imgUrl: string | undefined;
      if (googleUser.photoUrl) {
        try {
          const uploaded = await this.r2Service.uploadFromUrl(
            googleUser.photoUrl,
            'profile',
          );
          imgUrl = uploaded.key;
        } catch (error) {
          this.logger.warn(
            `Failed to import Google profile photo for ${googleUser.email}: ${error}`,
          );
        }
      }

      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          imgUrl,
          // Random hash — Google users have no usable password until they set one via select-role
          password: await hashingPassword(randomUUID()),
          hasPassword: false,
          role: UserRole.USER,
          isVerified: true,
        },
      });
    } else if (!user.isVerified) {
      // Existing unverified email account — Google has proven ownership of this
      // email, but whoever created the account originally chose its password,
      // so it can't be trusted (pre-account-takeover: an attacker registers a
      // dangling unverified account with the victim's email, then waits for
      // the victim to "claim" it via Google and inherits access via the
      // password only the attacker knows). Reset the password and drop any
      // pending verification OTP so only this Google sign-in can access it.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          password: await hashingPassword(randomUUID()),
          hasPassword: false,
        },
      });
      await this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });
    }

    if (user.isLocked) {
      throw new ForbiddenException(this.translation.t('errors.auth.locked'));
    }

    if (isNewUser) {
      await this.queue.send<SendUserRegisteredAdminAlertJob>(
        QUEUE_JOBS.SEND_USER_REGISTERED_ADMIN_ALERT,
        {
          userId: user.id,
          name: user.name,
          email: user.email,
          source: 'google',
        },
      );
    }

    const tokens = await this.login({ id: user.id, role: user.role });
    return { ...tokens, isNewUser };
  }
}
