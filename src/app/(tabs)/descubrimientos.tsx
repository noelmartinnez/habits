import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FlipInXDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { weekStartKey } from "../../core/dates";
import { computeInsights, type Insight, MIN_DAYS } from "../../core/insights";
import { withHistory } from "../../core/schedule";
import { feedback } from "../../juice/feedback";
import { EMPTY } from "../../store/selectors";
import { useStore } from "../../store/useStore";
import { Button, Card, Txt } from "../../ui/primitives";
import { MOODS, radius, useTheme } from "../../ui/theme";

/** Pausa entre carta y carta al revelar la mano de la semana. */
const REVEAL_STEP_MS = 520;

function parseSeen(raw: string | undefined): string[] {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function Discoveries() {
  const habits = useStore((s) => s.habits);
  const checks = useStore((s) => s.checks);
  const days = useStore((s) => s.days);
  const dayContexts = useStore((s) => s.dayContexts);
  const misses = useStore((s) => s.misses);
  const contexts = useStore((s) => s.contexts);
  const today = useStore((s) => s.today);
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const result = useMemo(
    () =>
      computeInsights({
        habits: habits.map((h) => ({ h: withHistory(h, checks[h.id] ?? EMPTY), checks: checks[h.id] ?? EMPTY })),
        days,
        dayContexts,
        misses,
        contexts,
        today,
      }),
    [habits, checks, days, dayContexts, misses, contexts, today],
  );

  const seen = useMemo(() => parseSeen(settings.insights_seen), [settings.insights_seen]);
  const fresh = result.insights.filter((i) => !seen.includes(i.id));
  const week = weekStartKey(today);
  // La mano se reparte una vez por semana, y solo si hay algo nuevo que enseñar.
  const handReady = fresh.length > 0 && settings.insights_week !== week;

  const [revealing, setRevealing] = useState(false);
  const [shown, setShown] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const hand = fresh.slice(0, 5);

  function reveal() {
    setRevealing(true);
    setShown(0);
    hand.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => {
          setShown(i + 1);
          feedback.reveal(i);
        }, 300 + i * REVEAL_STEP_MS),
      );
    });
    timers.current.push(
      setTimeout(
        () => {
          feedback.check(hand.length + 1, hand.length + 1);
          void setSetting("insights_week", week);
          void setSetting("insights_seen", JSON.stringify([...new Set([...seen, ...hand.map((h) => h.id)])]));
        },
        300 + hand.length * REVEAL_STEP_MS + 200,
      ),
    );
  }

  const rest = result.insights.filter((i) => !(revealing && hand.some((h) => h.id === i.id)));

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <View style={{ gap: 4 }}>
        <Txt variant="display">Descubrimientos</Txt>
        <Txt tone="muted">Lo que tus días dicen de ti. Se calcula en tu teléfono; no sale de él.</Txt>
      </View>

      {result.daysMissing > 0 && <Progress closed={result.closedDays} />}

      {revealing ? (
        <View style={{ gap: 12 }}>
          <Txt variant="caption" tone="muted" style={styles.section}>
            TU MANO DE LA SEMANA
          </Txt>
          {hand.slice(0, shown).map((i, n) => (
            <Animated.View key={i.id} entering={FlipInXDown.springify().damping(12)}>
              <InsightCard insight={i} highlight index={n} />
            </Animated.View>
          ))}
        </View>
      ) : handReady ? (
        <Animated.View entering={ZoomIn.springify().damping(10)}>
          <Card style={[styles.hand, { borderColor: c.ink }]}>
            <View style={styles.deck}>
              {hand.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.cardBack,
                    { backgroundColor: c.accent, transform: [{ rotate: `${(i - (hand.length - 1) / 2) * 7}deg` }, { translateY: Math.abs(i - (hand.length - 1) / 2) * 4 }] },
                  ]}
                >
                  <Ionicons name="sparkles" size={18} color={c.onAccent} />
                </View>
              ))}
            </View>
            <Txt variant="title" style={{ textAlign: "center" }}>
              {hand.length === 1 ? "Tienes 1 descubrimiento nuevo" : `Tienes ${hand.length} descubrimientos nuevos`}
            </Txt>
            <Button label="Revelar" onPress={reveal} style={{ alignSelf: "stretch" }} />
          </Card>
        </Animated.View>
      ) : null}

      {(!handReady || revealing) && rest.length > 0 && (
        <View style={{ gap: 12 }}>
          {revealing ? (
            <Txt variant="caption" tone="muted" style={styles.section}>
              ANTERIORES
            </Txt>
          ) : null}
          {rest.map((i, n) => (
            <Animated.View key={i.id} entering={FadeIn.delay(n * 40)}>
              <InsightCard insight={i} fresh={!seen.includes(i.id)} />
            </Animated.View>
          ))}
        </View>
      )}

      {result.insights.length === 0 && result.daysMissing === 0 && (
        <Card style={{ gap: 6 }}>
          <Txt variant="label">Aún no hay nada claro</Txt>
          <Txt tone="muted">
            Con los días que llevas no se ve ninguna diferencia que merezca la pena. Sigue cerrando tus días y marcando qué pasó: los patrones aparecen solos.
          </Txt>
        </Card>
      )}
    </ScrollView>
  );
}

function Progress({ closed }: { closed: number }) {
  const { c } = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      <Txt variant="label">
        {closed === 0 ? "Cierra tu primer día para empezar" : `Llevas ${closed} de ${MIN_DAYS} días cerrados`}
      </Txt>
      <View style={styles.dots}>
        {Array.from({ length: MIN_DAYS }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i < closed ? MOODS[3].color : c.sunken }]} />
        ))}
      </View>
      <Txt variant="caption" tone="muted">
        Con {MIN_DAYS} días cerrados empezarás a ver qué hace que tus días vayan mejor o peor. Antes solo aparecerán los motivos que más se repiten.
      </Txt>
    </Card>
  );
}

function InsightCard({ insight, highlight, fresh, index = 0 }: { insight: Insight; highlight?: boolean; fresh?: boolean; index?: number }) {
  const { c } = useTheme();
  const up = insight.direction === "up";
  const tone = up ? MOODS[4].color : MOODS[0].color;
  return (
    <Card style={[styles.insight, highlight && { borderColor: tone, borderWidth: 2 }]}>
      <View style={[styles.insightEmoji, { backgroundColor: tone + "22" }]}>
        <Text style={{ fontSize: 26 }}>{insight.emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Txt variant="body" style={{ fontSize: 16 + (highlight && index === 0 ? 1 : 0) }}>
          {insight.text}
        </Txt>
        <View style={styles.basis}>
          <Ionicons name={up ? "trending-up" : "trending-down"} size={14} color={tone} />
          <Txt variant="caption" tone="faint" style={{ flex: 1 }}>
            {insight.basis}
          </Txt>
          {fresh ? (
            <View style={[styles.badge, { backgroundColor: c.accent }]}>
              <Txt variant="caption" color={c.onAccent}>
                Nuevo
              </Txt>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  section: { letterSpacing: 0.8, marginLeft: 4 },
  dots: { flexDirection: "row", gap: 4 },
  dot: { flex: 1, height: 10, borderRadius: 5 },
  hand: { alignItems: "center", gap: 18, paddingVertical: 24, borderWidth: 2 },
  deck: { flexDirection: "row", justifyContent: "center", height: 84, alignItems: "center" },
  cardBack: { width: 52, height: 76, borderRadius: 10, marginHorizontal: -8, alignItems: "center", justifyContent: "center" },
  insight: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  insightEmoji: { width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  basis: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
});
