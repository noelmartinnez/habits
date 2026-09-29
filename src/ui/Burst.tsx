import { StyleSheet, View } from "react-native";
import Animated, { Easing, type SharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

const DOTS = 8;

function Dot({ angle, color, progress }: { angle: number; color: string; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const d = 8 + p * 26;
    return {
      opacity: p === 0 || p === 1 ? 0 : 1 - p,
      transform: [{ translateX: Math.cos(angle) * d }, { translateY: Math.sin(angle) * d }, { scale: 1 - p * 0.6 }],
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

/** Lanza las chispas: `progress` va de 0 a 1. */
export function fireBurst(progress: SharedValue<number>) {
  progress.set(0.001);
  progress.set(withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
}

/** Chispas que salen del centro. Se disparan con `fireBurst`. */
export function Burst({ progress, color, size = 34 }: { progress: SharedValue<number>; color: string; size?: number }) {
  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size }]}>
      {Array.from({ length: DOTS }, (_, i) => (
        <Dot key={i} angle={(i / DOTS) * Math.PI * 2 + 0.3} color={color} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", width: 6, height: 6, borderRadius: 3 },
});
