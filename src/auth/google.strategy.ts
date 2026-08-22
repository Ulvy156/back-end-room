import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { TranslationService } from '../i18n/translation.service';

export interface GoogleUser {
  email: string;
  name: string;
  photoUrl?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly translation: TranslationService,
  ) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const { value: email, verified } = profile.emails![0];
    // Google itself hasn't confirmed this email — don't trust it to link or
    // auto-verify a RokPteah account.
    if (!verified) {
      return done(
        new UnauthorizedException(
          this.translation.t('errors.auth.google_email_not_verified'),
        ),
      );
    }
    const name = profile.displayName;
    const photoUrl = profile.photos?.[0]?.value;
    done(null, { email, name, photoUrl } satisfies GoogleUser);
  }
}
