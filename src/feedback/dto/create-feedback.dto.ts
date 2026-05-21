import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { FeedbackType } from 'prisma/generated/enums';

export class CreateFeedbackDto {
  @IsEnum(FeedbackType)
  type: FeedbackType;

  @IsString()
  @IsNotEmpty()
  description: string;
}
