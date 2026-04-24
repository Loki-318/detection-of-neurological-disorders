import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REMINDER_ID_KEY = "neuroscan_reminder_id";
const REMINDER_HOUR_KEY = "neuroscan_reminder_hour";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotifPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const r = await Notifications.requestPermissionsAsync();
  return r.status === "granted";
}

export async function scheduleWeeklyReminder(hour: number = 9): Promise<string | null> {
  if (Platform.OS === "web") return null;
  // Cancel existing
  const existing = await AsyncStorage.getItem(REMINDER_ID_KEY);
  if (existing) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existing);
    } catch {}
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Time for your NeuroScan 🧠",
      body: "Keeping a weekly baseline helps detect early changes. Tap to scan now.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute: 0,
      weekday: 1, // Sunday = 1 in Expo; schedules weekly
      repeats: true,
    } as any,
  });
  await AsyncStorage.setItem(REMINDER_ID_KEY, id);
  await AsyncStorage.setItem(REMINDER_HOUR_KEY, String(hour));
  return id;
}

export async function cancelReminder(): Promise<void> {
  const existing = await AsyncStorage.getItem(REMINDER_ID_KEY);
  if (existing) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existing);
    } catch {}
  }
  await AsyncStorage.removeItem(REMINDER_ID_KEY);
  await AsyncStorage.removeItem(REMINDER_HOUR_KEY);
}

export async function getReminderState(): Promise<{ enabled: boolean; hour: number }> {
  const id = await AsyncStorage.getItem(REMINDER_ID_KEY);
  const hour = await AsyncStorage.getItem(REMINDER_HOUR_KEY);
  return { enabled: !!id, hour: hour ? parseInt(hour, 10) : 9 };
}
