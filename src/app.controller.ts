import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService, HealthStatus } from './app.service';
import { Public } from './auth/public.decorator';
import { BypassMaintenance } from './settings/bypass-maintenance.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @BypassMaintenance()
  @SkipThrottle()
  @Get('health')
  getHealth(): Promise<HealthStatus> {
    return this.appService.getHealth();
  }
}
