import { describe, expect, it } from "vitest";
import { dayCompletion, isDueToday, monthlyRates, periodStats, streaks, weekCount, weekdayRates } from "../src/core/stats";
import type { CheckMap } from "../src/core/types";

const checks = (...keys: string[]): CheckMap => new Map(keys.map((k) => [k, null]));
const daily = (start: string) => ({ freq_type: "daily" as const, weekdays: 127, weekly_target: null, start_date: start });
const mwf = (start: string) => ({ freq_type: "weekdays" as const, weekdays: 1 | 4 | 16, weekly_target: null, start_date: start });
const weekly = (start: string, n: number) => ({ freq_type: "weekly_count" as const, weekdays: 0, weekly_target: n, start_date: start });

// 2026-09-21 lunes … 2026-09-27 domingo
describe("streaks diarios", () => {
  it("cuenta días seguidos hasta hoy", () => {
    const s = streaks(daily("2026-09-20"), checks("2026-09-24", "2026-09-25", "2026-09-26"), "2026-09-26");
    expect(s).toEqual({ current: 3, best: 3, unit: "day" });
  });

  it("hoy sin marcar no rompe la racha", () => {
    const s = streaks(daily("2026-09-20"), checks("2026-09-24", "2026-09-25"), "2026-09-26");
    expect(s.current).toBe(2);
  });

  it("un hueco rompe la racha actual pero guarda la mejor", () => {
    const c = checks("2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-25", "2026-09-26");
    expect(streaks(daily("2026-09-20"), c, "2026-09-26")).toEqual({ current: 2, best: 4, unit: "day" });
  });

  it("atraviesa cambios de mes y de año", () => {
    const c = checks("2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02");
    expect(streaks(daily("2025-12-30"), c, "2026-01-02").current).toBe(4);
  });

  it("antes de la fecha de inicio todo es cero", () => {
    expect(streaks(daily("2026-10-01"), checks(), "2026-09-26")).toEqual({ current: 0, best: 0, unit: "day" });
  });
});

describe("streaks con días concretos", () => {
  it("los días no programados no rompen la racha", () => {
    // L, X, V hechos; mar, jue, sáb vacíos
    const c = checks("2026-09-21", "2026-09-23", "2026-09-25");
    expect(streaks(mwf("2026-09-21"), c, "2026-09-26").current).toBe(3);
  });

  it("fallar un día programado sí la rompe", () => {
    const c = checks("2026-09-21", "2026-09-25");
    expect(streaks(mwf("2026-09-21"), c, "2026-09-26")).toEqual({ current: 1, best: 1, unit: "day" });
  });
});

describe("streaks semanales", () => {
  const h = weekly("2026-09-07", 2);
  it("cuenta semanas que alcanzan el objetivo", () => {
    const c = checks("2026-09-07", "2026-09-09", "2026-09-15", "2026-09-18");
    expect(streaks(h, c, "2026-09-22")).toEqual({ current: 2, best: 2, unit: "week" });
  });

  it("la semana en curso suma si ya se logró", () => {
    const c = checks("2026-09-07", "2026-09-09", "2026-09-15", "2026-09-18", "2026-09-21", "2026-09-22");
    expect(streaks(h, c, "2026-09-22").current).toBe(3);
  });

  it("una semana fallida rompe la racha", () => {
    const c = checks("2026-09-07", "2026-09-09", "2026-09-15", "2026-09-21", "2026-09-22");
    expect(streaks(h, c, "2026-09-26")).toEqual({ current: 1, best: 1, unit: "week" });
  });

  it("weekCount ignora días anteriores al inicio", () => {
    expect(weekCount(weekly("2026-09-23", 3), checks("2026-09-21", "2026-09-23"), "2026-09-26")).toBe(1);
  });
});

describe("periodStats", () => {
  it("excluye hoy si no está marcado", () => {
    const s = periodStats(daily("2026-09-21"), checks("2026-09-21", "2026-09-22"), "2026-09-01", "2026-09-30", "2026-09-24");
    expect(s).toEqual({ done: 2, expected: 3, rate: 2 / 3 });
  });

  it("incluye hoy si está marcado", () => {
    const s = periodStats(daily("2026-09-21"), checks("2026-09-21", "2026-09-24"), "2026-09-01", "2026-09-30", "2026-09-24");
    expect(s).toEqual({ done: 2, expected: 4, rate: 0.5 });
  });

  it("solo cuenta días programados", () => {
    const s = periodStats(mwf("2026-09-21"), checks("2026-09-21", "2026-09-22"), "2026-09-21", "2026-09-27", "2026-09-27");
    expect(s).toEqual({ done: 1, expected: 3, rate: 1 / 3 });
  });

  it("sin días transcurridos devuelve rate null", () => {
    expect(periodStats(daily("2026-09-24"), checks(), "2026-09-01", "2026-09-30", "2026-09-24").rate).toBeNull();
  });

  it("semanal: limita al 100 %", () => {
    const c = checks("2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27");
    expect(periodStats(weekly("2026-09-21", 3), c, "2026-09-21", "2026-09-27", "2026-09-27").rate).toBe(1);
  });
});

describe("agregados", () => {
  it("monthlyRates devuelve 12 meses acabando en el actual", () => {
    const pts = monthlyRates(daily("2026-09-01"), checks("2026-09-01"), "2026-09-02");
    expect(pts).toHaveLength(12);
    expect(pts[11].key).toBe("2026-09-01");
    expect(pts[11].rate).toBe(1);
    expect(pts[10].rate).toBeNull();
  });

  it("weekdayRates reparte por día de la semana", () => {
    const pts = weekdayRates(daily("2026-09-21"), checks("2026-09-21"), "2026-09-27");
    expect(pts[0]).toMatchObject({ done: 1, scheduled: 1, rate: 1 });
    expect(pts[1]).toMatchObject({ done: 0, scheduled: 1, rate: 0 });
    expect(pts[6]).toMatchObject({ done: 0, scheduled: 0, rate: null }); // domingo = hoy sin marcar
  });

  it("isDueToday para semanal: deja de estar pendiente al lograr el objetivo", () => {
    const h = weekly("2026-09-21", 2);
    expect(isDueToday(h, checks("2026-09-21"), "2026-09-23")).toBe(true);
    expect(isDueToday(h, checks("2026-09-21", "2026-09-22"), "2026-09-23")).toBe(false);
    expect(isDueToday(mwf("2026-09-21"), checks(), "2026-09-22")).toBe(false);
  });
});

describe("dayCompletion", () => {
  it("cuenta lo que tocaba y lo hecho", () => {
    const items = [
      { h: daily("2026-09-20"), checks: checks("2026-09-22") },
      { h: daily("2026-09-20"), checks: checks() },
      { h: mwf("2026-09-20"), checks: checks() }, // martes: no toca
      { h: weekly("2026-09-20", 3), checks: checks() }, // semanal sin hacer: no es fallo
      { h: daily("2026-09-25"), checks: checks() }, // aún no existía
    ];
    expect(dayCompletion(items, "2026-09-22")).toEqual({ done: 1, due: 2 });
  });

  it("lo hecho en un día que no tocaba suma a las dos cuentas", () => {
    const items = [{ h: mwf("2026-09-20"), checks: checks("2026-09-22") }, { h: weekly("2026-09-20", 3), checks: checks("2026-09-22") }];
    expect(dayCompletion(items, "2026-09-22")).toEqual({ done: 2, due: 2 });
  });
});
