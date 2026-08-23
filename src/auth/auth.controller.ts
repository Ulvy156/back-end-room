import {
  Controller,
  Post,
  Patch,
  Body,
  UnauthorizedException,
  HttpException,
  Res,
  Req,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { GoogleUser } from './google.strategy';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { TelegramLoginDto } from './dto/telegram-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SelectRoleDto } from './dto/select-role.dto';
import { Throttle } from '@nestjs/throttler';
import { TranslationService } from '../i18n/translation.service';
import { SkipAudit } from '../audit-log/skip-audit.decorator';
import { BypassMaintenance } from '../settings/bypass-maintenance.decorator';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
}

interface GoogleAuthenticatedRequest extends Request {
  user: GoogleUser;
}

// Shared registrable domain (e.g. .rokpteah.com) so cookies set here
// (api.rokpteah.com) are also sent on requests to the frontend's own domain
// (rokpteah.com). Unset in local dev, where host-only cookies are fine.
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  domain: cookieDomain,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Mirrors cookieOptions but for the short-lived access token — kept out of
// response bodies/URLs so frontend JS never has a copy of it to leak via XSS.
const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  domain: cookieDomain,
  maxAge: parseInt(process.env.JWT_EXPIRES_IN ?? '900', 10) * 1000,
};

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly translation: TranslationService,
    private readonly config: ConfigService,
  ) {}

  // ─── Login ───────────────────────────────────────────────────────────────────

  @Public()
  @BypassMaintenance()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 attempts per min — brute force protection
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(
      dto.identifier,
      dto.password,
    );
    if (!user)
      throw new UnauthorizedException(
        this.translation.t('errors.auth.invalid_credentials'),
      );

    const { accessToken, refreshToken } = await this.authService.login({
      id: user.id,
      role: user.role,
    });

    res.cookie('refresh_token', refreshToken, cookieOptions);
    res.cookie('access_token', accessToken, accessCookieOptions);
    return { accessToken, user_id: user.id };
  }

  // ─── Register ────────────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 12, ttl: 60000 } }) // 12 per min — prevents OTP email spam
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      message: this.translation.t('messages.auth.account_created'),
      user_id: result?.userId,
    };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('verify-account')
  @HttpCode(HttpStatus.OK)
  async verifyAccount(
    @Body() dto: VerifyAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, userId } =
      await this.authService.verifyAccount(dto);

    res.cookie('refresh_token', refreshToken, cookieOptions);
    res.cookie('access_token', accessToken, accessCookieOptions);
    return { accessToken, user_id: userId };
  }

  @Public()
  @Throttle({ default: { limit: 12, ttl: 60000 } }) // 12 per min — prevents OTP email spam
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto) {
    await this.authService.resendOtp(dto.email);
    return { message: this.translation.t('messages.auth.otp_sent') };
  }

  // ─── Token management ────────────────────────────────────────────────────────

  @SkipAudit()
  @Public()
  @BypassMaintenance()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as Record<string, string>)?.refresh_token;

    if (!refreshToken)
      throw new UnauthorizedException(
        this.translation.t('errors.auth.missing_refresh_token'),
      );

    const tokens = await this.authService.refreshTokens(refreshToken);

    res.cookie('refresh_token', tokens.refreshToken, cookieOptions);
    res.cookie('access_token', tokens.accessToken, accessCookieOptions);
    return { accessToken: tokens.accessToken };
  }

  @SkipAudit()
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req.cookies as Record<string, string>)?.refresh_token;
    await this.authService.logout(refreshToken);
    res.clearCookie('refresh_token', { path: '/', domain: cookieDomain });
    res.clearCookie('access_token', { path: '/', domain: cookieDomain });
  }

  // ─── Profile ─────────────────────────────────────────────────────────────────

  @Get('profile')
  getProfile(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  // ─── Telegram login ──────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 attempts per min
  @Post('telegram-login')
  @HttpCode(HttpStatus.OK)
  async telegramLogin(
    @Body() dto: TelegramLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, isNewUser } = await this.authService.telegramLogin(dto);

    const { accessToken, refreshToken } = await this.authService.login({
      id: user.id,
      role: user.role,
    });

    res.cookie('refresh_token', refreshToken, cookieOptions);
    res.cookie('access_token', accessToken, accessCookieOptions);
    // Same shape as GET /auth/profile (Prisma User minus password) — lets
    // callers skip the follow-up profile fetch after this login.
    const { password, ...safeUser } = user;
    return {
      accessToken,
      user_id: user.id,
      is_new_user: isNewUser,
      user: safeUser,
    };
  }

  // ─── Password reset ───────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 12, ttl: 60000 } }) // 12 requests per min
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return {
      message: this.translation.t('messages.auth.otp_sent'),
    };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 attempts per min
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(
      { email: dto.email, telegramId: dto.telegramId },
      dto.otp,
      dto.newPassword,
    );
    return { message: this.translation.t('messages.auth.password_reset') };
  }

  // [USER] Change own password — requires current password to be correct
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 attempts per min
  @Patch('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.authService.changePassword(
      req.user!.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ─── Select role ─────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 attempts per min
  @Patch('select-role')
  @HttpCode(HttpStatus.NO_CONTENT)
  async selectRole(
    @Body() dto: SelectRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.authService.selectRole(req.user!.id, dto);
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────────

  // Redirects the user to Google's consent screen — no body, no response
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  // Google redirects here after the user approves — issues tokens and redirects to frontend
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: GoogleAuthenticatedRequest,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.getOrThrow<string>('FRONT_END_URL');
    try {
      const { accessToken, refreshToken, isNewUser } =
        await this.authService.googleLogin(req.user);
      res.cookie('refresh_token', refreshToken, cookieOptions);
      res.cookie('access_token', accessToken, accessCookieOptions);
      // No token in the URL — it would sit in browser history and any
      // server/CDN access logs along the redirect chain. The cookies set
      // above are enough for the frontend to pick up the session.
      res.redirect(`${frontendUrl}/auth/callback?is_new_user=${isNewUser}`);
    } catch (error) {
      // This is a full-page redirect from Google, not a fetch/XHR — if we
      // let the exception filter write its usual JSON body here, the
      // browser would strand mid-navigation on an unreadable error page
      // instead of landing back in the app. Surface the failure as a query
      // param on the same frontend callback route instead.
      if (!(error instanceof HttpException)) throw error;
      const body = error.getResponse();
      const code =
        typeof body === 'object' && body !== null && 'code' in body
          ? String(body.code)
          : 'login_failed';
      res.redirect(`${frontendUrl}/auth/callback?error=${code}`);
    }
  }
}
