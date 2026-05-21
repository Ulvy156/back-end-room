import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateMyInfoDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
