import { describe, expect, it } from "vitest";
import { BackupError, parseBackup } from "../src/core/backup";
import { convertRutinas } from "../scripts/export-rutinas.mjs";

// Filas tal y como las devuelve `sqlite3 -json` de la base de escritorio.
const desktop = {
  habits: [
    { id: 1, name: "Inglés", description: null, icon: "📘", color: "#2a78d6", freq_type: "daily", weekdays: 127, weekly_target: null, start_date: "2026-09-26", reminder_time: null, archived: 0, sort_order: 0, created_at: "2026-09-26T10:00:00.000Z", project_id: null },
    { id: 2, name: "Correr", description: "5 km", icon: null, color: "#4a3aa7", freq_type: "weekly_count", weekdays: 0, weekly_target: 3, start_date: "2026-09-26", reminder_time: "20:07", archived: 1, sort_order: 1, created_at: "2026-09-26T10:00:00.000Z", project_id: 3 },
  ],
  checkins: [
    { habit_id: 1, date: "2026-09-26", note: null },
    { habit_id: 2, date: "2026-09-27", note: "Cuesta arriba" },
    { habit_id: 99, date: "2026-09-27", note: null },
  ],
  settings: [
    { key: "theme", value: "dark" },
    { key: "notified_10", value: "2026-09-27" },
  ],
};

let n = 0;
const convert = () => convertRutinas(desktop, { uuid: () => `id-${++n}`, now: "2026-09-28T00:00:00.000Z" });

describe("importar Rutinas de escritorio", () => {
  it("convierte hábitos, marcas y tema, y la copia es válida", () => {
    n = 0;
    const b = parseBackup(convert());
    expect(b.habits.map((h) => [h.id, h.name, h.emoji, h.freq_type, h.weekly_target, h.reminder_time, h.archived])).toEqual([
      ["id-1", "Inglés", "📘", "daily", null, null, 0],
      ["id-2", "Correr", null, "weekly_count", 3, "20:07", 1],
    ]);
    expect(b.checkins).toEqual([
      { habit_id: "id-1", date: "2026-09-26", note: null },
      { habit_id: "id-2", date: "2026-09-27", note: "Cuesta arriba" },
    ]);
    expect(b.settings).toEqual({ theme: "dark" });
    expect(b.days).toEqual([]);
  });
});

describe("parseBackup", () => {
  const valid = () => {
    n = 0;
    return convert() as Record<string, unknown>;
  };

  it("rechaza archivos que no son copias", () => {
    expect(() => parseBackup({ foo: 1 })).toThrow(BackupError);
    expect(() => parseBackup(null)).toThrow("no es una copia");
  });

  it("rechaza copias de una versión más nueva", () => {
    expect(() => parseBackup({ ...valid(), version: 2 })).toThrow("versión más nueva");
  });

  it("rechaza marcas de hábitos que no existen", () => {
    const b = valid();
    expect(() => parseBackup({ ...b, checkins: [{ habit_id: "nadie", date: "2026-09-27", note: null }] })).toThrow("la marca nº 1");
  });

  it("rechaza ánimos fuera de 1..5", () => {
    expect(() => parseBackup({ ...valid(), days: [{ date: "2026-09-27", mood: 7 }] })).toThrow("el día nº 1");
  });

  it("acepta días, fichas y motivos", () => {
    const b = parseBackup({
      ...valid(),
      days: [{ date: "2026-09-27", mood: 2, note: null, closed_at: "2026-09-27T22:00:00.000Z" }],
      day_contexts: [{ date: "2026-09-27", context_id: "sleep" }],
      habit_misses: [{ habit_id: "id-1", date: "2026-09-27", context_id: "sleep" }],
    });
    expect(b.days[0].mood).toBe(2);
    expect(b.habit_misses).toHaveLength(1);
  });
});
