import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/tabs";
import { fonts, useTheme } from "../../ui/theme";

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Hoy", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "sunny" : "sunny-outline"} size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="historial"
        options={{ title: "Historial", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="descubrimientos"
        options={{ title: "Descubrimientos", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={24} color={color} /> }}
      />
    </Tabs>
  );
}
