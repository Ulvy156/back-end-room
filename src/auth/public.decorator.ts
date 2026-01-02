// allow router to be accessed public
import { SetMetadata } from '@nestjs/common';
export const Public = () => SetMetadata('isPublic', true);
