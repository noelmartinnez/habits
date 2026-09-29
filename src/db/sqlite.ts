import { randomUUID } from "expo-crypto";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { BACKUP_VERSION, type Backup } from "../core/backup";
import type { Checkin, Context, DayContext, DayEntry, Habit, HabitInput, HabitMiss } from "../core/types";
import type { Repo } from "./repo";
import { MIGRATIONS } from "./schema";

const now = () => new Date().toISOString();

const inputParams = (i: HabitInput) => [i.name, i.emoji, i.color, i.freq_type, i.weekdays, i.weekly_target, i.reminder_time] as const;

async function migrate(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const version = row?.user_version ?? 0;
  for (let v = version; v < MIGRATIONS.length; v++) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(MIGRATIONS[v]);
      await tx.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export async function createSqliteRepo(): Promise<Repo> {
  const db = await openDatabaseAsync("rutinas.db");
  await migrate(db);

  const repo: Repo = {
    listHabits: () => db.getAllAsync<Habit>("SELECT * FROM habits ORDER BY sort_order, created_at"),

    async createHabit(input, startDate, sortOrder) {
      const habit: Habit = { ...input, id: randomUUID(), start_date: startDate, archived: 0, sort_order: sortOrder, created_at: now() };
      await db.runAsync(
        `INSERT INTO habits (id, name, emoji, color, freq_type, weekdays, weekly_target, reminder_time, start_date, archived, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        habit.id, ...inputParams(input), startDate, sortOrder, habit.created_at,
      );
      return habit;
    },

    async updateHabit(id, input) {
      await db.runAsync(
        "UPDATE habits SET name = ?, emoji = ?, color = ?, freq_type = ?, weekdays = ?, weekly_target = ?, reminder_time = ? WHERE id = ?",
        ...inputParams(input), id,
      );
    },

    async setArchived(id, archived) {
      await db.runAsync("UPDATE habits SET archived = ? WHERE id = ?", archived ? 1 : 0, id);
    },

    async deleteHabit(id) {
      await db.runAsync("DELETE FROM habits WHERE id = ?", id);
    },

    async setOrder(ids) {
      await db.withTransactionAsync(async () => {
        for (const [i, id] of ids.entries()) await db.runAsync("UPDATE habits SET sort_order = ? WHERE id = ?", i, id);
      });
    },

    listCheckins: () => db.getAllAsync<Checkin>("SELECT habit_id, date, note FROM checkins"),

    async addCheckin(habitId, date, note) {
      await db.runAsync("INSERT OR IGNORE INTO checkins (habit_id, date, note, created_at) VALUES (?, ?, ?, ?)", habitId, date, note, now());
      // Si se hizo, deja de tener sentido el motivo de no haberlo hecho.
      await db.runAsync("DELETE FROM habit_misses WHERE habit_id = ? AND date = ?", habitId, date);
    },

    async removeCheckin(habitId, date) {
      await db.runAsync("DELETE FROM checkins WHERE habit_id = ? AND date = ?", habitId, date);
    },

    async setNote(habitId, date, note) {
      await db.runAsync("UPDATE checkins SET note = ? WHERE habit_id = ? AND date = ?", note, habitId, date);
    },

    listDays: () => db.getAllAsync<DayEntry>("SELECT * FROM days"),
    listDayContexts: () => db.getAllAsync<DayContext>("SELECT * FROM day_contexts"),
    listMisses: () => db.getAllAsync<HabitMiss>("SELECT * FROM habit_misses"),

    async saveDay(entry, contextIds, misses) {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO days (date, mood, note, closed_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (date) DO UPDATE SET mood = excluded.mood, note = excluded.note, closed_at = excluded.closed_at`,
          entry.date, entry.mood, entry.note, entry.closed_at,
        );
        await db.runAsync("DELETE FROM day_contexts WHERE date = ?", entry.date);
        for (const id of contextIds) await db.runAsync("INSERT INTO day_contexts (date, context_id) VALUES (?, ?)", entry.date, id);
        await db.runAsync("DELETE FROM habit_misses WHERE date = ?", entry.date);
        for (const [habitId, contextId] of Object.entries(misses)) {
          await db.runAsync("INSERT INTO habit_misses (habit_id, date, context_id) VALUES (?, ?, ?)", habitId, entry.date, contextId);
        }
      });
    },

    async setMiss(habitId, date, contextId) {
      if (contextId === null) {
        await db.runAsync("DELETE FROM habit_misses WHERE habit_id = ? AND date = ?", habitId, date);
      } else {
        await db.runAsync(
          `INSERT INTO habit_misses (habit_id, date, context_id) VALUES (?, ?, ?)
           ON CONFLICT (habit_id, date) DO UPDATE SET context_id = excluded.context_id`,
          habitId, date, contextId,
        );
      }
    },

    listContexts: () => db.getAllAsync<Context>("SELECT * FROM contexts ORDER BY sort_order, label"),

    async createContext(input, sortOrder) {
      const ctx: Context = { ...input, id: randomUUID(), builtin: 0, archived: 0, sort_order: sortOrder };
      await db.runAsync("INSERT INTO contexts (id, label, emoji, builtin, archived, sort_order) VALUES (?, ?, ?, 0, 0, ?)", ctx.id, ctx.label, ctx.emoji, sortOrder);
      return ctx;
    },

    async updateContext(id, input) {
      await db.runAsync("UPDATE contexts SET label = ?, emoji = ? WHERE id = ?", input.label, input.emoji, id);
    },

    async setContextArchived(id, archived) {
      await db.runAsync("UPDATE contexts SET archived = ? WHERE id = ?", archived ? 1 : 0, id);
    },

    async getSettings() {
      const rows = await db.getAllAsync<{ key: string; value: string | null }>("SELECT key, value FROM settings");
      return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
    },

    async setSetting(key, value) {
      await db.runAsync("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", key, value);
    },

    async exportAll(): Promise<Backup> {
      const [habits, checkins, days, contexts, day_contexts, habit_misses, settings] = await Promise.all([
        repo.listHabits(),
        repo.listCheckins(),
        repo.listDays(),
        repo.listContexts(),
        repo.listDayContexts(),
        repo.listMisses(),
        repo.getSettings(),
      ]);
      return { app: "rutinas", version: BACKUP_VERSION, exported_at: now(), habits, checkins, days, contexts, day_contexts, habit_misses, settings };
    },

    async importAll(b) {
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.execAsync(`
          DELETE FROM habit_misses; DELETE FROM day_contexts; DELETE FROM days;
          DELETE FROM checkins; DELETE FROM habits; DELETE FROM contexts WHERE builtin = 0;
        `);
        for (const h of b.habits) {
          await tx.runAsync(
            `INSERT INTO habits (id, name, emoji, color, freq_type, weekdays, weekly_target, reminder_time, start_date, archived, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            h.id, ...inputParams(h), h.start_date, h.archived, h.sort_order, h.created_at,
          );
        }
        for (const c of b.checkins) {
          await tx.runAsync("INSERT OR IGNORE INTO checkins (habit_id, date, note, created_at) VALUES (?, ?, ?, ?)", c.habit_id, c.date, c.note, now());
        }
        for (const c of b.contexts) {
          // Las de serie ya existen: solo se copia si se archivaron o cambiaron de nombre.
          await tx.runAsync(
            `INSERT INTO contexts (id, label, emoji, builtin, archived, sort_order) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET label = excluded.label, emoji = excluded.emoji, archived = excluded.archived, sort_order = excluded.sort_order`,
            c.id, c.label, c.emoji, c.builtin, c.archived, c.sort_order,
          );
        }
        for (const d of b.days) {
          await tx.runAsync("INSERT OR REPLACE INTO days (date, mood, note, closed_at) VALUES (?, ?, ?, ?)", d.date, d.mood, d.note, d.closed_at);
        }
        const known = new Set((await tx.getAllAsync<{ id: string }>("SELECT id FROM contexts")).map((r) => r.id));
        for (const d of b.day_contexts) {
          if (known.has(d.context_id)) await tx.runAsync("INSERT OR IGNORE INTO day_contexts (date, context_id) VALUES (?, ?)", d.date, d.context_id);
        }
        for (const m of b.habit_misses) {
          if (known.has(m.context_id)) {
            await tx.runAsync("INSERT OR REPLACE INTO habit_misses (habit_id, date, context_id) VALUES (?, ?, ?)", m.habit_id, m.date, m.context_id);
          }
        }
        for (const [k, v] of Object.entries(b.settings)) {
          await tx.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", k, v);
        }
      });
    },
  };

  return repo;
}
