export function convertRutinas(
  rows: { habits: Record<string, unknown>[]; checkins: Record<string, unknown>[]; settings: { key: string; value: string | null }[] },
  opts?: { uuid?: () => string; now?: string },
): unknown;
