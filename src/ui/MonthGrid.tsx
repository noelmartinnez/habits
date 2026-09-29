import { Ionicons } from "@expo/vector-icons";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { addDaysKey, eachDayKey, toKey, weekStartKey } from "../core/dates";
import { WEEKDAY_SHORT } from "../core/schedule";
import { PressableScale, Txt } from "./primitives";
import { useTheme } from "./theme";

interface Props {
  month: Date;
  onMonthChange: (m: Date) => void;
  /** No deja avanzar más allá de este mes. */
  maxMonth?: Date;
  renderDay: (key: string) => ReactNode;
}

/** Calendario mensual (semanas de lunes a domingo). Cada celda la pinta quien lo usa. */
export function MonthGrid({ month, onMonthChange, maxMonth, renderDay }: Props) {
  const { c } = useTheme();
  const first = toKey(startOfMonth(month));
  const last = toKey(endOfMonth(month));
  const gridStart = weekStartKey(first);
  const gridEnd = addDaysKey(weekStartKey(last), 6);
  const keys = [...eachDayKey(gridStart, gridEnd)];
  const weeks: string[][] = [];
  for (let i = 0; i < keys.length; i += 7) weeks.push(keys.slice(i, i + 7));
  const canNext = !maxMonth || startOfMonth(month) < startOfMonth(maxMonth);
  const title = format(month, "MMMM yyyy", { locale: es });

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.nav}>
        <PressableScale onPress={() => onMonthChange(addMonths(month, -1))} hitSlop={10} accessibilityLabel="Mes anterior" style={styles.arrow}>
          <Ionicons name="chevron-back" size={22} color={c.ink} />
        </PressableScale>
        <Txt variant="heading" style={{ textTransform: "capitalize" }}>
          {title}
        </Txt>
        <PressableScale
          onPress={() => canNext && onMonthChange(addMonths(month, 1))}
          disabled={!canNext}
          hitSlop={10}
          accessibilityLabel="Mes siguiente"
          style={[styles.arrow, { opacity: canNext ? 1 : 0.25 }]}
        >
          <Ionicons name="chevron-forward" size={22} color={c.ink} />
        </PressableScale>
      </View>
      <View style={styles.week}>
        {WEEKDAY_SHORT.map((d) => (
          <Txt key={d} variant="caption" tone="faint" style={styles.head}>
            {d}
          </Txt>
        ))}
      </View>
      {weeks.map((w) => (
        <View key={w[0]} style={styles.week}>
          {w.map((k) => (
            <View key={k} style={[styles.cell, { opacity: k < first || k > last ? 0.25 : 1 }]}>
              {renderDay(k)}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  arrow: { padding: 6 },
  week: { flexDirection: "row", gap: 6 },
  head: { flex: 1, textAlign: "center" },
  cell: { flex: 1, aspectRatio: 1 },
});
