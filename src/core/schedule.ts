import type { CheckMap, Habit } from "./types";
import { weekdayIndex } from "./dates";

export const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
export const ALL_WEEKDAYS = 127;

export const hasWeekday = (mask: number, idx: number) => (mask & (1 << idx)) !== 0;

/**
 * Los hábitos no tienen fecha de inicio que elegir: el historial empieza el día en que se creó
 * o el primer día marcado, lo que sea antes. Así se pueden pasar registros antiguos.
 */
export function effectiveStart(habit: Pick<Habit, "start_date">, checks: CheckMap): string {
  let start = habit.start_date;
  for (const k of checks.keys()) if (k < start) start = k;
  return start;
}

/** El hábito con `start_date` sustituido por su inicio efectivo, listo para calendarios y estadísticas. */
export function withHistory<H extends Pick<Habit, "start_date">>(habit: H, checks: CheckMap): H {
  const start = effectiveStart(habit, checks);
  return start === habit.start_date ? habit : { ...habit, start_date: start };
}

/** ¿Hay que hacer el hábito este día? (para 'weekly_count' cualquier día vale) */
export function isScheduled(habit: Pick<Habit, "freq_type" | "weekdays" | "start_date">, key: string): boolean {
  if (key < habit.start_date) return false;
  if (habit.freq_type === "weekdays") return hasWeekday(habit.weekdays, weekdayIndex(key));
  return true;
}

export function describeFrequency(habit: Pick<Habit, "freq_type" | "weekdays" | "weekly_target">): string {
  switch (habit.freq_type) {
    case "daily":
      return "Todos los días";
    case "weekdays":
      if (habit.weekdays === ALL_WEEKDAYS) return "Todos los días";
      if (habit.weekdays === 31) return "De lunes a viernes";
      return WEEKDAY_SHORT.filter((_, i) => hasWeekday(habit.weekdays, i)).join(", ");
    case "weekly_count": {
      const n = habit.weekly_target ?? 1;
      return n === 1 ? "1 vez por semana" : `${n} veces por semana`;
    }
  }
}

/**
 * done     hecho
 * missed   tocaba y no se hizo
 * open     hoy, o cualquier día de un hábito «X veces por semana»: se puede hacer, no es fallo
 * off      no tocaba ese día
 * empty    antes de que empiece el historial: sin registro, pero se puede marcar (registros antiguos)
 * disabled futuro
 *
 * `habit` debe llevar ya su inicio efectivo (ver `withHistory`).
 */
export type DayState = "done" | "missed" | "open" | "off" | "empty" | "disabled";

export function dayState(habit: Pick<Habit, "freq_type" | "weekdays" | "start_date">, checks: CheckMap, key: string, today: string): DayState {
  if (key > today) return checks.has(key) ? "done" : "disabled";
  if (checks.has(key)) return "done";
  if (key < habit.start_date) return "empty";
  if (!isScheduled(habit, key)) return "off";
  if (key === today || habit.freq_type === "weekly_count") return "open";
  return "missed";
}
