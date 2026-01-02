import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Res,
  Req,
  Get,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // =======================
  // Public: login user
  // =======================
  @Public()
  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Unauthorized');

    // generate tokens using service
    const { accessToken, refreshToken } = this.authService.login({
      id: user.id,
      role: user.role,
    });

    // set refresh token in HttpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false, // no HTTPS on local
      sameSite: 'lax', // allow cross-site from localhost:5173 → localhost:3000
      path: '/', //  make cookie available globally
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // return only access token
    return { accessToken, user_id: user.id };
  }

  @Public()
  @Post('refresh-token')
  refreshTokens(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken: string = (req.cookies as Record<string, string>)
      ?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const tokens = this.authService.refreshTokens(refreshToken);

    // optional: reset the cookie if you’re rotating refresh tokens
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: false, // no HTTPS on local
      sameSite: 'lax', //vallow cross-site from localhost:5173 → localhost:3000
      path: '/', // make cookie available globally
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return { accessToken: tokens.accessToken };
  }

  @Get('profile')
  getProfile(@Req() req: AuthenticatedRequest) {
    // req.user is set by the JwtStrategy
    return req.user;
  }
}
