import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { HABIT_COLORS, habitColor } from "../../core/colors";
import { fromTimeKey, toTimeKey } from "../../core/dates";
import { ALL_WEEKDAYS, hasWeekday, WEEKDAY_SHORT } from "../../core/schedule";
import type { FreqType, HabitInput } from "../../core/types";
import { feedback } from "../../juice/feedback";
import { askForReminders } from "../../lib/permissions";
import { useStore } from "../../store/useStore";
import { ModalHeader } from "../../ui/ModalHeader";
import { Button, Chip, PressableScale, Txt } from "../../ui/primitives";
import { fonts, radius, useTheme } from "../../ui/theme";

const FREQS: { value: FreqType; label: string }[] = [
  { value: "daily", label: "Cada día" },
  { value: "weekdays", label: "Días concretos" },
  { value: "weekly_count", label: "Veces por semana" },
];

const EMOJI_SUGGESTIONS = ["🏃", "📘", "🧘", "💧", "🥗", "😴", "✍️", "🎸", "🧹", "💊", "🚭", "📵"];

/** Último grafema de lo escrito (un emoji puede ocupar varios caracteres). */
function lastGrapheme(s: string): string {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) {
    const parts = [...new Seg(undefined, { granularity: "grapheme" }).segment(s)];
    return parts.length ? parts[parts.length - 1].segment : "";
  }
  return Array.from(s).slice(-1).join("");
}

export default function EditHabit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => s.habits.find((h) => h.id === id));
  const { createHabit, updateHabit, setArchived, deleteHabit } = useStore.getState();
  const { c, dark } = useTheme();

  const [name, setName] = useState(existing?.name ?? "");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "");
  const [color, setColor] = useState(() => existing?.color ?? HABIT_COLORS[useStore.getState().habits.length % HABIT_COLORS.length].light);
  const [freq, setFreq] = useState<FreqType>(existing?.freq_type ?? "daily");
  const [weekdays, setWeekdays] = useState(existing?.freq_type === "weekdays" ? existing.weekdays : 31);
  const [target, setTarget] = useState(existing?.weekly_target ?? 3);
  const [reminder, setReminder] = useState<string | null>(existing?.reminder_time ?? null);
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length > 0 && (freq !== "weekdays" || weekdays !== 0);

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    const input: HabitInput = {
      name: name.trim(),
      emoji: emoji || null,
      color,
      freq_type: freq,
      weekdays: freq === "weekdays" ? weekdays : ALL_WEEKDAYS,
      weekly_target: freq === "weekly_count" ? target : null,
      reminder_time: reminder,
    };
    try {
      if (existing) await updateHabit(existing.id, input);
      else await createHabit(input);
      feedback.tap();
      router.back();
    } catch {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert("¿Borrar el hábito?", `Se borrará «${existing.name}» con todo su historial. No se puede deshacer.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          await deleteHabit(existing.id);
          router.dismissTo("/");
        },
      },
    ]);
  }

  async function toggleArchived() {
    if (!existing) return;
    await setArchived(existing.id, !existing.archived);
    router.dismissTo("/");
  }

  const tint = habitColor(color, dark);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ModalHeader title={existing ? "Editar hábito" : "Nuevo hábito"} onCancel={() => router.back()} action="Guardar" onAction={save} actionDisabled={!valid || saving} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.nameRow}>
          <View style={[styles.emojiBox, { backgroundColor: tint + "22", borderColor: tint }]}>
            <TextInput
              value={emoji}
              onChangeText={(t) => setEmoji(lastGrapheme(t))}
              placeholder="🙂"
              placeholderTextColor={c.faint}
              style={styles.emojiInput}
              accessibilityLabel="Emoji del hábito"
            />
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nombre del hábito"
            placeholderTextColor={c.faint}
            autoFocus={!existing}
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={save}
            style={[styles.nameInput, { color: c.ink, backgroundColor: c.surface }]}
          />
        </View>

        <View style={styles.emojiRow}>
          {EMOJI_SUGGESTIONS.map((e) => (
            <PressableScale key={e} onPress={() => setEmoji(e)} style={[styles.emojiChip, { backgroundColor: emoji === e ? tint + "33" : c.surface }]}>
              <Txt style={{ fontSize: 20, lineHeight: 26 }}>{e}</Txt>
            </PressableScale>
          ))}
        </View>

        <Section title="Color">
          <View style={styles.colors}>
            {HABIT_COLORS.map((p) => {
              const selected = p.light.toLowerCase() === color.toLowerCase();
              return (
                <PressableScale
                  key={p.light}
                  onPress={() => setColor(p.light)}
                  accessibilityLabel={p.name}
                  accessibilityState={{ selected }}
                  style={[styles.swatch, { backgroundColor: dark ? p.dark : p.light, borderColor: selected ? c.ink : "transparent" }]}
                />
              );
            })}
          </View>
        </Section>

        <Section title="¿Cuándo?">
          <View style={styles.wrap}>
            {FREQS.map((f) => (
              <Chip key={f.value} label={f.label} selected={freq === f.value} onPress={() => setFreq(f.value)} />
            ))}
          </View>
          {freq === "weekdays" && (
            <View style={styles.weekdays}>
              {WEEKDAY_SHORT.map((d, i) => {
                const on = hasWeekday(weekdays, i);
                return (
                  <PressableScale
                    key={d}
                    onPress={() => setWeekdays(weekdays ^ (1 << i))}
                    accessibilityState={{ selected: on }}
                    style={[styles.day, { backgroundColor: on ? tint : c.surface }]}
                  >
                    <Txt variant="label" color={on ? "#fff" : c.muted}>
                      {d}
                    </Txt>
                  </PressableScale>
                );
              })}
            </View>
          )}
          {freq === "weekly_count" && (
            <View style={styles.stepper}>
              <Button label="−" kind="secondary" onPress={() => setTarget(Math.max(1, target - 1))} style={styles.stepButton} />
              <Txt variant="title" style={{ minWidth: 120, textAlign: "center" }}>
                {target} {target === 1 ? "vez" : "veces"}
              </Txt>
              <Button label="+" kind="secondary" onPress={() => setTarget(Math.min(6, target + 1))} style={styles.stepButton} />
            </View>
          )}
        </Section>

        <Section title="Recordatorio">
          <View style={[styles.reminder, { backgroundColor: c.surface }]}>
            <Txt variant="label" style={{ flex: 1 }}>
              Avisarme
            </Txt>
            {reminder && (
              <DateTimePicker
                value={fromTimeKey(reminder)}
                mode="time"
                display={Platform.OS === "ios" ? "compact" : "default"}
                onChange={(_, d) => d && setReminder(toTimeKey(d))}
              />
            )}
            <Switch
              value={reminder !== null}
              onValueChange={async (on) => {
                if (!on) return setReminder(null);
                if (await askForReminders()) setReminder(existing?.reminder_time ?? "20:00");
              }}
            />
          </View>
        </Section>

        {existing && (
          <View style={styles.danger}>
            <Button label={existing.archived ? "Recuperar hábito" : "Archivar"} kind="secondary" onPress={toggleArchived} />
            <Button label="Borrar hábito" kind="danger" onPress={confirmDelete} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Txt variant="caption" tone="muted" style={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
        {title}
      </Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 48 },
  nameRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  emojiBox: { width: 60, height: 60, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  emojiInput: { fontSize: 30, textAlign: "center", width: 56, height: 56 },
  nameInput: { flex: 1, height: 60, borderRadius: radius.md, paddingHorizontal: 16, fontSize: 18, fontFamily: fonts.semibold },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: -12 },
  emojiChip: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  colors: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  weekdays: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  day: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  stepButton: { width: 52, paddingHorizontal: 0 },
  reminder: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.md, minHeight: 56 },
  danger: { gap: 10, marginTop: 8 },
});
