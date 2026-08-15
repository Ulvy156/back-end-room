import { Prisma } from 'prisma/generated/client';
import { DraftImage } from './types/draft-image.type';

export function getDraftImages(draft: {
  images: Prisma.JsonValue;
}): DraftImage[] {
  return (draft.images as unknown as DraftImage[] | null) ?? [];
}
