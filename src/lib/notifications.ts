import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import { toTimeKey } from "../core/dates";
import { planReminders, type PlannedReminder, reminderDate } from "../core/reminders";
import { withHistory } from "../core/schedule";
import { EMPTY } from "../store/selectors";
import { useStore } from "../store/useStore";

const CHANNEL = "recordatorios";

// Con la app abierta, el aviso también se enseña.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** ¿Se pueden enviar avisos? Con `ask`, pide permiso si aún no se ha preguntado. */
export async function ensurePermission(ask: boolean): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

async function schedule(plan: PlannedReminder[]) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Recordatorios", importance: Notifications.AndroidImportance.HIGH });
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, sound: true, data: { url: r.habitId ? "/" : `/cierre?date=${r.date}` } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate(r), channelId: CHANNEL },
    });
  }
}

/** Plan de avisos con el estado actual de la app. */
function currentPlan(): PlannedReminder[] {
  const s = useStore.getState();
  return planReminders({
    habits: s.habits.map((h) => ({ h: withHistory(h, s.checks[h.id] ?? EMPTY), checks: s.checks[h.id] ?? EMPTY })),
    closeTime: s.settings.close_reminder || null,
    closedDays: new Set(Object.values(s.days).filter((d) => d.closed_at).map((d) => d.date)),
    today: s.today,
    nowTime: toTimeKey(new Date()),
  });
}

let running: Promise<void> | null = null;
let again = false;

/** Reprograma todos los avisos. Si ya se está haciendo, repite al acabar con el estado nuevo. */
export async function syncReminders(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        if (!(await ensurePermission(false))) return;
        await schedule(currentPlan());
      } while (again);
    } catch (e) {
      useStore.setState({ error: `No se pudieron programar los avisos: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Mantiene los avisos al día: al arrancar y cada vez que cambian hábitos, marcas, cierres o ajustes. */
export function useReminderSync(onOpenUrl: (url: string) => void) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const kick = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void syncReminders(), 800);
    };
    kick();
    const unsub = useStore.subscribe((s, prev) => {
      if (
        s.habits !== prev.habits ||
        s.checks !== prev.checks ||
        s.days !== prev.days ||
        s.today !== prev.today ||
        s.settings.close_reminder !== prev.settings.close_reminder
      ) {
        kick();
      }
    });
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const url = res.notification.request.content.data?.url;
      if (typeof url === "string") onOpenUrl(url);
    });
    return () => {
      clearTimeout(timer);
      unsub();
      sub.remove();
    };
  }, [onOpenUrl]);
}
