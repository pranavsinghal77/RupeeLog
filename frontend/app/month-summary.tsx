import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { colors, spacing, radius, font } from "@/src/theme";
import { getCategory } from "@/src/categories";
import { formatMoney } from "@/src/format";
import { getMonthSummary, getPreviousMonthTotal, MonthSummary } from "@/src/db";
import { getStreak } from "@/src/streak";
import { storage } from "@/src/utils/storage";

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function prevMonthName(year: number, month: number): string {
  let pm = month - 1;
  if (pm < 0) pm = 11;
  return MONTHS_LONG[pm];
}
function fmtDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function MonthSummaryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { year: yearStr, month: monthStr } = useLocalSearchParams<{ year: string; month: string }>();
  const year = Number(yearStr);
  const month = Number(monthStr);

  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [prevTotal, setPrevTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [symbol, setSymbol] = useState("₹");
  const [displayTotal, setDisplayTotal] = useState(0);

  useEffect(() => {
    storage.getItem<string>("currency_symbol", "₹").then((s) => setSymbol(s ?? "₹"));
    getMonthSummary(year, month).then(setSummary);
    getPreviousMonthTotal(year, month).then(setPrevTotal);
    getStreak().then((s) => setStreak(s.currentStreak));
  }, [year, month]);

  // Count-up animation for the hero number.
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!summary) return;
    const target = summary.totalExpenses;
    const duration = 1200;
    let start: number | null = null;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (start === null) start = ts;
        const p = Math.min(1, (ts - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplayTotal(Math.round(target * eased));
        if (p < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    }, 400);
    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [summary]);

  const onShare = useCallback(async () => {
    if (!summary) return;
    const msg = `My ${MONTHS_LONG[month]} ${year} with RupeeLog 📊\n\nSpent: ${formatMoney(summary.totalExpenses, symbol)}\nTransactions: ${summary.transactionCount}\nTop category: ${summary.topCategory ?? "—"}\n\nTrack your expenses with RupeeLog 🇮🇳`;
    try {
      await Share.share({ message: msg });
    } catch {
      /* dismissed */
    }
  }, [summary, month, year, symbol]);

  const onContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace("/(tabs)");
  };

  if (!summary) {
    return <View style={styles.root}><StatusBar hidden /></View>;
  }

  const top4 = summary.categoryBreakdown.slice(0, 4);
  const diff = summary.totalExpenses - prevTotal;
  const showComparison = prevTotal > 0;

  return (
    <View style={styles.root} testID="month-summary-screen">
      <StatusBar hidden />
      {/* Soft indigo glow */}
      <View style={styles.glow} pointerEvents="none" />

      <Animated.View entering={FadeIn.duration(600)} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 60, paddingBottom: insets.bottom + spacing.xl }}
        >
          {/* Section 1 — header */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.center}>
            <Text style={styles.monthLabel}>
              {MONTHS_LONG[month]} {year}
            </Text>
            <Text style={styles.subLabel}>Your month in review</Text>
          </Animated.View>

          {/* Section 2 — hero number */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={[styles.center, { marginTop: spacing["2xl"] }]}>
            <Text style={styles.youSpent}>You spent</Text>
            <Text style={styles.hero} testID="summary-hero">
              {formatMoney(displayTotal, symbol)}
            </Text>
          </Animated.View>

          {/* Section 3 — stat cards */}
          <Animated.View entering={FadeInDown.delay(450).duration(400)} style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Transactions</Text>
              <Text style={styles.statValueBig}>{summary.transactionCount}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Top Category</Text>
              <Text style={styles.statValue} numberOfLines={1}>{summary.topCategory ?? "—"}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Biggest Day</Text>
              <Text style={styles.statValue}>{summary.biggestDay ? fmtDay(summary.biggestDay) : "—"}</Text>
            </View>
          </Animated.View>

          {/* Section 4 — category breakdown */}
          <Animated.View entering={FadeInDown.delay(600).duration(400)} style={styles.section}>
            <Text style={styles.sectionLabel}>Where it went</Text>
            {top4.map((c, i) => {
              const cat = getCategory(c.category);
              return (
                <View key={c.category} style={styles.catRow}>
                  <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
                    <Ionicons name={cat.icon} size={16} color={cat.iconColor} />
                  </View>
                  <Text style={styles.catName}>{c.category}</Text>
                  <Text style={styles.catAmount}>{formatMoney(c.total, symbol)}</Text>
                  <PercentBar fraction={summary.totalExpenses > 0 ? c.total / summary.totalExpenses : 0} colour={cat.iconColor} index={i} />
                </View>
              );
            })}
          </Animated.View>

          {/* Section 5 — comparison */}
          {showComparison && (
            <Animated.View entering={FadeInDown.delay(750).duration(400)} style={styles.section}>
              <View style={styles.compareCard}>
                <Text style={styles.compareLeft}>vs {prevMonthName(year, month)}</Text>
                {diff === 0 ? (
                  <Text style={[styles.compareRight, { color: colors.textSecondary }]}>Same as last month</Text>
                ) : (
                  <>
                    <Ionicons
                      name={diff > 0 ? "trending-up-outline" : "trending-down-outline"}
                      size={20}
                      color={diff > 0 ? colors.expense : colors.income}
                    />
                    <Text style={[styles.compareRight, { color: diff > 0 ? colors.expense : colors.income }]}>
                      {formatMoney(Math.abs(diff), symbol)} {diff > 0 ? "more" : "less"}
                    </Text>
                  </>
                )}
              </View>
            </Animated.View>
          )}

          {/* Section 6 — streak celebration */}
          {streak >= 3 && (
            <Animated.View entering={FadeInDown.delay(850).duration(400)} style={styles.section}>
              <View style={styles.streakCard}>
                <Ionicons name="flame-outline" size={20} color={streak >= 7 ? "#EF4444" : "#F59E0B"} />
                <Text style={styles.streakText}>
                  {streak >= 7
                    ? `You're on fire! ${streak}-day streak 🔥 Keep it going.`
                    : `Great habit! You've logged expenses ${streak} days in a row.`}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Section 7 — share + continue */}
          <Animated.View entering={FadeInDown.delay(950).duration(400)} style={[styles.section, { marginTop: spacing["2xl"], marginBottom: spacing["3xl"] }]}>
            <Pressable style={styles.shareBtn} onPress={onShare} testID="share-month">
              <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.shareText}>Share my month</Text>
            </Pressable>
            <Pressable style={styles.continueBtn} onPress={onContinue} testID="continue-dashboard">
              <Text style={styles.continueText}>Continue to dashboard →</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function PercentBar({ fraction, colour, index }: { fraction: number; colour: string; index: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(800 + index * 80, withTiming(fraction * 80, { duration: 500 }));
  }, [fraction, index]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { backgroundColor: colour }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: {
    position: "absolute",
    top: 80,
    alignSelf: "center",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(79,70,229,0.08)",
  },
  center: { alignItems: "center", paddingHorizontal: spacing.xl },

  monthLabel: { fontFamily: font.medium, fontSize: 14, color: colors.textSecondary, letterSpacing: 1.6, textTransform: "uppercase" },
  subLabel: { fontFamily: font.regular, fontSize: 13, color: colors.textTertiary, marginTop: spacing.xs },

  youSpent: { fontFamily: font.regular, fontSize: 14, color: colors.textSecondary },
  hero: { fontFamily: font.bold, fontSize: 48, color: colors.textPrimary, marginTop: spacing.xs },

  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: spacing.xl, marginTop: spacing["2xl"] },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.button, paddingVertical: spacing.base, paddingHorizontal: spacing.md, alignItems: "center" },
  statLabel: { fontFamily: font.medium, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: colors.textSecondary },
  statValueBig: { fontFamily: font.bold, fontSize: 22, color: colors.textPrimary, marginTop: spacing.xs },
  statValue: { fontFamily: font.bold, fontSize: 16, color: colors.textPrimary, marginTop: spacing.xs },

  section: { paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  sectionLabel: { fontFamily: font.medium, fontSize: 13, color: colors.textSecondary, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: spacing.md },

  catRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  catIcon: { width: 32, height: 32, borderRadius: radius.chip, alignItems: "center", justifyContent: "center" },
  catName: { fontFamily: font.regular, fontSize: 13, color: colors.textPrimary, flex: 1 },
  catAmount: { fontFamily: font.semibold, fontSize: 13, color: colors.expense },
  barTrack: { width: 80, height: 3, backgroundColor: colors.surface, borderRadius: 2, overflow: "hidden" },
  barFill: { height: 3, borderRadius: 2 },

  compareCard: { backgroundColor: colors.card, borderRadius: radius.button, paddingVertical: spacing.base, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  compareLeft: { fontFamily: font.regular, fontSize: 12, color: colors.textTertiary },
  compareRight: { fontFamily: font.semibold, fontSize: 14 },

  streakCard: { backgroundColor: "rgba(245,158,11,0.08)", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)", borderRadius: radius.button, paddingVertical: 14, paddingHorizontal: spacing.base, flexDirection: "row", alignItems: "center", gap: 10 },
  streakText: { fontFamily: font.regular, fontSize: 13, color: colors.textPrimary, flex: 1, lineHeight: 19 },

  shareBtn: { height: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: radius.button, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  shareText: { fontFamily: font.medium, fontSize: 14, color: colors.textSecondary },
  continueBtn: { height: 56, backgroundColor: colors.indigo, borderRadius: radius.button, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  continueText: { fontFamily: font.semibold, fontSize: 15, color: "#FFFFFF" },
});
