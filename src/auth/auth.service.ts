import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from 'generated/prisma/enums';
import { ConfigService } from '@nestjs/config';

/**
 * Payload stored INSIDE JWT
 * (this is NOT your DB user)
 */
interface JwtTokenPayload {
  sub: string; // userId
  role: UserRole;
}

/**
 * Minimal user data used for login
 */
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
  ) {}

  /**
   * Validate email + password (local login)
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    // remove password before returning
    user.password = '';
    return user;
  }

  /**
   * Issue access + refresh tokens
   */
  login(user: LoginUser) {
    const payload: JwtTokenPayload = {
      sub: user.id,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(payload);

    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh tokens using refresh token
   */
  refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtTokenPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET!,
      });

      const newPayload: JwtTokenPayload = {
        sub: payload.sub,
        role: payload.role,
      };

      const newAccessToken = this.generateAccessToken(newPayload);

      const newRefreshToken = this.generateRefreshToken(newPayload);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateAccessToken(payload: JwtTokenPayload) {
    return this.jwtService.sign(payload);
  }

  private generateRefreshToken(payload: JwtTokenPayload) {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
      expiresIn: this.configService.get<number>(
        'JWT_REFRESH_EXPIRES_IN',
        604800,
      ),
    });
  }
}
