import { useMemo } from "react";
import { describeFrequency, withHistory } from "../core/schedule";
import { isDueToday, streakUnit, streaks, weekCount } from "../core/stats";
import type { CheckMap, Habit } from "../core/types";
import { useStore } from "./useStore";

export const EMPTY: CheckMap = new Map();

export interface DayHabit {
  habit: Habit;
  /** El hábito con su inicio efectivo, listo para estadísticas. */
  h: Habit;
  checks: CheckMap;
  done: boolean;
  /** ¿Toca este día? */
  due: boolean;
  subtitle: string;
}

/** Resumen corto bajo el nombre: racha, progreso de la semana o frecuencia. */
export function habitSubtitle(h: Habit, checks: CheckMap, date: string): string {
  if (h.freq_type === "weekly_count") {
    return `${weekCount(h, checks, date)} de ${h.weekly_target ?? 1} esta semana`;
  }
  const s = streaks(h, checks, date);
  if (s.current > 0) return `🔥 ${s.current} ${streakUnit(s.unit, s.current)}`;
  return describeFrequency(h);
}

/** Hábitos activos de un día, en su orden. */
export function useDayHabits(date: string): DayHabit[] {
  const habits = useStore((s) => s.habits);
  const all = useStore((s) => s.checks);
  return useMemo(
    () =>
      habits
        .filter((habit) => !habit.archived)
        .map((habit) => {
          const checks = all[habit.id] ?? EMPTY;
          const h = withHistory(habit, checks);
          const done = checks.has(date);
          return { habit, h, checks, done, due: done || isDueToday(h, checks, date), subtitle: habitSubtitle(h, checks, date) };
        }),
    [habits, all, date],
  );
}
