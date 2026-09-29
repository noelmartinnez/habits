import { getDocumentAsync } from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { shareAsync } from "expo-sharing";
import { type Backup, parseBackup } from "../core/backup";

/** Guarda la copia en un archivo y abre el menú de compartir (Archivos, iCloud Drive, correo…). */
export async function shareBackup(b: Backup): Promise<void> {
  const file = new File(Paths.cache, `rutinas-copia-${b.exported_at.slice(0, 10)}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(b, null, 2));
  await shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json", dialogTitle: "Guardar copia de Rutinas" });
}

/** Deja elegir un archivo y lo devuelve comprobado, o null si se cancela. Lanza `BackupError` si no vale. */
export async function pickBackup(): Promise<Backup | null> {
  const res = await getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;
  const text = await new File(res.assets[0].uri).text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  return parseBackup(raw);
}
