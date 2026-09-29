import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { habitColor } from "../../core/colors";
import { fromKey } from "../../core/dates";
import { dayState, describeFrequency, WEEKDAY_SHORT, withHistory } from "../../core/schedule";
import { periodStats, strength, streakUnit, streaks, weekdayRates } from "../../core/stats";
import { feedback } from "../../juice/feedback";
import { EMPTY } from "../../store/selectors";
import { useStore } from "../../store/useStore";
import { MonthGrid } from "../../ui/MonthGrid";
import { Card, PressableScale, Txt } from "../../ui/primitives";
import { radius, useTheme } from "../../ui/theme";

export default function HabitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useStore((s) => s.habits.find((h) => h.id === id));
  const checks = useStore((s) => s.checks[id] ?? EMPTY);
  const misses = useStore((s) => s.misses);
  const contexts = useStore((s) => s.contexts);
  const today = useStore((s) => s.today);
  const toggle = useStore((s) => s.toggle);
  const { c, dark } = useTheme();
  const [month, setMonth] = useState(() => fromKey(today));

  const stats = useMemo(() => {
    if (!habit) return null;
    const h = withHistory(habit, checks);
    const s = streaks(h, checks, today);
    const all = periodStats(h, checks, h.start_date, today, today);
    // Motivos de fallo de este hábito, del más frecuente al menos.
    const counts = new Map<string, number>();
    for (const byHabit of Object.values(misses)) {
      const ctx = byHabit[habit.id];
      if (ctx) counts.set(ctx, (counts.get(ctx) ?? 0) + 1);
    }
    const reasons = [...counts.entries()]
      .map(([ctxId, n]) => ({ ctx: contexts.find((x) => x.id === ctxId), n }))
      .filter((r) => r.ctx)
      .sort((a, b) => b.n - a.n)
      .slice(0, 4);
    return { h, s, all, strength: strength(h, checks, today), weekdays: weekdayRates(h, checks, today), reasons };
  }, [habit, checks, misses, contexts, today]);

  if (!habit || !stats) return null;
  const color = habitColor(habit.color, dark);
  const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <PressableScale onPress={() => router.push({ pathname: "/habito/editar", params: { id: habit.id } })} hitSlop={10} accessibilityLabel="Editar">
              <Txt variant="label">Editar</Txt>
            </PressableScale>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.title}>
          <View style={[styles.tile, { backgroundColor: color + "22" }]}>
            <Text style={{ fontSize: 32 }}>{habit.emoji ?? habit.name.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="title">{habit.name}</Txt>
            <Txt tone="muted">{describeFrequency(habit)}</Txt>
          </View>
        </View>

        <Card style={{ gap: 10 }}>
          <View style={styles.strengthRow}>
            <Txt variant="label">Fuerza del hábito</Txt>
            <Txt variant="title" color={color}>
              {pct(stats.strength)}
            </Txt>
          </View>
          <View style={[styles.bar, { backgroundColor: c.sunken }]}>
            <View style={[styles.barFill, { width: `${Math.round(stats.strength * 100)}%`, backgroundColor: color }]} />
          </View>
          <Txt variant="caption" tone="muted">
            Sube cada vez que lo haces y baja poco a poco si lo dejas. Un mal día no la hunde.
          </Txt>
        </Card>

        <View style={styles.tiles}>
          <Stat label="Racha" value={`${stats.s.current}`} unit={streakUnit(stats.s.unit, stats.s.current)} />
          <Stat label="Mejor racha" value={`${stats.s.best}`} unit={streakUnit(stats.s.unit, stats.s.best)} />
          <Stat label="Cumplimiento" value={pct(stats.all.rate)} unit="desde el inicio" />
        </View>

        <Card>
          <MonthGrid
            month={month}
            onMonthChange={setMonth}
            maxMonth={fromKey(today)}
            renderDay={(k) => {
              const st = dayState(stats.h, checks, k, today);
              const done = st === "done";
              return (
                <PressableScale
                  disabled={st === "disabled"}
                  onPress={() => (toggle(habit.id, k) ? feedback.select(3) : feedback.uncheck())}
                  accessibilityLabel={`${k}: ${done ? "hecho" : st === "missed" ? "no hecho" : "sin marcar"}`}
                  style={[
                    styles.day,
                    {
                      backgroundColor: done ? color : st === "missed" ? c.miss + "55" : "transparent",
                      borderColor: k === today ? c.ink : "transparent",
                    },
                  ]}
                >
                  <Txt variant="caption" color={done ? "#fff" : st === "off" || st === "disabled" ? c.faint : c.ink}>
                    {Number(k.slice(8))}
                  </Txt>
                </PressableScale>
              );
            }}
          />
          <Txt variant="caption" tone="faint" style={{ marginTop: 10, textAlign: "center" }}>
            Toca un día para marcarlo o corregirlo.
          </Txt>
        </Card>

        <Card style={{ gap: 12 }}>
          <Txt variant="label">Por día de la semana</Txt>
          <View style={styles.weekBars}>
            {stats.weekdays.map((p) => (
              <View key={p.idx} style={styles.weekCol}>
                <View style={[styles.weekTrack, { backgroundColor: c.sunken }]}>
                  <View style={[styles.weekFill, { height: `${Math.round((p.rate ?? 0) * 100)}%`, backgroundColor: color }]} />
                </View>
                <Txt variant="caption" tone="muted">
                  {WEEKDAY_SHORT[p.idx]}
                </Txt>
              </View>
            ))}
          </View>
        </Card>

        {stats.reasons.length > 0 && (
          <Card style={{ gap: 10 }}>
            <Txt variant="label">Cuando no lo haces, suele ser por…</Txt>
            {stats.reasons.map((r) => (
              <View key={r.ctx!.id} style={styles.reason}>
                <Text style={{ fontSize: 20 }}>{r.ctx!.emoji}</Text>
                <Txt style={{ flex: 1 }}>{r.ctx!.label}</Txt>
                <Txt variant="label" tone="muted">
                  {r.n} {r.n === 1 ? "vez" : "veces"}
                </Txt>
              </View>
            ))}
          </Card>
        )}

        {habit.reminder_time && (
          <View style={styles.reminder}>
            <Ionicons name="notifications-outline" size={16} color={c.muted} />
            <Txt variant="caption" tone="muted">
              Aviso a las {habit.reminder_time}
            </Txt>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <Card style={styles.stat}>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
      <Txt variant="title">{value}</Txt>
      <Txt variant="caption" tone="faint" numberOfLines={1}>
        {unit}
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  title: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  tile: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  strengthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bar: { height: 12, borderRadius: 6, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 6 },
  tiles: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, padding: 12, gap: 2 },
  day: { flex: 1, borderRadius: radius.sm, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  weekBars: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  weekCol: { flex: 1, alignItems: "center", gap: 6 },
  weekTrack: { width: "100%", height: 80, borderRadius: 8, justifyContent: "flex-end", overflow: "hidden" },
  weekFill: { width: "100%", borderRadius: 8 },
  reason: { flexDirection: "row", alignItems: "center", gap: 10 },
  reminder: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
});
