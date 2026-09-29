import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { habitColor } from "../core/colors";
import type { Habit } from "../core/types";
import { Burst, fireBurst } from "./Burst";
import { PressableScale, Txt } from "./primitives";
import { radius, useTheme } from "./theme";

interface Props {
  habit: Habit;
  done: boolean;
  subtitle: string;
  dim?: boolean;
  onToggle: () => void;
  onLongPress: () => void;
}

/** Un hábito en la lista de hoy: tocar en cualquier parte lo marca; mantener pulsado abre el detalle. */
export function HabitRow({ habit, done, subtitle, dim, onToggle, onLongPress }: Props) {
  const { c, dark } = useTheme();
  const color = habitColor(habit.color, dark);
  const fill = useSharedValue(done ? 1 : 0);
  const pop = useSharedValue(1);
  const lift = useSharedValue(0);
  const burst = useSharedValue(0);
  const first = useRef(true);
  const surface = c.surface;
  const tint = mixTint(color, surface, dark);

  useEffect(() => {
    fill.set(withTiming(done ? 1 : 0, { duration: 220 }));
    if (first.current) {
      first.current = false;
      return;
    }
    if (done) {
      pop.set(withSequence(withTiming(0.7, { duration: 70 }), withSpring(1, { damping: 7, stiffness: 380 })));
      lift.set(withSequence(withTiming(-4, { duration: 90 }), withSpring(0, { damping: 9, stiffness: 260 })));
      fireBurst(burst);
    } else {
      pop.set(withSequence(withTiming(0.85, { duration: 80 }), withSpring(1, { damping: 14, stiffness: 300 })));
    }
  }, [done, fill, pop, lift, burst]);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.get(), [0, 1], [surface, tint]),
    transform: [{ translateY: lift.get() }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.get(), [0, 1], [surface, color]),
    transform: [{ scale: pop.get() }],
  }));
  const tickStyle = useAnimatedStyle(() => ({ opacity: fill.get(), transform: [{ scale: 0.5 + fill.get() * 0.5 }] }));

  return (
    <PressableScale
      onPress={onToggle}
      onLongPress={onLongPress}
      delayLongPress={350}
      scaleTo={0.97}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${habit.name}, ${subtitle}`}
      accessibilityHint="Toca para marcarlo. Mantén pulsado para ver el detalle."
    >
      <Animated.View style={[styles.row, { opacity: dim ? 0.55 : 1 }, rowStyle]}>
        <View style={[styles.tile, { backgroundColor: color + "22" }]}>
          {habit.emoji ? <Text style={styles.emoji}>{habit.emoji}</Text> : <Txt variant="heading" color={color}>{habit.name.slice(0, 1).toUpperCase()}</Txt>}
        </View>
        <View style={styles.text}>
          <Txt variant="heading" numberOfLines={1}>
            {habit.name}
          </Txt>
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Txt>
        </View>
        <View style={styles.checkWrap}>
          <Burst progress={burst} color={color} />
          <Animated.View style={[styles.check, { borderColor: color }, checkStyle]}>
            <Animated.View style={tickStyle}>
              <Ionicons name="checkmark-sharp" size={22} color="#fff" />
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </PressableScale>
  );
}

/** Fondo de la fila hecha: el color del hábito muy rebajado sobre la superficie. */
function mixTint(hex: string, surface: string, dark: boolean): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(surface.slice(1), 16);
  const k = dark ? 0.22 : 0.14;
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * k + ((b >> shift) & 255) * (1 - k));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 12, paddingRight: 16, borderRadius: radius.lg, minHeight: 72 },
  tile: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 24 },
  text: { flex: 1, gap: 2 },
  checkWrap: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  check: { width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
});
