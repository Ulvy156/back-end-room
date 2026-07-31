// Deliberately not a class-validator class, for the same reason as
// UpdateSettingsDto: `value` can be any JSON type, and the global
// ValidationPipe's `whitelist: true` would strip an undecorated `value`
// property entirely. SettingsService.createSetting() validates the shape.
export type CreateSettingDto = Record<string, unknown>;
