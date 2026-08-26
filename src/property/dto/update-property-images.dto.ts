import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

// PATCH /property/:id/images — bundles add/remove/set-cover into one
// multipart request, fired once on Save rather than per-click. New files
// arrive via `files[]` (see DynamicImagesInterceptor); this DTO only carries
// the accompanying form fields.
export class UpdatePropertyImagesDto {
  // Existing PropertyImage ids to delete.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }): unknown =>
    value === undefined || Array.isArray(value) ? value : [value],
  )
  removeImageIds?: string[];

  // Id of an *existing* (kept) image to mark as cover.
  @IsOptional()
  @IsString()
  coverImageId?: string;

  // Index into this request's `files[]` to mark as cover, when the chosen
  // cover is one of the newly-added images rather than an existing one.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  coverNewFileIndex?: number;
}
