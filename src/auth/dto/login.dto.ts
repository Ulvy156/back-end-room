import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // email address or phone number

  @IsString()
  @MinLength(1)
  password: string;
}
