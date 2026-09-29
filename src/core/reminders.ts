import { addDaysKey, fromKey } from "./dates";
import { isScheduled } from "./schedule";
import { weekCount } from "./stats";
import type { CheckMap, Habit } from "./types";

/** iOS guarda como mucho 64 avisos pendientes por app; dejamos margen. */
export const MAX_PENDING = 60;
/** Días por adelantado que se programan (menos si no caben). */
export const HORIZON_DAYS = 14;

export interface PlannedReminder {
  /** Hábito, o null para el aviso de cerrar el día. */
  habitId: string | null;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:MM' */
  time: string;
  title: string;
  body: string;
}

export interface ReminderInput {
  /** Cada hábito con su inicio efectivo y sus marcas. */
  habits: { h: Habit; checks: CheckMap }[];
  /** 'HH:MM' del aviso de cerrar el día, o null si no se quiere. */
  closeTime: string | null;
  /** Días ya cerrados. */
  closedDays: Set<string>;
  today: string;
  /** 'HH:MM' de ahora: lo de hoy que ya ha pasado no se programa. */
  nowTime: string;
}

/**
 * Qué avisos programar: uno por hábito cada día que toca a su hora, saltando los ya hechos
 * (o, en «X veces por semana», las semanas ya cumplidas), y el de cerrar el día si no está cerrado.
 * Son avisos de fecha concreta, no repetitivos, para poder saltar los que ya no hacen falta;
 * la app los vuelve a calcular cada vez que se abre o cambia algo.
 */
export function planReminders(input: ReminderInput): PlannedReminder[] {
  const { habits, closeTime, closedDays, today, nowTime } = input;
  const withReminder = habits.filter(({ h }) => h.reminder_time && !h.archived);
  const out: PlannedReminder[] = [];

  for (let i = 0; i < HORIZON_DAYS; i++) {
    const date = addDaysKey(today, i);
    const day: PlannedReminder[] = [];

    for (const { h, checks } of withReminder) {
      const time = h.reminder_time!;
      if (date === today && time <= nowTime) continue;
      if (date < h.start_date && date !== today) continue;
      if (checks.has(date)) continue;
      if (h.freq_type === "weekly_count") {
        // Solo avisa mientras la semana no esté cumplida (lo que se sabe hoy vale para esta semana).
        if (weekCount(h, checks, date) >= (h.weekly_target ?? 1)) continue;
      } else if (!isScheduled({ ...h, start_date: h.start_date > today ? h.start_date : today }, date)) {
        continue;
      }
      day.push({ habitId: h.id, date, time, title: `${h.emoji ? `${h.emoji} ` : ""}${h.name}`, body: "Te toca hoy. Un toque y listo." });
    }

    if (closeTime && !closedDays.has(date) && !(date === today && closeTime <= nowTime)) {
      day.push({ habitId: null, date, time: closeTime, title: "🌙 Cierra tu día", body: "15 segundos: cómo ha ido y qué lo ha marcado." });
    }

    // Días enteros o nada: mejor pocos días completos que un día a medias.
    if (out.length + day.length > MAX_PENDING) break;
    out.push(...day.sort((a, b) => a.time.localeCompare(b.time)));
  }
  return out;
}

/** Fecha local de un aviso planificado. */
export function reminderDate(r: Pick<PlannedReminder, "date" | "time">): Date {
  const d = fromKey(r.date);
  const [hh, mm] = r.time.split(":").map(Number);
  d.setHours(hh, mm, 0, 0);
  return d;
}
