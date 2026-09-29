import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { router } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { habitColor } from "../../core/colors";
import { fromKey } from "../../core/dates";
import { isMilestone } from "../../core/milestones";
import { withHistory } from "../../core/schedule";
import { streaks } from "../../core/stats";
import { feedback } from "../../juice/feedback";
import { useDayHabits } from "../../store/selectors";
import { useStore } from "../../store/useStore";
import { HabitRow } from "../../ui/HabitRow";
import { Button, PressableScale, Txt } from "../../ui/primitives";
import { MOODS, radius, useTheme } from "../../ui/theme";

/** A partir de esta hora se ofrece cerrar el día aunque falten hábitos. */
const CLOSE_HOUR = 19;

export default function Today() {
  const today = useStore((s) => s.today);
  const toggle = useStore((s) => s.toggle);
  const day = useStore((s) => s.days[today]);
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const items = useDayHabits(today);

  const due = items.filter((i) => i.due);
  const rest = items.filter((i) => !i.due);
  const done = due.filter((i) => i.done).length;
  const allDone = due.length > 0 && done === due.length;
  const canClose = allDone || new Date().getHours() >= CLOSE_HOUR;
  const closed = !!day?.closed_at;

  const date = fromKey(today);
  const weekday = format(date, "EEEE", { locale: es });

  function onToggle(habitId: string) {
    const nowDone = toggle(habitId, today);
    if (!nowDone) return feedback.uncheck();
    // El estado ya está actualizado: vemos si esta marca alcanza una racha que celebrar.
    const s = useStore.getState();
    const checks = s.checks[habitId];
    const habit = s.habits.find((h) => h.id === habitId)!;
    const streak = streaks(withHistory(habit, checks), checks, today);
    const milestone = streak.unit === "day" && isMilestone(streak.current);
    const isDue = due.some((i) => i.habit.id === habitId);
    feedback.check(done + (isDue ? 1 : 0), due.length, milestone);
  }

  const openClose = () => router.push({ pathname: "/cierre", params: { date: today } });

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" tone="muted" style={styles.kicker}>
            {format(date, "d 'de' MMMM", { locale: es })}
          </Txt>
          <Txt variant="display">{weekday.charAt(0).toUpperCase() + weekday.slice(1)}</Txt>
        </View>
        <IconButton icon="add" label="Nuevo hábito" onPress={() => router.push("/habito/editar")} />
        <IconButton icon="settings-outline" label="Ajustes" onPress={() => router.push("/ajustes")} />
      </View>

      {items.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: c.surface }]}>
          <Txt style={{ fontSize: 44, lineHeight: 52 }}>🌱</Txt>
          <Txt variant="title" style={{ textAlign: "center" }}>
            Empieza por un hábito
          </Txt>
          <Txt tone="muted" style={{ textAlign: "center" }}>
            Uno pequeño que puedas hacer hoy. Luego otro.
          </Txt>
          <Button label="Crear hábito" onPress={() => router.push("/habito/editar")} style={{ alignSelf: "stretch", marginTop: 8 }} />
        </View>
      ) : (
        <>
          <Progress done={done} total={due.length} colors={due.map((i) => (i.done ? i.habit.color : null))} />

          <View style={styles.list}>
            {due.map((i) => (
              <Animated.View key={i.habit.id} layout={LinearTransition.springify().damping(18)}>
                <HabitRow
                  habit={i.habit}
                  done={i.done}
                  subtitle={i.subtitle}
                  onToggle={() => onToggle(i.habit.id)}
                  onLongPress={() => router.push(`/habito/${i.habit.id}`)}
                />
              </Animated.View>
            ))}
          </View>

          {closed ? (
            <PressableScale onPress={openClose} style={[styles.closed, { backgroundColor: c.surface }]}>
              <Txt style={{ fontSize: 26, lineHeight: 32 }}>{MOODS.find((m) => m.value === day?.mood)?.emoji ?? "🌙"}</Txt>
              <View style={{ flex: 1 }}>
                <Txt variant="label">Día cerrado</Txt>
                <Txt variant="caption" tone="muted">
                  Toca para cambiarlo
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.faint} />
            </PressableScale>
          ) : canClose ? (
            <Button
              label={allDone ? "¡Todo hecho! Cerrar el día" : "Cerrar el día"}
              icon={<Ionicons name="moon" size={18} color={c.onAccent} />}
              onPress={openClose}
            />
          ) : null}

          {rest.length > 0 && (
            <View style={styles.list}>
              <Txt variant="caption" tone="muted" style={styles.section}>
                HOY NO TOCA
              </Txt>
              {rest.map((i) => (
                <HabitRow
                  key={i.habit.id}
                  habit={i.habit}
                  done={i.done}
                  subtitle={i.subtitle}
                  dim
                  onToggle={() => onToggle(i.habit.id)}
                  onLongPress={() => router.push(`/habito/${i.habit.id}`)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function IconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconButton, { backgroundColor: c.surface }]}
      hitSlop={6}
    >
      <Ionicons name={icon} size={22} color={c.ink} />
    </PressableScale>
  );
}

/** «3 / 7» y una barra de segmentos: cada hábito hecho pinta el suyo con su color. */
function Progress({ done, total, colors }: { done: number; total: number; colors: (string | null)[] }) {
  const { c, dark } = useTheme();
  const bump = useSharedValue(1);
  useEffect(() => {
    bump.set(withSequence(withTiming(1.12, { duration: 80 }), withSpring(1, { damping: 8, stiffness: 300 })));
  }, [done, bump]);
  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));

  if (total === 0) {
    return <Txt tone="muted">Hoy no toca ningún hábito. Descansa.</Txt>;
  }
  return (
    <View style={styles.progress}>
      <View style={styles.progressText}>
        <Animated.View style={[styles.count, numberStyle]}>
          <Txt variant="title">{done}</Txt>
          <Txt variant="title" tone="faint">{` / ${total}`}</Txt>
        </Animated.View>
        <Txt variant="caption" tone="muted">
          {done === total ? "¡Día completo!" : `${total - done} por hacer`}
        </Txt>
      </View>
      <View style={styles.segments}>
        {colors.map((col, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: col ? habitColor(col, dark) : c.sunken }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  kicker: { textTransform: "uppercase", letterSpacing: 0.8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  list: { gap: 10 },
  section: { letterSpacing: 0.8, marginTop: 8, marginLeft: 4 },
  progress: { gap: 10 },
  progressText: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { flexDirection: "row", alignItems: "baseline" },
  segments: { flexDirection: "row", gap: 4, height: 10 },
  segment: { flex: 1, borderRadius: 5 },
  empty: { borderRadius: radius.lg, padding: 24, alignItems: "center", gap: 8, marginTop: 24 },
  closed: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.lg },
});
