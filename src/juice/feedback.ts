import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";

/**
 * Sonido y vibración de la app, al estilo Balatro: cada hábito marcado sube una nota,
 * y la intensidad crece con lo que pasa (marcar < completar el día < hito de racha).
 * Los sonidos se generan con `scripts/gen-sounds.mjs`.
 */
const SOURCES = {
  "note-0": require("../../assets/sounds/note-0.wav"),
  "note-1": require("../../assets/sounds/note-1.wav"),
  "note-2": require("../../assets/sounds/note-2.wav"),
  "note-3": require("../../assets/sounds/note-3.wav"),
  "note-4": require("../../assets/sounds/note-4.wav"),
  "note-5": require("../../assets/sounds/note-5.wav"),
  "note-6": require("../../assets/sounds/note-6.wav"),
  "note-7": require("../../assets/sounds/note-7.wav"),
  "note-8": require("../../assets/sounds/note-8.wav"),
  "note-9": require("../../assets/sounds/note-9.wav"),
  undo: require("../../assets/sounds/undo.wav"),
  complete: require("../../assets/sounds/complete.wav"),
  milestone: require("../../assets/sounds/milestone.wav"),
  close: require("../../assets/sounds/close.wav"),
  tap: require("../../assets/sounds/tap.wav"),
} as const;

type Sound = keyof typeof SOURCES;
const NOTES = 10;

export interface FeedbackPrefs {
  sound: boolean;
  haptics: boolean;
  /** 0..1 */
  volume: number;
}

let prefs: FeedbackPrefs = { sound: true, haptics: true, volume: 0.7 };
const players: Partial<Record<Sound, AudioPlayer>> = {};
let started = false;

/** Prepara los reproductores una sola vez, al arrancar, para que el primer sonido no llegue tarde. */
export async function initFeedback() {
  if (started) return;
  started = true;
  // Respeta el interruptor de silencio del iPhone y no corta la música que esté sonando.
  await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => {});
  for (const [name, source] of Object.entries(SOURCES) as [Sound, number][]) {
    try {
      players[name] = createAudioPlayer(source);
    } catch {
      // Sin ese sonido la app sigue funcionando.
    }
  }
}

export function setFeedbackPrefs(p: Partial<FeedbackPrefs>) {
  prefs = { ...prefs, ...p };
}

function play(name: Sound, gain = 1) {
  if (!prefs.sound) return;
  const p = players[name];
  if (!p) return;
  try {
    // Un poco de variación para que el mismo sonido repetido no canse.
    p.volume = Math.min(1, prefs.volume * gain * (0.92 + Math.random() * 0.08));
    if (p.currentTime > 0) void p.seekTo(0);
    p.play();
  } catch {
    // Un sonido que falla no debe romper nada.
  }
}

function buzz(fn: () => Promise<void>) {
  if (prefs.haptics) fn().catch(() => {});
}

const later = (ms: number, fn: () => void) => setTimeout(fn, ms);

export const feedback = {
  /**
   * Hábito marcado. `done` es cuántos van hoy contando este, `total` cuántos tocan hoy.
   * `milestone` si con este se alcanza una racha que celebrar.
   */
  check(done: number, total: number, milestone = false) {
    const n = Math.max(0, Math.min(NOTES - 1, done - 1));
    play(`note-${n}` as Sound);
    buzz(() => Haptics.impactAsync(done >= total ? Haptics.ImpactFeedbackStyle.Heavy : done > total / 2 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light));
    if (milestone) {
      later(110, () => {
        play("milestone");
        buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      });
    } else if (total > 1 && done >= total) {
      later(110, () => {
        play("complete");
        buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      });
    }
  },

  uncheck() {
    play("undo");
    buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
  },

  /** Elegir una ficha o un ánimo: suben las notas según cuántas llevas elegidas. */
  select(nth: number) {
    play(`note-${Math.max(0, Math.min(NOTES - 1, nth))}` as Sound, 0.55);
    buzz(() => Haptics.selectionAsync());
  },

  tap() {
    play("tap");
    buzz(() => Haptics.selectionAsync());
  },

  closeDay() {
    play("close");
    buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },

  /** Revelar un descubrimiento (la «mano» semanal): cada uno una nota más arriba. */
  reveal(nth: number) {
    play(`note-${Math.max(0, Math.min(NOTES - 1, nth + 3))}` as Sound, 0.8);
    buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
  },
};
