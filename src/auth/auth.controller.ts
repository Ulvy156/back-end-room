import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Res,
  Req,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { TelegramLoginDto } from './dto/telegram-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
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
  constructor(private authService: AuthService) {}

  // ─── Login ───────────────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

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
      message:
        'Account created. Please check your email for the OTP to verify your account.',
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

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as Record<string, string>)?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    const tokens = await this.authService.refreshTokens(refreshToken);

    res.cookie('refresh_token', tokens.refreshToken, cookieOptions);
    return { accessToken: tokens.accessToken };
  }

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
    const user = await this.authService.telegramLogin(dto);

    const { accessToken, refreshToken } = await this.authService.login({
      id: user.id,
      role: user.role,
    });

    res.cookie('refresh_token', refreshToken, cookieOptions);
    return { accessToken, user_id: user.id };
  }

  // ─── Password reset ───────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 requests per 15 min
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email, dto.channel);
    return {
      message: 'If an account with that email exists, an OTP has been sent',
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.email, dto.otp, dto.newPassword);
    return { message: 'Password reset successfully. Please log in again.' };
  }
}
