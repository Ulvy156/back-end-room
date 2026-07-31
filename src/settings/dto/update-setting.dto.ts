// Not a class-validator class: `value` can be any JSON type, and the global
// ValidationPipe's `whitelist: true` would strip an undecorated `value`
// property entirely. As a type alias it reflects as `Object` at runtime, so
// the pipe skips it instead — SettingsService.updateSetting() validates it.
export type UpdateSettingDto = {
  value: unknown;
};
