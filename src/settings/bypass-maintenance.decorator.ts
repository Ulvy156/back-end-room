// allow route to be accessed even when maintenance mode is on
import { SetMetadata } from '@nestjs/common';
export const BypassMaintenance = () => SetMetadata('bypassMaintenance', true);
