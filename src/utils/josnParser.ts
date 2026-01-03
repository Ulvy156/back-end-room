export function parseJsonArray<T>(value: string): T[] {
  return JSON.parse(value) as T[];
}
