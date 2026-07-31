import { IsNotEmpty, IsPhoneNumber, Length } from 'class-validator';

export class AddPhoneDto {
  @IsNotEmpty()
  @Length(8, 11, { message: 'phone number must be between 8 and 11 digits' })
  @IsPhoneNumber('KH', { message: 'phone must be a valid phone number' })
  phoneNumber: string;
}
