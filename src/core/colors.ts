import { clampChroma, formatHex, oklch } from "culori";

/** Paleta de hábitos (validada para daltonismo y contraste). Se guarda el tono claro; en oscuro se usa su pareja. */
export const HABIT_COLORS: { light: string; dark: string; name: string }[] = [
  { light: "#2a78d6", dark: "#3987e5", name: "Azul" },
  { light: "#eb6834", dark: "#d95926", name: "Naranja" },
  { light: "#1baf7a", dark: "#199e70", name: "Aguamarina" },
  { light: "#eda100", dark: "#c98500", name: "Amarillo" },
  { light: "#e87ba4", dark: "#d55181", name: "Rosa" },
  { light: "#008300", dark: "#008300", name: "Verde" },
  { light: "#4a3aa7", dark: "#9085e9", name: "Violeta" },
  { light: "#e34948", dark: "#e66767", name: "Rojo" },
];

/** Luminosidad OKLCH admitida para que un color personalizado se vea sobre el fondo de cada tema. */
const LIGHTNESS = { light: [0.4, 0.8], dark: [0.58, 0.86] } as const;

const cache = new Map<string, string>();

/**
 * Color listo para pintar en el tema actual. Los de la paleta usan su pareja fija; los personalizados
 * se aclaran u oscurecen lo justo (en OKLCH, conservando el tono) si no se distinguirían del fondo.
 */
export function habitColor(hex: string, dark: boolean): string {
  const preset = HABIT_COLORS.find((c) => c.light.toLowerCase() === hex.toLowerCase());
  if (preset) return dark ? preset.dark : preset.light;

  const key = `${hex}|${dark}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const c = oklch(hex);
  let out = hex;
  if (c) {
    const [min, max] = LIGHTNESS[dark ? "dark" : "light"];
    const l = Math.min(max, Math.max(min, c.l));
    if (l !== c.l) out = formatHex(clampChroma({ ...c, l }, "oklch"));
  }
  cache.set(key, out);
  return out;
}

/** Color de texto legible sobre un relleno del color dado. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.3 ? "#17202B" : "#FFFFFF";
}

/** Siguiente color de la paleta para algo nuevo (proyecto, etiqueta), rotando según cuántos hay. */
export const nextPaletteColor = (count: number) => HABIT_COLORS[count % HABIT_COLORS.length].light;

export const isHexColor = (s: string) => /^#[0-9a-f]{6}$/i.test(s);
