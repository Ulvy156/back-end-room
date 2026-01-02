// create-user.dto.ts

import { Exclude } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(20)
  name?: string;

  @IsStrongPassword()
  @IsNotEmpty()
  psw: string;

  @IsNumber()
  roleId: number;
}
