import { storage } from "@/src/utils/storage";

const KEY = "rupeelog_streak_data";

export interface StreakData {
  lastLogDate: string | null;
  currentStreak: number;
  longestStreak: number;
}

const DEFAULT: StreakData = { lastLogDate: null, currentStreak: 0, longestStreak: 0 };

function fmt(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function getStreak(): Promise<StreakData> {
  const raw = await storage.getItem<string>(KEY, "");
  if (!raw) return DEFAULT;
  try {
    return JSON.parse(raw) as StreakData;
  } catch {
    return DEFAULT;
  }
}

// Idempotent per day: maintains a daily logging streak.
export async function updateStreak(): Promise<StreakData> {
  const data = await getStreak();
  const today = fmt(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = fmt(y);

  if (data.lastLogDate === today) return data;

  const cur = data.lastLogDate === yesterday ? data.currentStreak + 1 : 1;
  const longest = Math.max(data.longestStreak, cur);
  const next: StreakData = { lastLogDate: today, currentStreak: cur, longestStreak: longest };
  await storage.setItem(KEY, JSON.stringify(next));
  return next;
}
