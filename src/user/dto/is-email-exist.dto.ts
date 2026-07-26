import { IsEmail } from 'class-validator';

export class IsEmailExistDto {
  @IsEmail()
  email: string;
}
