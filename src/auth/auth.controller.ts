import {
  Controller,
  Post,
  Patch,
  Body,
  UnauthorizedException,
  Res,
  Req,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
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

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly translation: TranslationService,
    private readonly config: ConfigService,
  ) {}

  // ─── Login ───────────────────────────────────────────────────────────────────

  @Public()
  @BypassMaintenance()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min
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
    return { accessToken, user_id: user.id };
  }

  // ─── Register ────────────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 per 15 min — prevents OTP email spam
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
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('verify-account')
  @HttpCode(HttpStatus.OK)
  async verifyAccount(
    @Body() dto: VerifyAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, userId } =
      await this.authService.verifyAccount(dto);

    res.cookie('refresh_token', refreshToken, cookieOptions);
    return { accessToken, user_id: userId };
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
    return { accessToken: tokens.accessToken };
  }

  @SkipAudit()
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req.cookies as Record<string, string>)?.refresh_token;
    await this.authService.logout(refreshToken);
    res.clearCookie('refresh_token', { path: '/' });
  }

  // ─── Profile ─────────────────────────────────────────────────────────────────

  @Get('profile')
  getProfile(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  // ─── Telegram login ──────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min
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
    return { accessToken, user_id: user.id, is_new_user: isNewUser };
  }

  // ─── Password reset ───────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 requests per 15 min
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email, dto.channel);
    return {
      message: this.translation.t('messages.auth.otp_sent'),
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.email, dto.otp, dto.newPassword);
    return { message: this.translation.t('messages.auth.password_reset') };
  }

  // [USER] Change own password — requires current password to be correct
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min
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

  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min
  @Patch('select-role')
  @HttpCode(HttpStatus.NO_CONTENT)
  async selectRole(
    @Body() dto: SelectRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.authService.selectRole(req.user!.id, dto.role);
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
    const { accessToken, refreshToken, isNewUser } =
      await this.authService.googleLogin(req.user);
    res.cookie('refresh_token', refreshToken, cookieOptions);
    const frontendUrl = this.config.getOrThrow<string>('FRONT_END_URL');
    res.redirect(
      `${frontendUrl}/auth/callback?token=${accessToken}&is_new_user=${isNewUser}`,
    );
  }
}
