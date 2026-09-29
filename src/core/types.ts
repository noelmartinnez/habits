export type FreqType = "daily" | "weekdays" | "weekly_count";

export interface Habit {
  id: string;
  name: string;
  /** Un emoji, o null para mostrar la inicial. */
  emoji: string | null;
  color: string;
  freq_type: FreqType;
  /** Máscara de bits: lunes = 1, martes = 2 … domingo = 64. */
  weekdays: number;
  weekly_target: number | null;
  /**
   * 'YYYY-MM-DD'. Día en que se creó el hábito: el historial empieza aquí o en el primer
   * día marcado, lo que sea antes (ver `effectiveStart`). No se muestra ni se edita.
   */
  start_date: string;
  /** 'HH:MM' */
  reminder_time: string | null;
  archived: number;
  sort_order: number;
  created_at: string;
}

export type HabitInput = Pick<Habit, "name" | "emoji" | "color" | "freq_type" | "weekdays" | "weekly_target" | "reminder_time">;

export interface Checkin {
  habit_id: string;
  date: string;
  note: string | null;
}

/** Fecha 'YYYY-MM-DD' → nota (o null si no tiene nota). */
export type CheckMap = Map<string, string | null>;

/** El cierre de un día: cómo fue y qué lo marcó. */
export interface DayEntry {
  date: string;
  /** 1 (muy mal) … 5 (muy bien), o null si no se ha dicho. */
  mood: number | null;
  note: string | null;
  closed_at: string | null;
}

/** Ficha de contexto: algo que marcó el día o explica un fallo («dormí mal», «estrés»…). */
export interface Context {
  id: string;
  label: string;
  emoji: string;
  builtin: number;
  archived: number;
  sort_order: number;
}

export type ContextInput = Pick<Context, "label" | "emoji">;

export interface DayContext {
  date: string;
  context_id: string;
}

/** Por qué no se hizo un hábito un día concreto. */
export interface HabitMiss {
  habit_id: string;
  date: string;
  context_id: string;
}
