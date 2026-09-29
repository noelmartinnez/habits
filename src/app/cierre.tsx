import { format } from "date-fns";
import { es } from "date-fns/locale";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeOutLeft, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { habitColor } from "../core/colors";
import { fromKey } from "../core/dates";
import { feedback } from "../juice/feedback";
import { useDayHabits } from "../store/selectors";
import { useStore } from "../store/useStore";
import { ModalHeader } from "../ui/ModalHeader";
import { MoodPicker } from "../ui/MoodPicker";
import { Button, Chip, Txt } from "../ui/primitives";
import { MOODS, radius, useTheme } from "../ui/theme";

/** Como mucho, tantas fichas por día: obliga a quedarse con lo que de verdad lo marcó. */
const MAX_CONTEXTS = 3;
const DID_IT = "__done__";

type Step = "mood" | "contexts" | "misses" | "done";

/**
 * Cierre del día, en unos 15 segundos: cómo ha ido, qué lo marcó y, para cada hábito
 * que faltó, por qué. Es lo que luego permite explicar los días malos.
 */
export default function CloseDay() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = useStore((s) => s.days[date]);
  const savedContexts = useStore((s) => s.dayContexts[date]);
  const savedMisses = useStore((s) => s.misses[date]);
  const contexts = useStore((s) => s.contexts);
  const { closeDay, toggle } = useStore.getState();
  const items = useDayHabits(date);
  const insets = useSafeAreaInsets();
  const { c, dark } = useTheme();

  // Se fijan al abrir: marcar «Sí lo hice» aquí no debe hacer desaparecer la tarjeta.
  const [pendingIds] = useState(() => items.filter((i) => i.due && !i.done && i.habit.freq_type !== "weekly_count").map((i) => i.habit.id));
  const pending = useMemo(() => items.filter((i) => pendingIds.includes(i.habit.id)), [items, pendingIds]);
  const [step, setStep] = useState<Step>("mood");
  const [mood, setMood] = useState<number | null>(day?.mood ?? null);
  const [picked, setPicked] = useState<string[]>(savedContexts ?? []);
  const [misses, setMisses] = useState<Record<string, string>>(savedMisses ?? {});
  // Los que se marcan como hechos aquí dejan de estar pendientes, pero siguen en la lista.
  const [didHere, setDidHere] = useState<string[]>([]);

  const active = contexts.filter((x) => !x.archived);
  const title = format(fromKey(date), "EEEE d", { locale: es });

  function pickMood(v: number) {
    setMood(v);
    setTimeout(() => setStep("contexts"), 280);
  }

  function toggleContext(id: string) {
    if (picked.includes(id)) {
      setPicked(picked.filter((x) => x !== id));
      feedback.tap();
    } else if (picked.length < MAX_CONTEXTS) {
      setPicked([...picked, id]);
      feedback.select(picked.length + 2);
    }
  }

  function pickMiss(habitId: string, ctx: string) {
    if (ctx === DID_IT) {
      if (!didHere.includes(habitId)) {
        toggle(habitId, date);
        setDidHere([...didHere, habitId]);
        feedback.check(1, 2);
      }
      const { [habitId]: _gone, ...rest } = misses;
      setMisses(rest);
      return;
    }
    if (didHere.includes(habitId)) {
      toggle(habitId, date);
      setDidHere(didHere.filter((x) => x !== habitId));
    }
    setMisses({ ...misses, [habitId]: ctx });
    feedback.select(Object.keys(misses).length + 3);
  }

  async function finish() {
    const stillPending = new Set(pending.map((p) => p.habit.id).filter((id) => !didHere.includes(id)));
    const finalMisses = Object.fromEntries(Object.entries(misses).filter(([id]) => stillPending.has(id)));
    try {
      await closeDay(date, { mood, contextIds: picked, misses: finalMisses });
      feedback.closeDay();
      setStep("done");
    } catch {
      // El aviso de error ya lo enseña el store.
    }
  }

  const next = () => (step === "contexts" && pending.length > 0 ? setStep("misses") : finish());
  const doneCount = items.filter((i) => i.due && i.done).length;
  const dueCount = items.filter((i) => i.due).length;
  const moodInfo = MOODS.find((m) => m.value === mood);

  if (step === "done") {
    return (
      <View style={[styles.doneScreen, { backgroundColor: c.bg, paddingBottom: insets.bottom + 24 }]}>
        <Animated.Text entering={ZoomIn.springify().damping(9)} style={styles.bigEmoji}>
          {moodInfo?.emoji ?? "🌙"}
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(200)} style={{ alignItems: "center", gap: 6 }}>
          <Txt variant="display">Día cerrado</Txt>
          <Txt tone="muted">
            {dueCount > 0 ? `${doneCount} de ${dueCount} hábitos` : "Sin hábitos que tocaran"}
            {picked.length > 0 ? ` · ${picked.map((id) => contexts.find((x) => x.id === id)?.emoji).join(" ")}` : ""}
          </Txt>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(600)} style={{ alignSelf: "stretch" }}>
          <Button label="Listo" onPress={() => router.back()} />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ModalHeader title={title.charAt(0).toUpperCase() + title.slice(1)} onCancel={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {step === "mood" && (
          <Animated.View key="mood" entering={FadeInRight} exiting={FadeOutLeft} style={styles.step}>
            <Txt variant="title">¿Qué tal ha ido el día?</Txt>
            <MoodPicker value={mood} onChange={pickMood} />
            <Button label="Prefiero no decirlo" kind="ghost" onPress={() => setStep("contexts")} />
          </Animated.View>
        )}

        {step === "contexts" && (
          <Animated.View key="contexts" entering={FadeInRight} exiting={FadeOutLeft} style={styles.step}>
            <View style={{ gap: 4 }}>
              <Txt variant="title">¿Qué lo ha marcado?</Txt>
              <Txt tone="muted">Hasta {MAX_CONTEXTS}. Si nada en especial, sigue.</Txt>
            </View>
            <View style={styles.chips}>
              {active.map((x) => (
                <Chip key={x.id} label={x.label} emoji={x.emoji} selected={picked.includes(x.id)} onPress={() => toggleContext(x.id)} />
              ))}
            </View>
            <Button label={pending.length > 0 ? "Seguir" : "Cerrar el día"} onPress={next} />
          </Animated.View>
        )}

        {step === "misses" && (
          <Animated.View key="misses" entering={FadeInRight} style={styles.step}>
            <View style={{ gap: 4 }}>
              <Txt variant="title">¿Qué pasó con…?</Txt>
              <Txt tone="muted">Un toque por hábito. Sin juicios: sirve para ver patrones.</Txt>
            </View>
            {pending.map((p) => {
              const color = habitColor(p.habit.color, dark);
              const did = didHere.includes(p.habit.id);
              return (
                <View key={p.habit.id} style={[styles.missCard, { backgroundColor: c.surface }]}>
                  <View style={styles.missTitle}>
                    <Text style={{ fontSize: 22 }}>{p.habit.emoji ?? "•"}</Text>
                    <Txt variant="heading" style={{ flex: 1 }} numberOfLines={1}>
                      {p.habit.name}
                    </Txt>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.missChips}>
                    <Chip label="Sí lo hice" emoji="✅" selected={did} color={color} onPress={() => pickMiss(p.habit.id, DID_IT)} />
                    {active.map((x) => (
                      <Chip key={x.id} label={x.label} emoji={x.emoji} selected={!did && misses[p.habit.id] === x.id} onPress={() => pickMiss(p.habit.id, x.id)} />
                    ))}
                  </ScrollView>
                </View>
              );
            })}
            <Button label="Cerrar el día" onPress={finish} />
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 24 },
  step: { gap: 24 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  missCard: { borderRadius: radius.lg, paddingVertical: 14, gap: 10 },
  missTitle: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  missChips: { gap: 8, paddingHorizontal: 14 },
  doneScreen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24, paddingHorizontal: 24 },
  bigEmoji: { fontSize: 96, lineHeight: 110 },
});
