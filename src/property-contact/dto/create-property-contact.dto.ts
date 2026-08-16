import { IsEnum, IsOptional } from 'class-validator';
import { PhoneNumberType } from 'prisma/generated/enums';

export class CreatePropertyContactDto {
  @IsOptional()
  @IsEnum(PhoneNumberType)
  method?: PhoneNumberType;
}
