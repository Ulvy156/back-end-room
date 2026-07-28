import { IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class AddPhoneDto {
  @IsNotEmpty()
  @IsPhoneNumber('KH', { message: 'phone must be a valid phone number' })
  phoneNumber: string;
}
