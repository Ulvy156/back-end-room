import { Transform } from 'class-transformer';

// NestJS's global ValidationPipe sets `enableImplicitConversion: true`, which
// coerces any non-empty query string to `true` via `Boolean(value)` *before*
// a property's own @Transform runs — so a raw @Transform(({ value }) => ...)
// never sees the original 'false' string. Reading from `obj[key]` bypasses
// that implicit coercion and gets the raw query value instead.
export function ToBoolean() {
  return Transform(
    ({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
      const value = obj[key];
      if (value === true || value === 'true') return true;
      if (value === false || value === 'false') return false;
      return undefined;
    },
  );
}
