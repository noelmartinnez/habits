import { Alert, Linking } from "react-native";
import { ensurePermission } from "./notifications";

/** Pide permiso para avisar. Si ya se denegó, explica cómo activarlo en los ajustes del teléfono. */
export async function askForReminders(): Promise<boolean> {
  if (await ensurePermission(true)) return true;
  Alert.alert("Los avisos están desactivados", "Para que Rutinas te avise, activa las notificaciones en los ajustes del teléfono.", [
    { text: "Ahora no", style: "cancel" },
    { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
  ]);
  return false;
}
