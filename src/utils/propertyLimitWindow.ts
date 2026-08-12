// The posting limit counts properties created within a rolling 30-day
// window. An admin reset moves the window's start forward to "now" so
// properties created before the reset stop counting immediately, instead of
// waiting for them to individually age out.
export function getPropertyLimitWindowStart(
  resetAt: Date | null | undefined,
): Date {
  const rollingWindowStart = new Date();
  rollingWindowStart.setDate(rollingWindowStart.getDate() - 30);

  return resetAt && resetAt > rollingWindowStart ? resetAt : rollingWindowStart;
}
