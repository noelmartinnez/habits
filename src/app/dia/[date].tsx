import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { fromKey } from "../../core/dates";
import { feedback } from "../../juice/feedback";
import { useDayHabits } from "../../store/selectors";
import { useStore } from "../../store/useStore";
import { HabitRow } from "../../ui/HabitRow";
import { Card, PressableScale, Txt } from "../../ui/primitives";
import { MOODS, useTheme } from "../../ui/theme";

/** Un día cualquiera del pasado: se puede corregir todo, porque olvidarse de marcar pasa. */
export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = useStore((s) => s.days[date]);
  const dayContexts = useStore((s) => s.dayContexts[date]);
  const misses = useStore((s) => s.misses[date]);
  const contexts = useStore((s) => s.contexts);
  const toggle = useStore((s) => s.toggle);
  const items = useDayHabits(date);
  const { c } = useTheme();

  const title = format(fromKey(date), "EEEE d 'de' MMMM", { locale: es });
  const mood = MOODS.find((m) => m.value === day?.mood);
  const ctxOf = (id: string) => contexts.find((x) => x.id === id);
  const due = items.filter((i) => i.due);
  const rest = items.filter((i) => !i.due);

  const onToggle = (id: string) => (toggle(id, date) ? feedback.select(4) : feedback.uncheck());
  const missLabel = (habitId: string) => {
    const ctx = misses?.[habitId] ? ctxOf(misses[habitId]) : undefined;
    return ctx ? `${ctx.emoji} ${ctx.label}` : null;
  };

  return (
    <>
      <Stack.Screen options={{ title: title.charAt(0).toUpperCase() + title.slice(1) }} />
      <ScrollView contentContainerStyle={styles.content}>
        <PressableScale onPress={() => router.push({ pathname: "/cierre", params: { date } })}>
          <Card style={styles.closeCard}>
            <Text style={{ fontSize: 34 }}>{mood?.emoji ?? "🌙"}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="label">{day?.closed_at ? (mood ? `Ánimo: ${mood.label.toLowerCase()}` : "Día cerrado") : "Sin cerrar"}</Txt>
              <Txt variant="caption" tone="muted" numberOfLines={2}>
                {dayContexts?.length ? dayContexts.map((id) => `${ctxOf(id)?.emoji ?? ""} ${ctxOf(id)?.label ?? ""}`).join(" · ") : day?.closed_at ? "Nada especial" : "Toca para cerrarlo ahora"}
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.faint} />
          </Card>
        </PressableScale>

        {due.length > 0 && (
          <Txt variant="caption" tone="muted" style={styles.section}>
            TOCABA
          </Txt>
        )}
        {due.map((i) => (
          <HabitRow
            key={i.habit.id}
            habit={i.habit}
            done={i.done}
            subtitle={i.done ? "Hecho" : (missLabel(i.habit.id) ?? "No hecho")}
            onToggle={() => onToggle(i.habit.id)}
            onLongPress={() => router.push(`/habito/${i.habit.id}`)}
          />
        ))}

        {rest.length > 0 && (
          <Txt variant="caption" tone="muted" style={styles.section}>
            NO TOCABA
          </Txt>
        )}
        {rest.map((i) => (
          <HabitRow
            key={i.habit.id}
            habit={i.habit}
            done={i.done}
            subtitle={i.done ? "Hecho" : "No tocaba"}
            dim
            onToggle={() => onToggle(i.habit.id)}
            onLongPress={() => router.push(`/habito/${i.habit.id}`)}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  closeCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  section: { letterSpacing: 0.8, marginTop: 12, marginLeft: 4 },
});
