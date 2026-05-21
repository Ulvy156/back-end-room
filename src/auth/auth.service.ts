import {
  BadRequestException,
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
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private get refreshSecret(): string {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
    return secret;
  }

  private get refreshExpiresInSeconds(): number {
    return this.configService.get<number>('JWT_REFRESH_EXPIRES_IN', 604800);
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
    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: await hashingPassword(dto.password),
          role: dto.role ?? UserRole.USER,
          isVerified: false,
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

    if (!user) throw new BadRequestException(this.translation.t('errors.auth.invalid_otp'));

    if (user.isVerified) {
      throw new BadRequestException(this.translation.t('errors.auth.already_verified'));
    }

    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { userId: user.id },
    });

    if (
      !tokenRecord ||
      tokenRecord.channel !== 'verification' ||
      tokenRecord.expiresAt < new Date()
    ) {
      throw new BadRequestException(this.translation.t('errors.auth.invalid_otp'));
    }

    if (this.hashOtp(dto.otp) !== tokenRecord.otp) {
      throw new BadRequestException(this.translation.t('errors.auth.invalid_otp'));
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

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // same return path as wrong password — prevents email enumeration
    if (!user) return null;

    if (!user.isVerified) {
      throw new UnauthorizedException(this.translation.t('errors.auth.not_verified'));
    }

    if (user.isLocked) {
      throw new UnauthorizedException(this.translation.t('errors.auth.locked'));
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
      throw new UnauthorizedException(this.translation.t('errors.auth.invalid_refresh_token'));
    }

    if (!payload.jti) throw new UnauthorizedException(this.translation.t('errors.auth.invalid_refresh_token'));

    const stored = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    });

    if (
      !stored ||
      stored.userId !== payload.sub ||
      stored.expiresAt < new Date()
    ) {
      throw new UnauthorizedException(this.translation.t('errors.auth.invalid_refresh_token'));
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
      throw new UnauthorizedException(this.translation.t('errors.auth.invalid_telegram'));
    }

    // 2. Reject stale auth_date (must be within 24 hours)
    const authDate = new Date(data.auth_date * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (authDate < oneDayAgo) {
      throw new UnauthorizedException(this.translation.t('errors.auth.telegram_expired'));
    }

    // 3. Look up user by their Telegram ID stored in the Phone table
    const phone = await this.prisma.phone.findFirst({
      where: {
        phoneNumber: String(data.id),
        type: PhoneNumberType.TELEGRAM,
      },
      include: { user: true },
    });

    if (!phone) {
      throw new UnauthorizedException(this.translation.t('errors.auth.no_telegram_linked'));
    }

    if (!phone.user.isVerified) {
      throw new UnauthorizedException(this.translation.t('errors.auth.not_verified'));
    }

    if (phone.user.isLocked) {
      throw new UnauthorizedException(this.translation.t('errors.auth.locked'));
    }

    return phone.user;
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
        throw new BadRequestException(this.translation.t('errors.auth.no_telegram_on_user'));
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

    if (!user) throw new BadRequestException(this.translation.t('errors.auth.invalid_otp'));

    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { userId: user.id },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException(this.translation.t('errors.auth.invalid_otp'));
    }

    if (this.hashOtp(otp) !== tokenRecord.otp) {
      throw new BadRequestException(this.translation.t('errors.auth.invalid_otp'));
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
}
