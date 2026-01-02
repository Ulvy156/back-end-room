import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from 'generated/prisma/enums';

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
    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Issue access + refresh tokens
   */
  async login(user: LoginUser) {
    const payload: JwtTokenPayload = {
      sub: user.id,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET!,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

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

      const newAccessToken = this.jwtService.sign(newPayload);

      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_REFRESH_SECRET!,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
