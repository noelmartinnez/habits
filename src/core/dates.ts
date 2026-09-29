import { addDays, format, getISODay, parseISO, startOfWeek } from "date-fns";

/** Las fechas se manejan siempre como 'YYYY-MM-DD' en hora local. */
export const toKey = (d: Date) => format(d, "yyyy-MM-dd");
export const fromKey = (k: string) => parseISO(k);
export const todayKey = () => toKey(new Date());
export const addDaysKey = (k: string, n: number) => toKey(addDays(fromKey(k), n));

/** 0 = lunes … 6 = domingo */
export const weekdayIndex = (k: string) => getISODay(fromKey(k)) - 1;

export const weekStartKey = (k: string) => toKey(startOfWeek(fromKey(k), { weekStartsOn: 1 }));

/** Recorre las fechas de `from` a `to`, ambas incluidas. */
export function* eachDayKey(from: string, to: string) {
  for (let k = from; k <= to; k = addDaysKey(k, 1)) yield k;
}

export const maxKey = (a: string, b: string) => (a > b ? a : b);
export const minKey = (a: string, b: string) => (a < b ? a : b);

/** Hora "HH:MM" de una fecha. */
export const toTimeKey = (d: Date) => format(d, "HH:mm");

/** Fecha de hoy a la hora "HH:MM" (para los selectores de hora). */
export function fromTimeKey(t: string): Date {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
