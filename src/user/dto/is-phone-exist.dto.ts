import { IsString, Matches } from 'class-validator';

export class IsPhoneExistDto {
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'phoneNumber must be a valid phone number',
  })
  phoneNumber: string;
}
