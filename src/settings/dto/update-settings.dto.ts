// A dynamic key -> value map (any subset of the current AppSetting keys), not
// a class-validator class: per-field decorators would require a DTO change
// every time a new setting is seeded, which is exactly what this shape
// avoids. As a type alias it reflects as `Object` at runtime, so the global
// ValidationPipe's `whitelist: true` skips it instead of stripping unknown
// keys — all validation for this endpoint happens in SettingsService.
export type UpdateSettingsDto = Record<string, unknown>;
