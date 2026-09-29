import { describe, expect, it } from "vitest";
import { MAX_PENDING, planReminders, reminderDate } from "../src/core/reminders";
import type { CheckMap, Habit } from "../src/core/types";

const checks = (...keys: string[]): CheckMap => new Map(keys.map((k) => [k, null]));
const habit = (over: Partial<Habit>): Habit => ({
  id: "h",
  name: "Correr",
  emoji: "🏃",
  color: "#2a78d6",
  freq_type: "daily",
  weekdays: 127,
  weekly_target: null,
  start_date: "2026-09-01",
  reminder_time: "20:00",
  archived: 0,
  sort_order: 0,
  created_at: "",
  ...over,
});

// 2026-09-28 es lunes.
const base = { closeTime: null, closedDays: new Set<string>(), today: "2026-09-28", nowTime: "10:00" };

describe("planReminders", () => {
  it("un aviso diario durante 14 días, a su hora", () => {
    const r = planReminders({ ...base, habits: [{ h: habit({}), checks: checks() }] });
    expect(r).toHaveLength(14);
    expect(r[0]).toMatchObject({ habitId: "h", date: "2026-09-28", time: "20:00", title: "🏃 Correr" });
    expect(r[13].date).toBe("2026-10-11");
  });

  it("no avisa de lo ya hecho hoy ni de lo que ya ha pasado", () => {
    expect(planReminders({ ...base, habits: [{ h: habit({}), checks: checks("2026-09-28") }] })[0].date).toBe("2026-09-29");
    expect(planReminders({ ...base, nowTime: "20:00", habits: [{ h: habit({}), checks: checks() }] })[0].date).toBe("2026-09-29");
  });

  it("solo los días que tocan", () => {
    const r = planReminders({ ...base, habits: [{ h: habit({ freq_type: "weekdays", weekdays: 1 | 4 }), checks: checks() }] });
    // lunes y miércoles
    expect(r.map((x) => x.date)).toEqual(["2026-09-28", "2026-09-30", "2026-10-05", "2026-10-07"]);
  });

  it("veces por semana: calla cuando la semana está cumplida", () => {
    const h = habit({ freq_type: "weekly_count", weekly_target: 2 });
    const r = planReminders({ ...base, habits: [{ h, checks: checks("2026-09-28", "2026-09-29") }], today: "2026-09-30" });
    // Semana del 28 cumplida: el primero es el lunes siguiente.
    expect(r[0].date).toBe("2026-10-05");
  });

  it("sin hora de aviso o archivado, nada", () => {
    expect(planReminders({ ...base, habits: [{ h: habit({ reminder_time: null }), checks: checks() }] })).toEqual([]);
    expect(planReminders({ ...base, habits: [{ h: habit({ archived: 1 }), checks: checks() }] })).toEqual([]);
  });

  it("aviso de cerrar el día, salvo los días ya cerrados", () => {
    const r = planReminders({ ...base, habits: [], closeTime: "22:00", closedDays: new Set(["2026-09-28"]) });
    expect(r[0]).toMatchObject({ habitId: null, date: "2026-09-29", time: "22:00" });
  });

  it("nunca pasa del máximo de iOS y no deja días a medias", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ h: habit({ id: `h${i}` }), checks: checks() }));
    const r = planReminders({ ...base, habits: many, closeTime: "22:00" });
    expect(r.length).toBeLessThanOrEqual(MAX_PENDING);
    expect(r.length % 8).toBe(0);
  });

  it("reminderDate da la hora local", () => {
    const d = reminderDate({ date: "2026-09-28", time: "07:05" });
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 8, 28, 7, 5]);
  });
});
