import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, createHmac, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UserRole, PhoneNumberType } from 'prisma/generated/enums';
import { TelegramLoginDto } from './dto/telegram-login.dto';
import { QueueService } from '../queue/queue.service';
import {
  QUEUE_JOBS,
  SendOtpEmailJob,
  SendOtpTelegramJob,
  SendVerificationOtpJob,
} from '../queue/queue.jobs';
import { hashingPassword } from '../utils/hashingPassword';
import { prismaError } from '../utils/prismaError';
import { RegisterDto } from './dto/register.dto';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { TranslationService } from '../i18n/translation.service';
import { SettingsService } from '../settings/settings.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly queue: QueueService,
    private readonly translation: TranslationService,
    private readonly settingsService: SettingsService,
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

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

  // ─── Register ───────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const settings = await this.settingsService.getSettings();
    if (!settings.registrationEnabled) {
      throw new ForbiddenException(
        this.translation.t('errors.auth.registration_disabled'),
      );
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

      // Send verification OTP to email
      const otp = this.generateOtp();
      await this.storeOtp(user.id, otp, 'verification');
      await this.queue.send<SendVerificationOtpJob>(
        QUEUE_JOBS.SEND_VERIFICATION_OTP,
        { to: dto.email, otp },
        { retryLimit: 3, retryDelay: 30, retryBackoff: true },
      );

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

    const { accessToken, refreshToken } = await this.login({
      id: user.id,
      role: user.role,
    });

    return { accessToken, refreshToken, userId: user.id };
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  async validateUser(identifier: string, password: string) {
    const user = await (identifier.includes('@')
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
      !stored ||
      stored.userId !== payload.sub ||
      stored.expiresAt < new Date()
    ) {
      throw new UnauthorizedException(
        this.translation.t('errors.auth.invalid_refresh_token'),
      );
    }

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
        { secret: this.refreshSecret, expiresIn: this.refreshExpiresInSeconds },
      ),
    ]);

    await this.prisma.refreshToken.update({
      where: { jti: payload.jti },
      data: { jti: newJti, expiresAt },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
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

    if (!phone) {
      const settings = await this.settingsService.getSettings();
      if (!settings.registrationEnabled) {
        throw new ForbiddenException(
          this.translation.t('errors.auth.registration_disabled'),
        );
      }

      // First time — auto-register, Telegram has already verified their identity
      isNewUser = true;
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ');
      user = await this.prisma.user.create({
        data: {
          name,
          // Synthetic email — Telegram users have no email until they set one
          email: `tg_${data.id}@telegram.placeholder`,
          password: await hashingPassword(randomUUID()),
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
    } else {
      user = phone.user;
    }

    if (user.isLocked) {
      throw new ForbiddenException(this.translation.t('errors.auth.locked'));
    }

    return { user, isNewUser };
  }

  // ─── Password reset ──────────────────────────────────────────────────────────

  async forgotPassword(email: string, channel: 'telegram' | 'email') {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { phones: true },
    });

    // Silent return — do not reveal whether the email exists or is unverified
    if (!user || user.isLocked || !user.isVerified) return;

    const otp = this.generateOtp();

    if (channel === 'telegram') {
      const telegramPhone = user.phones.find(
        (p) => p.type === PhoneNumberType.TELEGRAM,
      );
      if (!telegramPhone) {
        throw new BadRequestException(
          this.translation.t('errors.auth.no_telegram_on_user'),
        );
      }
      await this.storeOtp(user.id, otp, channel);
      await this.queue.send<SendOtpTelegramJob>(
        QUEUE_JOBS.SEND_OTP_TELEGRAM,
        { chatId: telegramPhone.phoneNumber, otp },
        { retryLimit: 3, retryDelay: 30, retryBackoff: true },
      );
    } else {
      await this.storeOtp(user.id, otp, channel);
      await this.queue.send<SendOtpEmailJob>(
        QUEUE_JOBS.SEND_OTP_EMAIL,
        { to: email, otp },
        { retryLimit: 3, retryDelay: 30, retryBackoff: true },
      );
    }
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

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
        data: { password: hashed },
      }),
      this.prisma.passwordResetToken.delete({ where: { userId: user.id } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);
  }

  // ─── Select role ─────────────────────────────────────────────────────────────

  async selectRole(userId: string, role: UserRole) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { role },
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

  async googleLogin(googleUser: { email: string; name: string }) {
    let isNewUser = false;
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      const settings = await this.settingsService.getSettings();
      if (!settings.registrationEnabled) {
        throw new ForbiddenException(
          this.translation.t('errors.auth.registration_disabled'),
        );
      }

      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          // Random hash — Google users have no usable password until they set one via forgot-password
          password: await hashingPassword(randomUUID()),
          role: UserRole.USER,
          isVerified: true,
        },
      });
    } else if (!user.isVerified) {
      // Existing unverified email account — Google has confirmed the email, mark as verified
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    if (user.isLocked) {
      throw new ForbiddenException(this.translation.t('errors.auth.locked'));
    }

    const tokens = await this.login({ id: user.id, role: user.role });
    return { ...tokens, isNewUser };
  }
}
