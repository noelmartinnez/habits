import { describe, expect, it } from "vitest";
import { addDaysKey, eachDayKey } from "../src/core/dates";
import { strength } from "../src/core/stats";
import type { CheckMap } from "../src/core/types";

const checks = (keys: Iterable<string>): CheckMap => new Map([...keys].map((k) => [k, null]));
const daily = (start: string) => ({ freq_type: "daily" as const, weekdays: 127, weekly_target: null, start_date: start });
const weekly = (start: string, n: number) => ({ freq_type: "weekly_count" as const, weekdays: 0, weekly_target: n, start_date: start });

const START = "2026-01-01";
const TODAY = "2026-09-27";
const everyDay = () => new Set(eachDayKey(START, TODAY));

describe("strength", () => {
  it("es 0 sin ninguna marca y antes de empezar", () => {
    expect(strength(daily(START), checks([]), TODAY)).toBe(0);
    expect(strength(daily("2026-10-01"), checks([]), TODAY)).toBe(0);
  });

  it("se acerca a 1 haciendo el hábito cada día", () => {
    expect(strength(daily(START), checks(everyDay()), TODAY)).toBeGreaterThan(0.99);
  });

  it("un fallo tras una racha larga apenas la baja", () => {
    const days = everyDay();
    days.delete(addDaysKey(TODAY, -1));
    const s = strength(daily(START), checks(days), TODAY);
    expect(s).toBeGreaterThan(0.9);
    expect(s).toBeLessThan(0.99);
  });

  it("se reduce a la mitad tras 13 días seguidos sin hacerlo", () => {
    const days = new Set(eachDayKey(START, "2026-09-14"));
    const before = strength(daily(START), checks(days), "2026-09-14");
    // Del 15 al 27 sin marcar (13 días); el 28 es hoy y aún no cuenta.
    const after = strength(daily(START), checks(days), "2026-09-28");
    expect(after / before).toBeCloseTo(0.5, 2);
  });

  it("hoy sin marcar no la baja", () => {
    const days = new Set(eachDayKey(START, "2026-09-26"));
    expect(strength(daily(START), checks(days), TODAY)).toBe(strength(daily(START), checks(days), "2026-09-26"));
  });

  it("semanal: cumplir el objetivo cada semana la lleva a 1; la semana en curso sin lograr no cuenta", () => {
    // Lunes y martes de cada semana, objetivo 2.
    const days = [...eachDayKey("2026-01-05", TODAY)].filter((_, i) => i % 7 < 2);
    const h = weekly("2026-01-05", 2);
    const s = strength(h, checks(days), TODAY);
    expect(s).toBeGreaterThan(0.99);
    // Miércoles 30: la semana en curso aún no llega al objetivo, así que no cuenta.
    expect(strength(h, checks(days), "2026-09-30")).toBeCloseTo(s, 10);
  });
});
