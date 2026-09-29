import { describe, expect, it } from "vitest";
import { dayState, effectiveStart, withHistory } from "../src/core/schedule";
import { periodStats, streaks } from "../src/core/stats";
import type { CheckMap } from "../src/core/types";

const checks = (...keys: string[]): CheckMap => new Map(keys.map((k) => [k, null]));
const daily = { freq_type: "daily" as const, weekdays: 127, weekly_target: null, start_date: "2026-09-26" };

describe("sin fecha de inicio: el historial empieza en el primer registro", () => {
  it("sin marcas anteriores, empieza el día de creación", () => {
    expect(effectiveStart(daily, checks("2026-09-26", "2026-09-27"))).toBe("2026-09-26");
  });

  it("una marca anterior a la creación adelanta el inicio", () => {
    expect(effectiveStart(daily, checks("2026-09-20", "2026-09-27"))).toBe("2026-09-20");
    expect(withHistory(daily, checks("2026-09-20")).start_date).toBe("2026-09-20");
  });

  it("no crea copias si no cambia nada", () => {
    expect(withHistory(daily, checks("2026-09-27"))).toBe(daily);
  });

  it("las rachas cuentan los registros antiguos", () => {
    const c = checks("2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26");
    expect(streaks(daily, c, "2026-09-27").current).toBe(1); // sin historial: solo desde la creación
    expect(streaks(withHistory(daily, c), c, "2026-09-27")).toEqual({ current: 5, best: 5, unit: "day" });
  });

  it("los huecos entre registros antiguos cuentan como fallo", () => {
    const c = checks("2026-09-20", "2026-09-26");
    const s = periodStats(withHistory(daily, c), c, "2026-09-20", "2026-09-26", "2026-09-27");
    expect(s).toEqual({ done: 2, expected: 7, rate: 2 / 7 });
  });
});

describe("dayState", () => {
  const h = withHistory(daily, checks("2026-09-24"));

  it("antes del primer registro: sin registro, pero se puede marcar", () => {
    expect(dayState(h, checks("2026-09-24"), "2026-09-10", "2026-09-27")).toBe("empty");
  });

  it("entre el primer registro y hoy, lo no marcado es fallo", () => {
    expect(dayState(h, checks("2026-09-24"), "2026-09-25", "2026-09-27")).toBe("missed");
    expect(dayState(h, checks("2026-09-24"), "2026-09-24", "2026-09-27")).toBe("done");
  });

  it("el futuro sigue bloqueado", () => {
    expect(dayState(h, checks(), "2026-09-28", "2026-09-27")).toBe("disabled");
  });
});
