import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";

import { colors, spacing, radius, type, font, cardShadow } from "@/src/theme";
import { getCategory } from "@/src/categories";
import { formatMoney, shortMoney, relativeTime, formatIndian } from "@/src/format";
import { getAllExpenses, addExpense, Expense } from "@/src/db";
import { storage } from "@/src/utils/storage";
import { getStreak, updateStreak, StreakData } from "@/src/streak";
import { getTemplates, deleteTemplate, Template } from "@/src/templates";

interface MonthBar {
  label: string;
  total: number;
  current: boolean;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  return "Good evening,";
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState("there");
  const [symbol, setSymbol] = useState("₹");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [streak, setStreak] = useState<StreakData>({ lastLogDate: null, currentStreak: 0, longestStreak: 0 });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [toast, setToast] = useState("");
  const [tplMenu, setTplMenu] = useState<Template | null>(null);

  const load = useCallback(() => {
    storage.getItem<string>("user_name", "there").then((n) => setName(n ?? "there"));
    storage.getItem<string>("currency_symbol", "₹").then((s) => setSymbol(s ?? "₹"));
    getAllExpenses().then(setExpenses);
    getStreak().then(setStreak);
    getTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    updateStreak().then(setStreak);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const showGreenToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const logTemplate = async (t: Template) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const now = new Date();
    const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    await addExpense({
      title: t.title,
      amount: t.amount,
      category: t.category,
      payment_method: t.paymentMethod,
      expense_date: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`,
      expense_time: `${p(now.getHours())}:${p(now.getMinutes())}`,
      note: null,
      created_at: now.toISOString(),
    });
    updateStreak().then(setStreak);
    showGreenToast(`${t.title} logged`);
    load();
  };

  const removeTemplate = async (t: Template) => {
    await deleteTemplate(t.id);
    setTplMenu(null);
    getTemplates().then(setTemplates);
  };

  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();

  const isIncome = (e: Expense) => e.category === "Income";

  const monthItems = expenses.filter((e) => {
    const d = new Date(e.expense_date);
    return d.getMonth() === curMonth && d.getFullYear() === curYear;
  });
  const monthExpense = monthItems.filter((e) => !isIncome(e)).reduce((s, e) => s + e.amount, 0);
  const monthIncome = monthItems.filter(isIncome).reduce((s, e) => s + e.amount, 0);
  const net = monthIncome - monthExpense;

  // last 6 months bars
  const bars: MonthBar[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(curYear, curMonth - i, 1);
    const total = expenses
      .filter((e) => {
        const ed = new Date(e.expense_date);
        return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear() && !isIncome(e);
      })
      .reduce((s, e) => s + e.amount, 0);
    bars.push({ label: MONTH_NAMES[d.getMonth()], total, current: i === 0 });
  }
  const maxBar = Math.max(...bars.map((b) => b.total), 1);

  const recent = expenses.slice(0, 5);
  const monthLabel = `${MONTH_NAMES[curMonth]} ${curYear}`;

  return (
    <View style={styles.root} testID="home-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.base, paddingBottom: 140 }}
        style={{ paddingHorizontal: spacing.screenH }}
      >
        {/* Top row */}
        <View style={styles.topRow}>
          <View>
            <Text style={type.caption}>{greeting()}</Text>
            <Text style={[type.heading, { marginTop: 2 }]} testID="user-name">
              {name}
            </Text>
          </View>
          <View style={styles.topActions}>
            <Pressable testID="notification-bell" hitSlop={8}>
              <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
            </Pressable>
            <Pressable testID="settings-gear" hitSlop={8} onPress={() => router.push("/settings")}>
              <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Logging streak */}
        {streak.currentStreak >= 2 && (
          <View style={styles.streakRow} testID="streak-row">
            <Ionicons name="flame-outline" size={16} color={streak.currentStreak >= 7 ? "#EF4444" : "#F59E0B"} />
            <Text style={[styles.streakText, { color: streak.currentStreak >= 7 ? "#EF4444" : "#F59E0B" }]}>
              {streak.currentStreak}-day streak
            </Text>
            <View style={styles.streakDot} />
            <Text style={styles.streakBest}>Best: {streak.longestStreak} days</Text>
          </View>
        )}

        {/* Hero card */}
        <Animated.View entering={FadeIn.duration(200)} style={[styles.heroCard, cardShadow]} testID="hero-card">
          <View style={styles.heroTop}>
            <Text style={type.micro}>This month</Text>
            <Text style={[type.caption, { color: colors.textTertiary }]}>{monthLabel}</Text>
          </View>
          <Text style={[type.display, { marginTop: spacing.sm }]} testID="month-total">
            {formatMoney(monthExpense, symbol)}
          </Text>
          <Text style={[type.caption, { marginTop: spacing.xs }]}>Total spent</Text>

          <View style={styles.heroDivider} />

          <View style={styles.heroStats}>
            <View style={styles.heroCol}>
              <Text style={type.caption}>Income</Text>
              <Text style={[styles.statValue, { color: colors.income }]}>{formatMoney(monthIncome, symbol)}</Text>
            </View>
            <View style={styles.heroVDivider} />
            <View style={styles.heroCol}>
              <Text style={type.caption}>Expenses</Text>
              <Text style={[styles.statValue, { color: colors.expense }]}>{formatMoney(monthExpense, symbol)}</Text>
            </View>
            <View style={styles.heroVDivider} />
            <View style={styles.heroCol}>
              <Text style={type.caption}>Net</Text>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatMoney(net, symbol)}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Bar chart */}
        <Text style={[type.micro, { marginTop: spacing.xl }]}>Monthly overview</Text>
        <View style={[styles.chartCard, cardShadow]} testID="bar-chart">
          <View style={styles.chartRow}>
            {bars.map((b, i) => (
              <Bar key={i} bar={b} maxBar={maxBar} symbol={symbol} index={i} />
            ))}
          </View>
        </View>

        {/* Quick-add templates */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.xl, marginBottom: spacing.md }}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {templates.map((t) => {
            const cat = getCategory(t.category);
            return (
              <Pressable
                key={t.id}
                testID={`template-${t.id}`}
                style={styles.tplChip}
                onPress={() => logTemplate(t)}
                onLongPress={() => setTplMenu(t)}
              >
                <View style={styles.tplRow1}>
                  <Ionicons name={cat.icon} size={14} color={cat.iconColor} />
                  <Text style={styles.tplTitle} numberOfLines={1}>
                    {t.title}
                  </Text>
                </View>
                <Text style={styles.tplMeta}>
                  ₹{formatIndian(t.amount)} · {t.paymentMethod}
                </Text>
              </Pressable>
            );
          })}
          <Pressable testID="add-template-chip" style={styles.tplAdd} onPress={() => router.push("/add-template")}>
            <Ionicons name="add-outline" size={14} color={colors.indigoHover} />
            <Text style={styles.tplAddText}>Add</Text>
          </Pressable>
        </ScrollView>

        {/* Recent */}
        <View style={styles.recentHeader}>
          <Text style={type.heading}>Recent</Text>
          <Pressable testID="see-all-button" hitSlop={8}>
            <Text style={[type.caption, { color: colors.indigo, fontFamily: font.medium }]}>See all →</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: spacing.md }}>
          {recent.map((e) => {
            const cat = getCategory(e.category);
            const income = isIncome(e);
            return (
              <View key={e.id} style={styles.expenseRow} testID={`expense-row-${e.id}`}>
                <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon} size={18} color={cat.iconColor} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={type.title} numberOfLines={1}>
                    {e.title}
                  </Text>
                  <Text style={[type.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                    {e.payment_method}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[type.title, { color: income ? colors.income : colors.expense }]}
                  >
                    {income ? "+" : "-"}
                    {formatMoney(e.amount, symbol).replace("-", "")}
                  </Text>
                  <Text style={[type.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                    {relativeTime(e.created_at)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable
        testID="add-fab"
        style={[styles.fab, { bottom: insets.bottom + 76 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/add-expense");
        }}
      >
        <Ionicons name="add-outline" size={28} color="#FFFFFF" />
      </Pressable>

      {/* Green success toast */}
      {toast !== "" && (
        <Animated.View
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(250)}
          style={[styles.greenToast, { bottom: insets.bottom + 90 }]}
          testID="green-toast"
        >
          <Text style={styles.greenToastText}>✓ {toast}</Text>
        </Animated.View>
      )}

      {/* Template long-press menu */}
      <Modal visible={!!tplMenu} transparent animationType="fade" onRequestClose={() => setTplMenu(null)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setTplMenu(null)}>
          <View style={styles.menuSheet}>
            <Pressable style={styles.menuOption} testID="delete-template" onPress={() => tplMenu && removeTemplate(tplMenu)}>
              <Ionicons name="trash-outline" size={18} color={colors.expense} />
              <Text style={[styles.menuText, { color: colors.expense }]}>Delete template</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuOption} onPress={() => setTplMenu(null)}>
              <Text style={styles.menuText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Bar({ bar, maxBar, symbol, index }: { bar: MonthBar; maxBar: number; symbol: string; index: number }) {
  const progress = useSharedValue(0);
  const targetH = Math.max(6, (bar.total / maxBar) * 120);

  useFocusEffect(
    useCallback(() => {
      progress.value = 0;
      progress.value = withDelay(
        index * 50,
        withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
      );
    }, [index, bar.total]),
  );

  const fillStyle = useAnimatedStyle(() => ({ height: progress.value * targetH }));

  return (
    <View style={styles.barCol}>
      {bar.total > 0 && <Text style={styles.barAmount}>{shortMoney(bar.total, symbol)}</Text>}
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { backgroundColor: bar.current ? colors.teal : colors.indigo },
            fillStyle,
          ]}
        />
      </View>
      <Text style={styles.barLabel}>{bar.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.base },

  streakRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  streakText: { fontFamily: font.medium, fontSize: 13 },
  streakDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary, marginHorizontal: spacing.xs },
  streakBest: { fontFamily: font.regular, fontSize: 12, color: colors.textTertiary },

  tplChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.icon,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tplRow1: { flexDirection: "row", alignItems: "center", gap: 4 },
  tplTitle: { fontFamily: font.semibold, fontSize: 12, color: colors.textPrimary, maxWidth: 80, marginLeft: 4 },
  tplMeta: { fontFamily: font.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  tplAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.icon,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(79,70,229,0.4)",
  },
  tplAddText: { fontFamily: font.medium, fontSize: 12, color: colors.indigoHover },

  greenToast: {
    position: "absolute",
    left: spacing.screenH,
    right: spacing.screenH,
    zIndex: 999,
    backgroundColor: "rgba(16,185,129,0.15)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    borderRadius: radius.icon,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    alignItems: "center",
  },
  greenToastText: { fontFamily: font.medium, fontSize: 13, color: colors.textPrimary },

  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  menuSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xl,
  },
  menuOption: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.base, paddingHorizontal: spacing.xl },
  menuText: { fontFamily: font.medium, fontSize: 15, color: colors.textPrimary },
  menuDivider: { height: 1, backgroundColor: colors.divider, marginHorizontal: spacing.xl },

  heroCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.heroBorder,
    borderRadius: radius.large,
    padding: spacing.cardPad,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.base },
  heroStats: { flexDirection: "row" },
  heroCol: { flex: 1, alignItems: "center" },
  heroVDivider: { width: 1, backgroundColor: colors.divider },
  statValue: { fontFamily: font.semibold, fontSize: 16, marginTop: spacing.xs },

  chartCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.large,
    padding: spacing.cardPad,
  },
  chartRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, height: 170 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barAmount: { fontFamily: font.regular, fontSize: 11, color: colors.textSecondary, marginBottom: 6 },
  barTrack: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    backgroundColor: colors.surface,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: 8 },
  barLabel: { fontFamily: font.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm },

  recentHeader: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.chip,
    alignItems: "center",
    justifyContent: "center",
  },

  fab: {
    position: "absolute",
    right: spacing.screenH,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.indigo,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    shadowColor: colors.indigo,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
});
