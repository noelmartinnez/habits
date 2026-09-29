import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addDaysKey, eachDayKey, fromKey } from "../../core/dates";
import { withHistory } from "../../core/schedule";
import { dayCompletion } from "../../core/stats";
import { EMPTY } from "../../store/selectors";
import { useStore } from "../../store/useStore";
import { MonthGrid } from "../../ui/MonthGrid";
import { Card, PressableScale, Txt } from "../../ui/primitives";
import { MOODS, radius, useTheme } from "../../ui/theme";

export default function History() {
  const habits = useStore((s) => s.habits);
  const checks = useStore((s) => s.checks);
  const days = useStore((s) => s.days);
  const today = useStore((s) => s.today);
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [month, setMonth] = useState(() => fromKey(today));

  const items = useMemo(
    () => habits.map((h) => ({ h: withHistory(h, checks[h.id] ?? EMPTY), checks: checks[h.id] ?? EMPTY })),
    [habits, checks],
  );

  // Resumen de los últimos 7 días (sin contar hoy si no está cerrado).
  const week = useMemo(() => {
    let done = 0;
    let due = 0;
    let moodSum = 0;
    let moodDays = 0;
    for (const k of eachDayKey(addDaysKey(today, -6), today)) {
      const d = dayCompletion(items, k);
      done += d.done;
      due += d.due;
      const m = days[k]?.mood;
      if (m) {
        moodSum += m;
        moodDays++;
      }
    }
    return { rate: due ? done / due : null, mood: moodDays ? moodSum / moodDays : null };
  }, [items, days, today]);

  const moodOf = (v: number | null | undefined) => MOODS.find((m) => m.value === v);
  const avgMood = week.mood === null ? null : moodOf(Math.round(week.mood));

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <Txt variant="display">Historial</Txt>

      <View style={styles.tiles}>
        <Card style={styles.tile}>
          <Txt variant="caption" tone="muted">
            Últimos 7 días
          </Txt>
          <Txt variant="title">{week.rate === null ? "—" : `${Math.round(week.rate * 100)}%`}</Txt>
          <Txt variant="caption" tone="faint">
            hábitos hechos
          </Txt>
        </Card>
        <Card style={styles.tile}>
          <Txt variant="caption" tone="muted">
            Ánimo medio
          </Txt>
          <Txt variant="title">{avgMood ? avgMood.emoji : "—"}</Txt>
          <Txt variant="caption" tone="faint">
            {avgMood ? avgMood.label.toLowerCase() : "cierra tus días"}
          </Txt>
        </Card>
      </View>

      <Card>
        <MonthGrid
          month={month}
          onMonthChange={setMonth}
          maxMonth={fromKey(today)}
          renderDay={(k) => {
            const future = k > today;
            const comp = future ? null : dayCompletion(items, k);
            const mood = moodOf(days[k]?.mood);
            const rate = comp && comp.due > 0 ? comp.done / comp.due : null;
            return (
              <PressableScale
                disabled={future}
                onPress={() => router.push(`/dia/${k}`)}
                accessibilityLabel={`${k}${mood ? `, ánimo ${mood.label}` : ""}${comp ? `, ${comp.done} de ${comp.due}` : ""}`}
                style={[styles.day, { backgroundColor: mood ? mood.color + "40" : c.sunken + (future ? "00" : ""), borderColor: k === today ? c.ink : "transparent" }]}
              >
                <Txt variant="caption" tone={future ? "faint" : "ink"}>
                  {Number(k.slice(8))}
                </Txt>
                {rate !== null && (
                  <View style={[styles.track, { backgroundColor: c.line }]}>
                    <View style={[styles.fill, { width: `${Math.round(rate * 100)}%`, backgroundColor: c.ink }]} />
                  </View>
                )}
              </PressableScale>
            );
          }}
        />
        <View style={styles.legend}>
          {MOODS.map((m) => (
            <View key={m.value} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: m.color + "80" }]} />
              <Txt variant="caption" tone="muted">
                {m.emoji}
              </Txt>
            </View>
          ))}
        </View>
        <Txt variant="caption" tone="faint" style={{ textAlign: "center", marginTop: 6 }}>
          El color es el ánimo; la barra, los hábitos hechos. Toca un día para verlo o corregirlo.
        </Txt>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  tiles: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, gap: 2 },
  day: { flex: 1, borderRadius: radius.sm, borderWidth: 1.5, alignItems: "center", justifyContent: "center", gap: 4 },
  track: { width: "60%", height: 3, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%" },
  legend: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
