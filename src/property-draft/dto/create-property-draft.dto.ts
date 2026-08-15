import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { CreatePropertyDto } from 'src/property/dto/create-property.dto';

export class CreatePropertyDraftDto extends PartialType(
  OmitType(CreatePropertyDto, ['userId'] as const),
) {
  // PATCH /property-draft/:id only — R2 keys of existing draft images to
  // delete. Ignored on create, since a new draft has no images yet.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  removeImageKeys?: string[];
}
