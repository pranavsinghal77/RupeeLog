import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { getStreak } from "@/src/streak";

const REMINDER_ID = "rupeelog_daily_reminder";
const IS_WEB = Platform.OS === "web";

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Show scheduled notifications even when the app is in the foreground.
if (!IS_WEB) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// On web there is no native permission flow — treat as granted no-ops so the
// preview/toggle stays interactive. Real permission handling runs on device.
export async function requestNotificationPermission(): Promise<boolean> {
  if (IS_WEB) return true;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function getNotificationPermission(): Promise<boolean> {
  if (IS_WEB) return true;
  const s = await Notifications.getPermissionsAsync();
  return s.granted;
}

export async function scheduleDailyReminder(): Promise<void> {
  if (IS_WEB) return;
  await cancelDailyReminder();
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Daily reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: "Don't break your streak! 🔥",
      body: "Log today's expenses and keep your streak alive.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 21,
      minute: 30,
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  if (IS_WEB) return;
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
}

// Smart reconcile, intended to run when the app becomes active.
// After 9:00 PM: if the user already logged today, cancel tonight's nudge;
// otherwise make sure the reminder is scheduled so they get nudged at 9:30 PM.
export async function applySmartReminder(): Promise<void> {
  if (IS_WEB) return;
  const now = new Date();
  if (now.getHours() < 21) return; // only relevant from 9:00 PM onward
  const { lastLogDate } = await getStreak();
  if (lastLogDate === todayStr()) {
    await cancelDailyReminder();
  } else {
    await scheduleDailyReminder();
  }
}
