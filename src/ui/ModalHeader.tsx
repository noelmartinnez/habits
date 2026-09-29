import { StyleSheet, View } from "react-native";
import { PressableScale, Txt } from "./primitives";
import { useTheme } from "./theme";

/** Cabecera de las pantallas modales: cancelar a la izquierda, acción a la derecha. */
export function ModalHeader({
  title,
  onCancel,
  action,
  onAction,
  actionDisabled,
}: {
  title: string;
  onCancel: () => void;
  action?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.bar, { borderBottomColor: c.line }]}>
      <PressableScale onPress={onCancel} hitSlop={10} accessibilityRole="button" style={styles.side}>
        <Txt variant="label" tone="muted">
          Cancelar
        </Txt>
      </PressableScale>
      <Txt variant="heading" numberOfLines={1} style={styles.title}>
        {title}
      </Txt>
      <View style={[styles.side, { alignItems: "flex-end" }]}>
        {action && onAction ? (
          <PressableScale onPress={onAction} disabled={actionDisabled} hitSlop={10} accessibilityRole="button">
            <Txt variant="label" style={{ opacity: actionDisabled ? 0.35 : 1 }}>
              {action}
            </Txt>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  side: { width: 90 },
  title: { flex: 1, textAlign: "center" },
});
