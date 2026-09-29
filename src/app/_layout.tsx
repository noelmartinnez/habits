import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, type Href, router, SplashScreen, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initFeedback, setFeedbackPrefs } from "../juice/feedback";
import { useReminderSync } from "../lib/notifications";
import { useStore } from "../store/useStore";
import { ErrorToast } from "../ui/ErrorToast";
import { fonts, useTheme } from "../ui/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const { dark, c } = useTheme();

  useEffect(() => {
    void useStore.getState().init();
    void initFeedback();
    // Al volver a la app puede haber cambiado el día.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") useStore.getState().refreshToday();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setFeedbackPrefs({
      sound: settings.sound !== "off",
      haptics: settings.haptics !== "off",
      volume: settings.volume ? Number(settings.volume) : 0.7,
    });
  }, [settings.sound, settings.haptics, settings.volume]);

  useEffect(() => {
    if (fontsLoaded && ready) void SplashScreen.hideAsync();
  }, [fontsLoaded, ready]);

  if (!fontsLoaded || !ready) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: c.bg, card: c.bg, text: c.ink, border: c.line, primary: c.ink } };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <ThemeProvider value={navTheme}>
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: c.bg },
            headerTitleStyle: { fontFamily: fonts.bold, color: c.ink },
            headerTintColor: c.ink,
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: c.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="habito/[id]" options={{ title: "" }} />
          <Stack.Screen name="habito/editar" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="dia/[date]" options={{ title: "" }} />
          <Stack.Screen name="cierre" options={{ presentation: "modal", headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="ajustes" options={{ title: "Ajustes" }} />
        </Stack>
        <ReminderSync />
        <ErrorToast />
        <StatusBar style={dark ? "light" : "dark"} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const openUrl = (url: string) => router.push(url as Href);

/** Se monta cuando los datos ya están cargados, para no programar avisos con la app vacía. */
function ReminderSync() {
  useReminderSync(openUrl);
  return null;
}
