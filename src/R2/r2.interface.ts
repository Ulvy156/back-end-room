export type foldersR2 = 'rooms' | 'houses' | 'apartments' | 'condo' | 'profile';

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_IMAGE_SIZE = 1 * 1024 * 1024; // 1MB
