import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PropertyModule } from 'src/property/property.module';

@Module({
  imports: [PropertyModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
