import type { Checkin, Context, DayContext, DayEntry, Habit, HabitMiss } from "./types";

export const BACKUP_VERSION = 1;

/** Copia de seguridad completa en JSON. También es el formato con el que se importan los datos de Rutinas (escritorio). */
export interface Backup {
  app: "rutinas";
  version: number;
  exported_at: string;
  habits: Habit[];
  checkins: Checkin[];
  days: DayEntry[];
  contexts: Context[];
  day_contexts: DayContext[];
  habit_misses: HabitMiss[];
  settings: Record<string, string>;
}

export class BackupError extends Error {}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const FREQS = ["daily", "weekdays", "weekly_count"];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";
const optStr = (v: unknown) => v === null || v === undefined || typeof v === "string";
const int = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

function list(data: Record<string, unknown>, key: string, required: boolean): Record<string, unknown>[] {
  const v = data[key];
  if (v === undefined && !required) return [];
  if (!Array.isArray(v) || !v.every(isObj)) throw new BackupError(`La copia no tiene una lista «${key}» válida.`);
  return v;
}

function check(ok: boolean, what: string, i: number) {
  if (!ok) throw new BackupError(`Dato no válido en ${what} nº ${i + 1}.`);
}

/** Comprueba una copia leída de un archivo y la devuelve normalizada. Lanza `BackupError` con un mensaje para el usuario. */
export function parseBackup(raw: unknown): Backup {
  if (!isObj(raw) || raw.app !== "rutinas") throw new BackupError("Este archivo no es una copia de Rutinas.");
  if (!int(raw.version) || raw.version > BACKUP_VERSION) {
    throw new BackupError("La copia es de una versión más nueva de la app. Actualiza la app e inténtalo otra vez.");
  }

  const habits = list(raw, "habits", true).map((h, i): Habit => {
    check(
      str(h.id) && str(h.name) && h.name.trim() !== "" && str(h.color) && FREQS.includes(h.freq_type as string) && int(h.weekdays) &&
        (h.weekly_target === null || h.weekly_target === undefined || int(h.weekly_target)) &&
        str(h.start_date) && DATE.test(h.start_date) && optStr(h.emoji) &&
        (h.reminder_time === null || h.reminder_time === undefined || (str(h.reminder_time) && TIME.test(h.reminder_time))),
      "el hábito",
      i,
    );
    return {
      id: h.id as string,
      name: (h.name as string).trim(),
      emoji: (h.emoji as string | null | undefined) ?? null,
      color: h.color as string,
      freq_type: h.freq_type as Habit["freq_type"],
      weekdays: h.weekdays as number,
      weekly_target: (h.weekly_target as number | null | undefined) ?? null,
      start_date: h.start_date as string,
      reminder_time: (h.reminder_time as string | null | undefined) ?? null,
      archived: h.archived ? 1 : 0,
      sort_order: int(h.sort_order) ? h.sort_order : i,
      created_at: str(h.created_at) ? h.created_at : new Date().toISOString(),
    };
  });
  const habitIds = new Set(habits.map((h) => h.id));
  if (habitIds.size !== habits.length) throw new BackupError("La copia tiene hábitos repetidos.");

  const checkins = list(raw, "checkins", true).map((c, i): Checkin => {
    check(str(c.habit_id) && habitIds.has(c.habit_id) && str(c.date) && DATE.test(c.date) && optStr(c.note), "la marca", i);
    return { habit_id: c.habit_id as string, date: c.date as string, note: (c.note as string | null | undefined) ?? null };
  });

  const days = list(raw, "days", false).map((d, i): DayEntry => {
    const mood = d.mood ?? null;
    check(str(d.date) && DATE.test(d.date) && (mood === null || (int(mood) && mood >= 1 && mood <= 5)) && optStr(d.note) && optStr(d.closed_at), "el día", i);
    return { date: d.date as string, mood: mood as number | null, note: (d.note as string | null | undefined) ?? null, closed_at: (d.closed_at as string | null | undefined) ?? null };
  });

  const contexts = list(raw, "contexts", false).map((c, i): Context => {
    check(str(c.id) && str(c.label) && str(c.emoji), "la ficha", i);
    return {
      id: c.id as string,
      label: c.label as string,
      emoji: c.emoji as string,
      builtin: c.builtin ? 1 : 0,
      archived: c.archived ? 1 : 0,
      sort_order: int(c.sort_order) ? c.sort_order : i,
    };
  });

  const day_contexts = list(raw, "day_contexts", false).map((d, i): DayContext => {
    check(str(d.date) && DATE.test(d.date) && str(d.context_id), "la ficha del día", i);
    return { date: d.date as string, context_id: d.context_id as string };
  });

  const habit_misses = list(raw, "habit_misses", false).map((m, i): HabitMiss => {
    check(str(m.habit_id) && habitIds.has(m.habit_id) && str(m.date) && DATE.test(m.date) && str(m.context_id), "el motivo", i);
    return { habit_id: m.habit_id as string, date: m.date as string, context_id: m.context_id as string };
  });

  const settings: Record<string, string> = {};
  if (isObj(raw.settings)) for (const [k, v] of Object.entries(raw.settings)) if (str(v)) settings[k] = v;

  return {
    app: "rutinas",
    version: raw.version,
    exported_at: str(raw.exported_at) ? raw.exported_at : new Date().toISOString(),
    habits,
    checkins,
    days,
    contexts,
    day_contexts,
    habit_misses,
    settings,
  };
}
