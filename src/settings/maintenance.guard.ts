import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRole } from 'prisma/generated/enums';
import { SettingsService } from './settings.service';
import { TranslationService } from 'src/i18n/translation.service';

interface RequestWithUser extends Request {
  user?: { role?: UserRole };
}

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settingsService: SettingsService,
    private readonly translation: TranslationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bypass = this.reflector.getAllAndOverride<boolean>(
      'bypassMaintenance',
      [context.getHandler(), context.getClass()],
    );
    if (bypass) return true;

    const maintenanceMode = await this.settingsService.get<boolean>(
      'system',
      'maintenanceMode',
    );
    if (!maintenanceMode) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user?.role === UserRole.ADMIN) return true;

    throw new ServiceUnavailableException(
      this.translation.t('errors.settings.maintenance_mode'),
    );
  }
}
