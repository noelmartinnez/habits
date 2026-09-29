// Exporta los datos de Rutinas (escritorio, Tauri) a una copia que la app móvil sabe importar.
// Uso: node scripts/export-rutinas.mjs [ruta/a/rutinas.db] [salida.json]
// La base de datos se abre en solo lectura: la app de escritorio no se toca. Necesita Node 22.5 o superior (node:sqlite).
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Filas de la base de escritorio → copia de la app móvil (ids nuevos en UUID). */
export function convertRutinas({ habits, checkins, settings }, { uuid = randomUUID, now = new Date().toISOString() } = {}) {
  const ids = new Map(habits.map((h) => [h.id, uuid()]));
  return {
    app: "rutinas",
    version: 1,
    exported_at: now,
    habits: habits.map((h) => ({
      id: ids.get(h.id),
      name: h.name,
      emoji: h.icon ?? null,
      color: h.color,
      freq_type: h.freq_type,
      weekdays: h.weekdays,
      weekly_target: h.weekly_target ?? null,
      start_date: h.start_date,
      reminder_time: h.reminder_time ?? null,
      archived: h.archived ? 1 : 0,
      sort_order: h.sort_order,
      created_at: h.created_at,
    })),
    checkins: checkins.filter((c) => ids.has(c.habit_id)).map((c) => ({ habit_id: ids.get(c.habit_id), date: c.date, note: c.note ?? null })),
    days: [],
    contexts: [],
    day_contexts: [],
    habit_misses: [],
    // Solo lo que tiene sentido en el móvil; los avisos ya enviados son cosa de cada dispositivo.
    settings: Object.fromEntries(settings.filter((s) => s.key === "theme" && s.value).map((s) => [s.key, s.value])),
  };
}


if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2] ?? join(process.env.APPDATA ?? "", "com.rutinas.app", "rutinas.db");
  const db = new DatabaseSync(path, { readOnly: true });
  const query = (sql) => db.prepare(sql).all();
  const outFile = process.argv[3] ?? "rutinas-export.json";
  const backup = convertRutinas({
    habits: query("SELECT * FROM habits ORDER BY sort_order, id"),
    checkins: query("SELECT habit_id, date, note FROM checkins"),
    settings: query("SELECT key, value FROM settings"),
  });
  db.close();
  writeFileSync(outFile, JSON.stringify(backup, null, 2));
  console.log(`${backup.habits.length} hábitos y ${backup.checkins.length} marcas → ${outFile}`);
}
