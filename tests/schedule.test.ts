import { describe, expect, it } from "vitest";
import { describeFrequency, isScheduled } from "../src/core/schedule";

// 2026-09-21 es lunes.
const MWF = 1 | 4 | 16;

describe("isScheduled", () => {
  it("nunca antes de la fecha de inicio", () => {
    expect(isScheduled({ freq_type: "daily", weekdays: 127, start_date: "2026-09-10" }, "2026-09-09")).toBe(false);
    expect(isScheduled({ freq_type: "daily", weekdays: 127, start_date: "2026-09-10" }, "2026-09-10")).toBe(true);
  });

  it("respeta los días de la semana elegidos", () => {
    const h = { freq_type: "weekdays" as const, weekdays: MWF, start_date: "2026-01-01" };
    expect(isScheduled(h, "2026-09-21")).toBe(true); // lunes
    expect(isScheduled(h, "2026-09-22")).toBe(false); // martes
    expect(isScheduled(h, "2026-09-23")).toBe(true); // miércoles
    expect(isScheduled(h, "2026-09-27")).toBe(false); // domingo
  });

  it("en 'X veces por semana' cualquier día vale", () => {
    expect(isScheduled({ freq_type: "weekly_count", weekdays: 0, start_date: "2026-01-01" }, "2026-09-27")).toBe(true);
  });
});

describe("describeFrequency", () => {
  it("describe cada tipo", () => {
    expect(describeFrequency({ freq_type: "daily", weekdays: 127, weekly_target: null })).toBe("Todos los días");
    expect(describeFrequency({ freq_type: "weekdays", weekdays: 31, weekly_target: null })).toBe("De lunes a viernes");
    expect(describeFrequency({ freq_type: "weekdays", weekdays: MWF, weekly_target: null })).toBe("L, X, V");
    expect(describeFrequency({ freq_type: "weekly_count", weekdays: 0, weekly_target: 3 })).toBe("3 veces por semana");
  });
});
