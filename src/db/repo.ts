import type { Backup } from "../core/backup";
import type { Checkin, Context, ContextInput, DayContext, DayEntry, Habit, HabitInput, HabitMiss } from "../core/types";

/** Todo el acceso a datos pasa por aquí; la app no sabe qué hay debajo. */
export interface Repo {
  listHabits(): Promise<Habit[]>;
  createHabit(input: HabitInput, startDate: string, sortOrder: number): Promise<Habit>;
  updateHabit(id: string, input: HabitInput): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
  deleteHabit(id: string): Promise<void>;
  setOrder(ids: string[]): Promise<void>;

  listCheckins(): Promise<Checkin[]>;
  addCheckin(habitId: string, date: string, note: string | null): Promise<void>;
  removeCheckin(habitId: string, date: string): Promise<void>;
  setNote(habitId: string, date: string, note: string | null): Promise<void>;

  listDays(): Promise<DayEntry[]>;
  listDayContexts(): Promise<DayContext[]>;
  listMisses(): Promise<HabitMiss[]>;
  /** Guarda el día entero de una vez: ánimo, fichas y por qué no se hizo cada hábito. */
  saveDay(entry: DayEntry, contextIds: string[], misses: Record<string, string>): Promise<void>;
  setMiss(habitId: string, date: string, contextId: string | null): Promise<void>;

  listContexts(): Promise<Context[]>;
  createContext(input: ContextInput, sortOrder: number): Promise<Context>;
  updateContext(id: string, input: ContextInput): Promise<void>;
  setContextArchived(id: string, archived: boolean): Promise<void>;

  getSettings(): Promise<Record<string, string>>;
  setSetting(key: string, value: string): Promise<void>;

  exportAll(): Promise<Backup>;
  /** Sustituye todos los datos por los de la copia (las fichas de serie se conservan). */
  importAll(backup: Backup): Promise<void>;
}
