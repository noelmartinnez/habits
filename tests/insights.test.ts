import { describe, expect, it } from "vitest";
import { addDaysKey, eachDayKey } from "../src/core/dates";
import { computeInsights, type InsightInput } from "../src/core/insights";
import type { CheckMap, Context, DayEntry, Habit } from "../src/core/types";

const ctx = (id: string, label: string, emoji: string): Context => ({ id, label, emoji, builtin: 1, archived: 0, sort_order: 0 });
const CONTEXTS = [ctx("sleep", "Dormí mal", "😴"), ctx("time", "Sin tiempo", "⏳"), ctx("social", "Plan social", "🎉")];

const habit = (id: string, name: string, start = "2026-09-01"): Habit => ({
  id,
  name,
  emoji: "🏃",
  color: "#2a78d6",
  freq_type: "daily",
  weekdays: 127,
  weekly_target: null,
  start_date: start,
  reminder_time: null,
  archived: 0,
  sort_order: 0,
  created_at: "",
});

/**
 * 20 días cerrados. Los días 0, 3, 6, 9, 12 y 15 se durmió mal: no se corre y el ánimo es 2.
 * El resto se corre y el ánimo es 4.
 */
function scenario(nDays = 20): InsightInput {
  const dates = [...eachDayKey("2026-09-01", addDaysKey("2026-09-01", nDays - 1))];
  const run: CheckMap = new Map();
  const days: Record<string, DayEntry> = {};
  const dayContexts: Record<string, string[]> = {};
  const misses: Record<string, Record<string, string>> = {};
  dates.forEach((d, i) => {
    const bad = i % 3 === 0 && i <= 15;
    if (!bad) run.set(d, null);
    else {
      dayContexts[d] = ["sleep"];
      misses[d] = { run: "sleep" };
    }
    days[d] = { date: d, mood: bad ? 2 : 4, note: null, closed_at: `${d}T22:00:00.000Z` };
  });
  return { habits: [{ h: habit("run", "Correr"), checks: run }], days, dayContexts, misses, contexts: CONTEXTS, today: dates[dates.length - 1] };
}

describe("computeInsights", () => {
  it("encuentra lo que pasa los días que se duerme mal", () => {
    const r = computeInsights(scenario());
    expect(r.closedDays).toBe(20);
    expect(r.daysMissing).toBe(0);
    const byId = Object.fromEntries(r.insights.map((i) => [i.id, i]));

    expect(byId["context-completion:sleep"].text).toBe("Los días con 😴 Dormí mal haces el 0 % de tus hábitos; el resto de días, el 100 %.");
    expect(byId["context-completion:sleep"].direction).toBe("down");
    expect(byId["context-completion:sleep"].basis).toBe("6 días con «Dormí mal» y 14 días sin");

    expect(byId["context-mood:sleep"].text).toBe("Los días con 😴 Dormí mal tu ánimo baja: 2,0 frente a 4,0 de media.");
    expect(byId["habit-mood:run"].text).toBe("Los días que haces 🏃 Correr tu ánimo es de 4,0; cuando no, de 2,0.");
    expect(byId["miss-reason:run:sleep"].text).toBe("Cuando no haces 🏃 Correr, siempre es por 😴 dormí mal.");
  });

  it("no inventa nada de las fichas que nunca se usan", () => {
    const r = computeInsights(scenario());
    expect(r.insights.some((i) => i.id.includes("time") || i.id.includes("social"))).toBe(false);
  });

  it("con pocos días cerrados no saca patrones de días, pero sí motivos repetidos", () => {
    const r = computeInsights(scenario(10));
    expect(r.closedDays).toBe(10);
    expect(r.daysMissing).toBe(4);
    expect(r.insights.map((i) => i.kind)).toEqual(["miss-reason"]);
  });

  it("ignora diferencias pequeñas", () => {
    const s = scenario();
    for (const d of Object.values(s.days)) d.mood = d.mood === 2 ? 3.8 : 4;
    const r = computeInsights(s);
    expect(r.insights.some((i) => i.kind === "context-mood" || i.kind === "habit-mood")).toBe(false);
  });

  it("los días sin cerrar no cuentan", () => {
    const s = scenario();
    for (const d of Object.values(s.days)) d.closed_at = null;
    const r = computeInsights(s);
    expect(r.closedDays).toBe(0);
    expect(r.insights.every((i) => i.kind === "miss-reason")).toBe(true);
  });

  it("el efecto al día siguiente usa el ánimo del día después", () => {
    const s = scenario();
    // Tras cada día malo, el siguiente es aún peor de ánimo.
    const dates = Object.keys(s.days).sort();
    dates.forEach((d, i) => {
      if (s.dayContexts[d]?.includes("sleep") && dates[i + 1]) s.days[dates[i + 1]].mood = 1;
    });
    const r = computeInsights(s);
    const next = r.insights.find((i) => i.id === "context-next-mood:sleep");
    expect(next?.direction).toBe("down");
  });
});
