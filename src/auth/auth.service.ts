import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UserRole } from 'prisma/generated/enums';

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
  ) {}

  private get refreshSecret(): string {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
    return secret;
  }

  private get refreshExpiresInSeconds(): number {
    return this.configService.get<number>('JWT_REFRESH_EXPIRES_IN', 604800);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // return null for unknown email — same path as wrong password, prevents email enumeration
    if (!user) return null;

    if (user.isLocked) {
      throw new UnauthorizedException('Account is locked, please contact admin');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    const { password: _, ...result } = user;
    return result;
  }

  async login(user: LoginUser) {
    const accessPayload: JwtAccessPayload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(accessPayload);

    const jti = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { ...accessPayload, jti } satisfies JwtRefreshPayload,
      { secret: this.refreshSecret, expiresIn: this.refreshExpiresInSeconds },
    );

    const expiresAt = new Date(Date.now() + this.refreshExpiresInSeconds * 1000);
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
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.jti) throw new UnauthorizedException('Invalid refresh token');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    });

    if (
      !stored ||
      stored.userId !== payload.sub ||
      stored.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newJti = randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshExpiresInSeconds * 1000);

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
}
