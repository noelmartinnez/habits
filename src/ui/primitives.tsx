import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, StyleSheet, Text, type TextProps, type TextStyle, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { fonts, radius, useTheme } from "./theme";

type Variant = "display" | "title" | "heading" | "body" | "label" | "caption";

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17 },
};

interface TxtProps extends TextProps {
  variant?: Variant;
  tone?: "ink" | "muted" | "faint" | "danger";
  color?: string;
}

export function Txt({ variant = "body", tone = "ink", color, style, ...rest }: TxtProps) {
  const { c } = useTheme();
  return <Text {...rest} style={[variants[variant], { color: color ?? c[tone] }, style]} />;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  /** Cuánto se encoge al pulsar. */
  scaleTo?: number;
  children?: ReactNode;
}

/** Botón que se hunde un poco al pulsarlo: todo lo que se toca en la app responde así. */
export function PressableScale({ scaleTo = 0.96, style, onPressIn, onPressOut, children, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, { duration: 90 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 12, stiffness: 320 }));
        onPressOut?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

interface ButtonProps extends Omit<PressableScaleProps, "children"> {
  label: string;
  kind?: "primary" | "secondary" | "danger" | "ghost";
  icon?: ReactNode;
}

export function Button({ label, kind = "primary", icon, style, disabled, ...rest }: ButtonProps) {
  const { c } = useTheme();
  const bg = kind === "primary" ? c.accent : kind === "secondary" ? c.sunken : "transparent";
  const fg = kind === "primary" ? c.onAccent : kind === "danger" ? c.danger : c.ink;
  return (
    <PressableScale
      {...rest}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }, style]}
    >
      {icon}
      <Txt variant="label" color={fg}>
        {label}
      </Txt>
    </PressableScale>
  );
}

export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const { c } = useTheme();
  return <View style={[styles.card, { backgroundColor: c.surface }, style]}>{children}</View>;
}

/** Ficha seleccionable (contextos, frecuencia…). */
export function Chip({
  label,
  emoji,
  selected,
  color,
  onPress,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  color?: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const on = color ?? c.accent;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? on : c.surface, borderColor: selected ? on : c.line }]}
    >
      {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
      <Txt variant="label" color={selected ? (color ? "#fff" : c.onAccent) : c.ink}>
        {label}
      </Txt>
    </PressableScale>
  );
}

export const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  card: { borderRadius: radius.lg, padding: 16 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  chipEmoji: { fontSize: 16 },
});
