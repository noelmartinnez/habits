import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import type { CheckMap, Habit } from "./types";
import { addDaysKey, eachDayKey, fromKey, maxKey, minKey, toKey, weekdayIndex, weekStartKey } from "./dates";
import { isScheduled } from "./schedule";

type H = Pick<Habit, "freq_type" | "weekdays" | "weekly_target" | "start_date">;

const target = (h: H) => Math.max(1, Math.min(7, h.weekly_target ?? 1));

/** Nº de marcas en la semana (lunes a domingo) que contiene `key`, sin contar días anteriores al inicio. */
export function weekCount(h: H, checks: CheckMap, key: string): number {
  const ws = weekStartKey(key);
  let n = 0;
  for (const k of eachDayKey(ws, addDaysKey(ws, 6))) if (k >= h.start_date && checks.has(k)) n++;
  return n;
}

export interface Streaks {
  current: number;
  best: number;
  /** 'días' o 'semanas' */
  unit: "day" | "week";
}

export function streaks(h: H, checks: CheckMap, today: string): Streaks {
  if (today < h.start_date) return { current: 0, best: 0, unit: h.freq_type === "weekly_count" ? "week" : "day" };

  if (h.freq_type === "weekly_count") {
    const t = target(h);
    const currentWeek = weekStartKey(today);
    const weeks: boolean[] = [];
    for (let w = weekStartKey(h.start_date); w <= currentWeek; w = addDaysKey(w, 7)) {
      weeks.push(weekCount(h, checks, w) >= t);
    }
    // La semana en curso solo suma si ya se ha logrado; si no, no rompe la racha.
    if (!weeks[weeks.length - 1]) weeks.pop();
    return { ...runs(weeks), unit: "week" };
  }

  const days: boolean[] = [];
  for (const k of eachDayKey(h.start_date, today)) {
    if (isScheduled(h, k)) days.push(checks.has(k));
  }
  // Si hoy aún no está marcado, no rompe la racha.
  if (isScheduled(h, today) && !checks.has(today)) days.pop();
  return { ...runs(days), unit: "day" };
}

export const streakUnit = (unit: Streaks["unit"], n: number) =>
  unit === "day" ? (n === 1 ? "día" : "días") : n === 1 ? "semana" : "semanas";

/** Racha final (current) y racha más larga (best) de una secuencia de aciertos. */
function runs(seq: boolean[]) {
  let best = 0;
  let run = 0;
  for (const ok of seq) {
    run = ok ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

export interface PeriodStats {
  done: number;
  expected: number;
  /** 0..1, o null si aún no hay nada que medir */
  rate: number | null;
}

/**
 * Cumplimiento entre `from` y `to` (incluidos), recortado a [inicio del hábito, hoy].
 * El día de hoy solo cuenta si ya está marcado, para no penalizar un día que no ha terminado.
 */
export function periodStats(h: H, checks: CheckMap, from: string, to: string, today: string): PeriodStats {
  const start = maxKey(from, h.start_date);
  let end = minKey(to, today);
  if (end === today && !checks.has(today)) end = addDaysKey(today, -1);
  if (start > end) return { done: 0, expected: 0, rate: null };

  if (h.freq_type === "weekly_count") {
    let done = 0;
    let days = 0;
    for (const k of eachDayKey(start, end)) {
      days++;
      if (checks.has(k)) done++;
    }
    const expected = (days * target(h)) / 7;
    return { done, expected, rate: expected > 0 ? Math.min(1, done / expected) : null };
  }

  let done = 0;
  let expected = 0;
  for (const k of eachDayKey(start, end)) {
    if (!isScheduled(h, k)) continue;
    expected++;
    if (checks.has(k)) done++;
  }
  return { done, expected, rate: expected > 0 ? done / expected : null };
}

export interface MonthPoint {
  key: string;
  label: string;
  rate: number | null;
}

/** Porcentaje de cumplimiento de los últimos `n` meses (el último es el mes actual). */
export function monthlyRates(h: H, checks: CheckMap, today: string, n = 12): MonthPoint[] {
  const base = startOfMonth(fromKey(today));
  const out: MonthPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = addMonths(base, -i);
    const s = periodStats(h, checks, toKey(m), toKey(endOfMonth(m)), today);
    out.push({ key: toKey(m), label: format(m, "MMM", { locale: es }).replace(".", ""), rate: s.rate });
  }
  return out;
}

export interface WeekdayPoint {
  idx: number;
  done: number;
  scheduled: number;
  rate: number | null;
}

/** Cumplimiento por día de la semana, desde el inicio (o desde `from`). */
export function weekdayRates(h: H, checks: CheckMap, today: string, from = h.start_date): WeekdayPoint[] {
  const pts: WeekdayPoint[] = Array.from({ length: 7 }, (_, idx) => ({ idx, done: 0, scheduled: 0, rate: null }));
  const start = maxKey(from, h.start_date);
  for (const k of eachDayKey(start, today)) {
    const p = pts[weekdayIndex(k)];
    const done = checks.has(k);
    if (h.freq_type === "weekly_count") {
      // Sin días fijos: mostramos en qué días sueles hacerlo.
      if (k === today && !done) continue;
      p.scheduled++;
      if (done) p.done++;
      continue;
    }
    if (!isScheduled(h, k) || (k === today && !done)) continue;
    p.scheduled++;
    if (done) p.done++;
  }
  for (const p of pts) p.rate = p.scheduled > 0 ? p.done / p.scheduled : null;
  return pts;
}

/** ¿El hábito queda pendiente hoy? */
export function isDueToday(h: H, checks: CheckMap, today: string): boolean {
  if (today < h.start_date) return false;
  if (h.freq_type === "weekly_count") return checks.has(today) || weekCount(h, checks, today) < target(h);
  return isScheduled(h, today);
}

/** La fuerza baja a la mitad en 13 días sin hacer un hábito diario (la vida media de Loop Habit Tracker). */
const HALF_LIFE_DAYS = 13;

/**
 * Fuerza del hábito, 0..1: media exponencial de los aciertos. Cada vez que toca y se hace sube,
 * cada vez que toca y no se hace baja, pero un fallo tras una buena racha no la hunde.
 * Los hábitos menos frecuentes olvidan más despacio (vida media de 13/√f días, con f = veces por día),
 * igual que en Loop. Hoy sin marcar y la semana en curso sin lograr no cuentan todavía.
 */
export function strength(h: H, checks: CheckMap, today: string): number {
  if (today < h.start_date) return 0;
  const f = frequencyPerDay(h);
  const halfLifeDays = HALF_LIFE_DAYS / Math.sqrt(f);
  let score = 0;

  if (h.freq_type === "weekly_count") {
    const t = target(h);
    const m = 0.5 ** (7 / halfLifeDays);
    const currentWeek = weekStartKey(today);
    for (let w = weekStartKey(h.start_date); w <= currentWeek; w = addDaysKey(w, 7)) {
      const value = Math.min(1, weekCount(h, checks, w) / t);
      if (w === currentWeek && value < 1) break;
      score = score * m + value * (1 - m);
    }
    return score;
  }

  // Un paso por cada día que toca: en días concretos, f días de cada 7.
  const m = 0.5 ** (1 / (halfLifeDays * f));
  for (const k of eachDayKey(h.start_date, today)) {
    if (!isScheduled(h, k)) continue;
    const done = checks.has(k);
    if (k === today && !done) break;
    score = score * m + (done ? 1 : 0) * (1 - m);
  }
  return score;
}

function frequencyPerDay(h: H): number {
  if (h.freq_type === "weekly_count") return target(h) / 7;
  if (h.freq_type === "weekdays") {
    let n = 0;
    for (let i = 0; i < 7; i++) if (h.weekdays & (1 << i)) n++;
    return Math.max(1, n) / 7;
  }
  return 1;
}

export interface DayCompletion {
  done: number;
  /** Hábitos que tocaban ese día (más los hechos aunque no tocaran). */
  due: number;
}

/**
 * Cuántos hábitos se hicieron un día de cuántos tocaban. Los hábitos «X veces por semana»
 * y los hechos en un día que no tocaba solo suman si se hicieron: no hacerlos no es fallo.
 * Cada `h` debe llevar ya su inicio efectivo.
 */
export function dayCompletion(items: { h: H; checks: CheckMap }[], key: string): DayCompletion {
  let done = 0;
  let due = 0;
  for (const { h, checks } of items) {
    if (key < h.start_date) continue;
    const did = checks.has(key);
    if (h.freq_type === "weekly_count" || !isScheduled(h, key)) {
      if (did) {
        done++;
        due++;
      }
      continue;
    }
    due++;
    if (did) done++;
  }
  return { done, due };
}
