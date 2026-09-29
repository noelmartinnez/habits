import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../store/useStore";
import { Txt } from "./primitives";
import { radius, useTheme } from "./theme";

/** Aviso de error arriba de la pantalla; se va solo o al tocarlo. */
export function ErrorToast() {
  const error = useStore((s) => s.error);
  const clear = useStore((s) => s.clearError);
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clear, 5000);
    return () => clearTimeout(t);
  }, [error, clear]);

  if (!error) return null;
  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={[styles.wrap, { top: insets.top + 8 }]}>
      <Pressable onPress={clear} style={[styles.toast, { backgroundColor: c.danger }]} accessibilityRole="alert">
        <Txt variant="label" color="#fff">
          {error}
        </Txt>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  toast: { borderRadius: radius.md, padding: 14 },
});
