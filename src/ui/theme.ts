import { useColorScheme } from "react-native";
import { useStore, type ThemePref } from "../store/useStore";

const light = {
  bg: "#f3f5f7",
  surface: "#ffffff",
  sunken: "#e9edf1",
  ink: "#17202b",
  muted: "#5e6a78",
  faint: "#a3adb9",
  line: "#dce2e8",
  miss: "#d98e8e",
  danger: "#c0392b",
  accent: "#17202b",
  onAccent: "#ffffff",
};

export type Colors = typeof light;

const dark: Colors = {
  bg: "#11151a",
  surface: "#1a2028",
  sunken: "#232a33",
  ink: "#e9edf2",
  muted: "#97a3b1",
  faint: "#56616e",
  line: "#2b333d",
  miss: "#8c4a4a",
  danger: "#e66767",
  accent: "#e9edf2",
  onAccent: "#11151a",
};

/** Ánimo 1..5: de rojo apagado a verde, legibles en ambos temas. */
export const MOODS = [
  { value: 1, emoji: "😣", label: "Muy mal", color: "#d9534f" },
  { value: 2, emoji: "😕", label: "Mal", color: "#e8903a" },
  { value: 3, emoji: "😐", label: "Normal", color: "#c9a227" },
  { value: 4, emoji: "🙂", label: "Bien", color: "#5fae4e" },
  { value: 5, emoji: "😄", label: "Muy bien", color: "#1f9d6b" },
] as const;

export const fonts = {
  display: "BricolageGrotesque_800ExtraBold",
  displayBold: "BricolageGrotesque_700Bold",
  regular: "Figtree_400Regular",
  medium: "Figtree_500Medium",
  semibold: "Figtree_600SemiBold",
  bold: "Figtree_700Bold",
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

/** Tema efectivo según el ajuste (sistema, claro u oscuro). */
export function useTheme(): { dark: boolean; c: Colors } {
  const system = useColorScheme();
  const pref = (useStore((s) => s.settings.theme) as ThemePref | undefined) ?? "system";
  const isDark = pref === "dark" || (pref === "system" && system === "dark");
  return { dark: isDark, c: isDark ? dark : light };
}
