import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { BackupError } from "../core/backup";
import { fromTimeKey, toTimeKey } from "../core/dates";
import { feedback, setFeedbackPrefs } from "../juice/feedback";
import { pickBackup, shareBackup } from "../lib/backupIO";
import { askForReminders } from "../lib/permissions";
import { useStore, type ThemePref } from "../store/useStore";
import { Button, Card, Chip, PressableScale, Txt } from "../ui/primitives";
import { useTheme } from "../ui/theme";

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "Automático" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

const VOLUMES = [
  { value: "0.4", label: "Bajo" },
  { value: "0.7", label: "Medio" },
  { value: "1", label: "Alto" },
];

export default function Settings() {
  const settings = useStore((s) => s.settings);
  const habits = useStore((s) => s.habits);
  const { setSetting, exportBackup, importBackup, setArchived } = useStore.getState();
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);

  const soundOn = settings.sound !== "off";
  const hapticsOn = settings.haptics !== "off";
  const volume = settings.volume ?? "0.7";
  const archived = habits.filter((h) => h.archived);
  const closeReminder = settings.close_reminder || null;

  function preview() {
    // Una «mano» de ejemplo: cuatro hábitos seguidos y el día completo.
    [1, 2, 3, 4].forEach((n) => setTimeout(() => feedback.check(n, 4), (n - 1) * 260));
  }

  async function doExport() {
    setBusy(true);
    try {
      await shareBackup(await exportBackup());
    } catch (e) {
      Alert.alert("No se pudo exportar", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    let b;
    try {
      b = await pickBackup();
    } catch (e) {
      Alert.alert("No se pudo leer la copia", e instanceof BackupError ? e.message : String(e));
      return;
    }
    if (!b) return;
    const backup = b;
    Alert.alert(
      "¿Sustituir tus datos?",
      `La copia tiene ${backup.habits.length} hábitos y ${backup.checkins.length} marcas. Lo que hay ahora en la app se sustituirá por ella.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Importar",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await importBackup(backup);
              feedback.closeDay();
              router.dismissTo("/");
            } catch (e) {
              Alert.alert("No se pudo importar", e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Section title="Apariencia">
        <View style={styles.chips}>
          {THEMES.map((t) => (
            <Chip key={t.value} label={t.label} selected={(settings.theme ?? "system") === t.value} onPress={() => setSetting("theme", t.value)} />
          ))}
        </View>
      </Section>

      <Section title="Sonido y vibración">
        <Card style={styles.card}>
          <Row label="Sonidos">
            <Switch
              value={soundOn}
              onValueChange={(on) => {
                setFeedbackPrefs({ sound: on });
                void setSetting("sound", on ? "on" : "off");
                if (on) feedback.tap();
              }}
            />
          </Row>
          {soundOn && (
            <View style={styles.chips}>
              {VOLUMES.map((v) => (
                <Chip
                  key={v.value}
                  label={v.label}
                  selected={volume === v.value}
                  onPress={() => {
                    setFeedbackPrefs({ volume: Number(v.value) });
                    void setSetting("volume", v.value);
                    feedback.check(3, 5);
                  }}
                />
              ))}
            </View>
          )}
          <Row label="Vibración">
            <Switch
              value={hapticsOn}
              onValueChange={(on) => {
                setFeedbackPrefs({ haptics: on });
                void setSetting("haptics", on ? "on" : "off");
              }}
            />
          </Row>
          <Button label="Probar" kind="secondary" onPress={preview} />
          <Txt variant="caption" tone="faint">
            Si el iPhone está en silencio, la app no suena (la vibración sí funciona).
          </Txt>
        </Card>
      </Section>

      <Section title="Avisos">
        <Card style={styles.card}>
          <Row label="Recordarme cerrar el día">
            {closeReminder ? (
              <DateTimePicker
                value={fromTimeKey(closeReminder)}
                mode="time"
                display={Platform.OS === "ios" ? "compact" : "default"}
                onChange={(_, d) => d && void setSetting("close_reminder", toTimeKey(d))}
              />
            ) : null}
            <Switch
              value={!!closeReminder}
              onValueChange={async (on) => {
                if (!on) return void setSetting("close_reminder", "");
                if (await askForReminders()) void setSetting("close_reminder", "21:30");
              }}
            />
          </Row>
          <Txt variant="caption" tone="faint">
            Los avisos de cada hábito se activan al editarlo. Si ya lo has hecho ese día, no te avisa.
          </Txt>
        </Card>
      </Section>

      <Section title="Copia de seguridad">
        <Card style={styles.card}>
          <Txt tone="muted">
            Tus datos viven solo en este teléfono. Guarda una copia de vez en cuando en Archivos o iCloud Drive. Con «Importar» también se traen los datos de Rutinas de escritorio.
          </Txt>
          <Button label="Exportar copia" onPress={doExport} disabled={busy} />
          <Button label="Importar copia" kind="secondary" onPress={doImport} disabled={busy} />
        </Card>
      </Section>

      {archived.length > 0 && (
        <Section title="Hábitos archivados">
          <Card style={styles.card}>
            {archived.map((h) => (
              <View key={h.id} style={styles.row}>
                <Text style={{ fontSize: 20 }}>{h.emoji ?? "•"}</Text>
                <Txt style={{ flex: 1 }} numberOfLines={1}>
                  {h.name}
                </Txt>
                <PressableScale onPress={() => setArchived(h.id, false)} hitSlop={8}>
                  <Txt variant="label">Recuperar</Txt>
                </PressableScale>
              </View>
            ))}
          </Card>
        </Section>
      )}

      <Txt variant="caption" tone="faint" style={{ textAlign: "center", color: c.faint }}>
        Rutinas · versión de pruebas
      </Txt>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Txt variant="caption" tone="muted" style={{ letterSpacing: 0.8, textTransform: "uppercase", marginLeft: 4 }}>
        {title}
      </Txt>
      {children}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Txt variant="label" style={{ flex: 1 }}>
        {label}
      </Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 48 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 36 },
});
