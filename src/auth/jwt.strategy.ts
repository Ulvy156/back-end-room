import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

interface JwtPayload {
  sub: string; // user ID
  role: string; // user role
  // add more fields if needed
}

// The web app authenticates via the HttpOnly `access_token` cookie (the
// browser attaches it automatically); the Bearer header stays supported for
// any non-browser API client (e.g. Postman, a future mobile app).
const extractFromCookie = (req: Request): string | null =>
  (req.cookies as Record<string, string> | undefined)?.access_token ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractFromCookie,
      ]),
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) throw new UnauthorizedException('Unauthorized');
    if (user.isLocked) throw new UnauthorizedException('Account is locked');

    const { password, ...result } = user;
    return result;
  }
}
