import { create } from "zustand";
import type { Backup } from "../core/backup";
import { todayKey } from "../core/dates";
import type { CheckMap, Context, ContextInput, DayEntry, Habit, HabitInput } from "../core/types";
import type { Repo } from "../db/repo";
import { createSqliteRepo } from "../db/sqlite";

export type ThemePref = "system" | "light" | "dark";

/** Lo que se guarda al cerrar un día. */
export interface DayClose {
  mood: number | null;
  contextIds: string[];
  /** Hábito → ficha que explica por qué no se hizo. */
  misses: Record<string, string>;
  note?: string | null;
}

interface State {
  ready: boolean;
  /** Último error para enseñar al usuario (null si no hay). */
  error: string | null;
  repo: Repo | null;
  habits: Habit[];
  checks: Record<string, CheckMap>;
  days: Record<string, DayEntry>;
  /** Fecha → fichas que marcaron el día. */
  dayContexts: Record<string, string[]>;
  /** Fecha → hábito → ficha de por qué no se hizo. */
  misses: Record<string, Record<string, string>>;
  contexts: Context[];
  settings: Record<string, string>;
  today: string;

  init(): Promise<void>;
  refreshToday(): void;
  clearError(): void;

  createHabit(input: HabitInput): Promise<Habit>;
  updateHabit(id: string, input: HabitInput): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
  deleteHabit(id: string): Promise<void>;
  reorder(ids: string[]): Promise<void>;

  /** Marca o desmarca. Devuelve si queda hecho. La pantalla cambia al instante; se guarda después. */
  toggle(habitId: string, date: string): boolean;
  saveNote(habitId: string, date: string, note: string): Promise<void>;

  closeDay(date: string, close: DayClose): Promise<void>;
  setMiss(habitId: string, date: string, contextId: string | null): Promise<void>;

  createContext(input: ContextInput): Promise<Context>;
  updateContext(id: string, input: ContextInput): Promise<void>;
  setContextArchived(id: string, archived: boolean): Promise<void>;

  setSetting(key: string, value: string): Promise<void>;
  exportBackup(): Promise<Backup>;
  importBackup(b: Backup): Promise<void>;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function groupChecks(rows: { habit_id: string; date: string; note: string | null }[]) {
  const checks: Record<string, CheckMap> = {};
  for (const c of rows) (checks[c.habit_id] ??= new Map()).set(c.date, c.note);
  return checks;
}

export const useStore = create<State>((set, get) => {
  const repo = () => get().repo!;

  /** Vuelve a leer todo de la base de datos. */
  async function load(r: Repo) {
    const [habits, checkins, days, dayContexts, misses, contexts, settings] = await Promise.all([
      r.listHabits(),
      r.listCheckins(),
      r.listDays(),
      r.listDayContexts(),
      r.listMisses(),
      r.listContexts(),
      r.getSettings(),
    ]);
    const dc: Record<string, string[]> = {};
    for (const d of dayContexts) (dc[d.date] ??= []).push(d.context_id);
    const ms: Record<string, Record<string, string>> = {};
    for (const m of misses) (ms[m.date] ??= {})[m.habit_id] = m.context_id;
    set({
      habits,
      checks: groupChecks(checkins),
      days: Object.fromEntries(days.map((d) => [d.date, d])),
      dayContexts: dc,
      misses: ms,
      contexts,
      settings,
    });
  }

  /** Ejecuta una escritura; si falla, lo cuenta y recarga para no enseñar datos que no se guardaron. */
  async function write(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      set({ error: `No se pudo guardar: ${message(e)}` });
      await load(repo()).catch(() => {});
      throw e;
    }
  }

  return {
    ready: false,
    error: null,
    repo: null,
    habits: [],
    checks: {},
    days: {},
    dayContexts: {},
    misses: {},
    contexts: [],
    settings: {},
    today: todayKey(),

    async init() {
      try {
        const r = await createSqliteRepo();
        set({ repo: r });
        await load(r);
        set({ ready: true, today: todayKey() });
      } catch (e) {
        set({ error: `No se pudo abrir la base de datos: ${message(e)}`, ready: true });
      }
    },

    refreshToday() {
      const t = todayKey();
      if (t !== get().today) set({ today: t });
    },

    clearError: () => set({ error: null }),

    async createHabit(input) {
      const { habits, today } = get();
      const order = habits.reduce((m, h) => Math.max(m, h.sort_order + 1), 0);
      const habit = await repo().createHabit(input, today, order);
      set({ habits: [...get().habits, habit] });
      return habit;
    },

    async updateHabit(id, input) {
      await write(() => repo().updateHabit(id, input));
      set({ habits: get().habits.map((h) => (h.id === id ? { ...h, ...input } : h)) });
    },

    async setArchived(id, archived) {
      await write(() => repo().setArchived(id, archived));
      set({ habits: get().habits.map((h) => (h.id === id ? { ...h, archived: archived ? 1 : 0 } : h)) });
    },

    async deleteHabit(id) {
      await write(() => repo().deleteHabit(id));
      const { [id]: _gone, ...checks } = get().checks;
      set({ habits: get().habits.filter((h) => h.id !== id), checks });
    },

    async reorder(ids) {
      const pos = new Map(ids.map((id, i) => [id, i]));
      set({
        habits: get()
          .habits.map((h) => (pos.has(h.id) ? { ...h, sort_order: pos.get(h.id)! } : h))
          .sort((a, b) => a.sort_order - b.sort_order),
      });
      await write(() => repo().setOrder(ids));
    },

    toggle(habitId, date) {
      const current = get().checks[habitId] ?? new Map();
      const next = new Map(current);
      const done = !current.has(date);
      if (done) next.set(date, null);
      else next.delete(date);

      // Si se hizo, deja de tener sentido el motivo de no haberlo hecho.
      let misses = get().misses;
      if (done && misses[date]?.[habitId]) {
        const { [habitId]: _gone, ...rest } = misses[date];
        misses = { ...misses, [date]: rest };
      }
      set({ checks: { ...get().checks, [habitId]: next }, misses });

      void write(() => (done ? repo().addCheckin(habitId, date, null) : repo().removeCheckin(habitId, date))).catch(() => {});
      return done;
    },

    async saveNote(habitId, date, note) {
      const value = note.trim() || null;
      await write(() => repo().setNote(habitId, date, value));
      const next = new Map(get().checks[habitId]);
      if (next.has(date)) next.set(date, value);
      set({ checks: { ...get().checks, [habitId]: next } });
    },

    async closeDay(date, close) {
      const entry: DayEntry = {
        date,
        mood: close.mood,
        note: close.note === undefined ? (get().days[date]?.note ?? null) : close.note,
        closed_at: new Date().toISOString(),
      };
      await write(() => repo().saveDay(entry, close.contextIds, close.misses));
      set({
        days: { ...get().days, [date]: entry },
        dayContexts: { ...get().dayContexts, [date]: close.contextIds },
        misses: { ...get().misses, [date]: close.misses },
      });
    },

    async setMiss(habitId, date, contextId) {
      await write(() => repo().setMiss(habitId, date, contextId));
      const day = { ...get().misses[date] };
      if (contextId === null) delete day[habitId];
      else day[habitId] = contextId;
      set({ misses: { ...get().misses, [date]: day } });
    },

    async createContext(input) {
      const order = get().contexts.reduce((m, c) => Math.max(m, c.sort_order + 1), 0);
      const ctx = await repo().createContext(input, order);
      set({ contexts: [...get().contexts, ctx] });
      return ctx;
    },

    async updateContext(id, input) {
      await write(() => repo().updateContext(id, input));
      set({ contexts: get().contexts.map((c) => (c.id === id ? { ...c, ...input } : c)) });
    },

    async setContextArchived(id, archived) {
      await write(() => repo().setContextArchived(id, archived));
      set({ contexts: get().contexts.map((c) => (c.id === id ? { ...c, archived: archived ? 1 : 0 } : c)) });
    },

    async setSetting(key, value) {
      set({ settings: { ...get().settings, [key]: value } });
      await write(() => repo().setSetting(key, value));
    },

    exportBackup: () => repo().exportAll(),

    async importBackup(b) {
      await repo().importAll(b);
      await load(repo());
    },
  };
});
