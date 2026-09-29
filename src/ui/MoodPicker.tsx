import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { feedback } from "../juice/feedback";
import { PressableScale, Txt } from "./primitives";
import { MOODS, radius, useTheme } from "./theme";

function MoodButton({ mood, selected, onPress }: { mood: (typeof MOODS)[number]; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (selected) scale.set(withSequence(withTiming(1.25, { duration: 90 }), withSpring(1.08, { damping: 8, stiffness: 300 })));
    else scale.set(withTiming(1, { duration: 150 }));
  }, [selected, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={mood.label} accessibilityState={{ selected }} style={styles.item}>
      <Animated.View style={[styles.face, { backgroundColor: selected ? mood.color + "40" : c.surface, borderColor: selected ? mood.color : "transparent" }, style]}>
        <Text style={styles.emoji}>{mood.emoji}</Text>
      </Animated.View>
      <Txt variant="caption" tone={selected ? "ink" : "muted"}>
        {mood.label}
      </Txt>
    </PressableScale>
  );
}

/** Cinco caras de peor a mejor. Cada una suena más aguda que la anterior. */
export function MoodPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <View style={styles.row}>
      {MOODS.map((m) => (
        <MoodButton
          key={m.value}
          mood={m}
          selected={value === m.value}
          onPress={() => {
            feedback.select(m.value + 1);
            onChange(m.value);
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  item: { alignItems: "center", gap: 6, width: 64 },
  face: { width: 60, height: 60, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 2.5 },
  emoji: { fontSize: 32 },
});
