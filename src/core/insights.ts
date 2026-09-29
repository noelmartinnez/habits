import { addDaysKey } from "./dates";
import { isScheduled } from "./schedule";
import { dayCompletion } from "./stats";
import type { CheckMap, Context, DayEntry, Habit } from "./types";

/**
 * Descubrimientos: comparaciones sencillas y honestas entre días con y sin algo.
 * Solo se muestra lo que tiene muestra suficiente y una diferencia que merezca la pena,
 * y siempre se dice con cuántos días se ha calculado.
 */

/** Mínimo de días en cada lado de una comparación. */
export const MIN_GROUP = 5;
/** Mínimo de días cerrados para empezar a buscar patrones. */
export const MIN_DAYS = 14;
/** Diferencia mínima en cumplimiento (0..1) para contarla. */
export const MIN_RATE_DIFF = 0.15;
/** Diferencia mínima de ánimo (escala 1..5) para contarla: el equivalente a 15 puntos sobre 100. */
export const MIN_MOOD_DIFF = 0.6;
/** Veces mínimas que se repite un motivo de fallo para comentarlo. */
export const MIN_REASON_COUNT = 3;

export type InsightKind = "context-completion" | "context-mood" | "context-next-mood" | "habit-mood" | "miss-reason";

export interface Insight {
  /** Estable entre cálculos: sirve para saber si ya se había enseñado. */
  id: string;
  kind: InsightKind;
  emoji: string;
  text: string;
  /** Con qué datos se ha calculado. */
  basis: string;
  /** Sube o baja lo que se mide (cumplimiento o ánimo) cuando se da la condición. */
  direction: "up" | "down";
  /** Para ordenar: tamaño del efecto × √(muestra menor). */
  score: number;
}

export interface InsightInput {
  /** Cada hábito con su inicio efectivo (ver `withHistory`) y sus marcas. */
  habits: { h: Habit; checks: CheckMap }[];
  days: Record<string, DayEntry>;
  dayContexts: Record<string, string[]>;
  misses: Record<string, Record<string, string>>;
  contexts: Context[];
  today: string;
}

export interface InsightResult {
  insights: Insight[];
  /** Días cerrados que se han podido usar. */
  closedDays: number;
  /** Cuántos faltan para los patrones de días (0 si ya hay bastantes). */
  daysMissing: number;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;
const mood1 = (x: number) => x.toFixed(1).replace(".", ",");
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const days = (n: number) => (n === 1 ? "1 día" : `${n} días`);

export function computeInsights(input: InsightInput): InsightResult {
  const { habits, contexts, today } = input;
  const ctxById = new Map(contexts.map((c) => [c.id, c]));

  // Días cerrados hasta hoy: solo en esos sabemos qué fichas hubo (y cuáles no).
  const closed = Object.values(input.days)
    .filter((d) => d.closed_at && d.date <= today)
    .map((d) => d.date)
    .sort();
  const closedSet = new Set(closed);
  const ctxOn = (date: string) => new Set(input.dayContexts[date] ?? []);
  const moodOf = (date: string) => input.days[date]?.mood ?? null;
  const insights: Insight[] = [];

  if (closed.length >= MIN_DAYS) {
    const rate = new Map<string, number>();
    for (const d of closed) {
      const c = dayCompletion(habits, d);
      if (c.due > 0) rate.set(d, c.done / c.due);
    }

    for (const ctx of contexts) {
      const label = `${ctx.emoji} ${ctx.label}`;

      // 1. Cumplimiento los días con esta ficha frente al resto.
      const withR: number[] = [];
      const withoutR: number[] = [];
      for (const [d, r] of rate) (ctxOn(d).has(ctx.id) ? withR : withoutR).push(r);
      if (withR.length >= MIN_GROUP && withoutR.length >= MIN_GROUP) {
        const a = mean(withR);
        const b = mean(withoutR);
        if (Math.abs(a - b) >= MIN_RATE_DIFF) {
          insights.push({
            id: `context-completion:${ctx.id}`,
            kind: "context-completion",
            emoji: ctx.emoji,
            text: `Los días con ${label} haces el ${pct(a)} de tus hábitos; el resto de días, el ${pct(b)}.`,
            basis: `${days(withR.length)} con «${ctx.label}» y ${days(withoutR.length)} sin`,
            direction: a > b ? "up" : "down",
            score: Math.abs(a - b) * Math.sqrt(Math.min(withR.length, withoutR.length)),
          });
        }
      }

      // 2. Ánimo el mismo día y 3. ánimo al día siguiente.
      for (const lag of [0, 1] as const) {
        const withM: number[] = [];
        const withoutM: number[] = [];
        for (const d of closed) {
          const target = addDaysKey(d, lag);
          if (lag === 1 && !closedSet.has(target)) continue;
          const m = moodOf(target);
          if (m === null) continue;
          (ctxOn(d).has(ctx.id) ? withM : withoutM).push(m);
        }
        if (withM.length < MIN_GROUP || withoutM.length < MIN_GROUP) continue;
        const a = mean(withM);
        const b = mean(withoutM);
        if (Math.abs(a - b) < MIN_MOOD_DIFF) continue;
        const up = a > b;
        insights.push({
          id: `${lag ? "context-next-mood" : "context-mood"}:${ctx.id}`,
          kind: lag ? "context-next-mood" : "context-mood",
          emoji: ctx.emoji,
          text: lag
            ? `Después de un día con ${label}, tu ánimo al día siguiente ${up ? "sube" : "baja"}: ${mood1(a)} frente a ${mood1(b)}.`
            : `Los días con ${label} tu ánimo ${up ? "sube" : "baja"}: ${mood1(a)} frente a ${mood1(b)} de media.`,
          basis: `${days(withM.length)} con «${ctx.label}» y ${days(withoutM.length)} sin`,
          direction: up ? "up" : "down",
          score: (Math.abs(a - b) / 4) * Math.sqrt(Math.min(withM.length, withoutM.length)),
        });
      }
    }

    // 4. Ánimo los días que se hace cada hábito frente a los que tocaba y no se hizo.
    for (const { h, checks } of habits) {
      if (h.archived || h.freq_type === "weekly_count") continue;
      const doneM: number[] = [];
      const missM: number[] = [];
      for (const d of closed) {
        if (d < h.start_date || !isScheduled(h, d)) continue;
        const m = moodOf(d);
        if (m === null) continue;
        (checks.has(d) ? doneM : missM).push(m);
      }
      if (doneM.length < MIN_GROUP || missM.length < MIN_GROUP) continue;
      const a = mean(doneM);
      const b = mean(missM);
      if (Math.abs(a - b) < MIN_MOOD_DIFF) continue;
      const name = `${h.emoji ? `${h.emoji} ` : ""}${h.name}`;
      insights.push({
        id: `habit-mood:${h.id}`,
        kind: "habit-mood",
        emoji: h.emoji ?? "✨",
        text:
          a > b
            ? `Los días que haces ${name} tu ánimo es de ${mood1(a)}; cuando no, de ${mood1(b)}.`
            : `Curioso: los días que haces ${name} tu ánimo es más bajo (${mood1(a)} frente a ${mood1(b)}).`,
        basis: `${days(doneM.length)} hecho y ${days(missM.length)} sin hacer`,
        direction: a > b ? "up" : "down",
        score: (Math.abs(a - b) / 4) * Math.sqrt(Math.min(doneM.length, missM.length)),
      });
    }
  }

  // 5. El motivo que más se repite al fallar cada hábito (no necesita tantos días).
  for (const { h } of habits) {
    if (h.archived) continue;
    const counts = new Map<string, number>();
    let total = 0;
    for (const byHabit of Object.values(input.misses)) {
      const ctx = byHabit[h.id];
      if (!ctx || !ctxById.has(ctx)) continue;
      counts.set(ctx, (counts.get(ctx) ?? 0) + 1);
      total++;
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!top || top[1] < MIN_REASON_COUNT || top[1] / total < 0.4) continue;
    const ctx = ctxById.get(top[0])!;
    const share = top[1] / total;
    const name = `${h.emoji ? `${h.emoji} ` : ""}${h.name}`;
    const part = share >= 0.95 ? "siempre" : share >= 0.7 ? "casi siempre" : share >= 0.5 ? "la mayoría de las veces" : "a menudo";
    insights.push({
      id: `miss-reason:${h.id}:${ctx.id}`,
      kind: "miss-reason",
      emoji: ctx.emoji,
      text: `Cuando no haces ${name}, ${part} es por ${ctx.emoji} ${ctx.label.toLowerCase()}.`,
      basis: `${top[1]} de ${total} veces que no lo hiciste`,
      direction: "down",
      score: share * Math.sqrt(top[1]) * 0.5,
    });
  }

  insights.sort((a, b) => b.score - a.score);
  return { insights, closedDays: closed.length, daysMissing: Math.max(0, MIN_DAYS - closed.length) };
}
