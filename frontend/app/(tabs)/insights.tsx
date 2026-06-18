import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import Svg, { Path, Circle, Polyline } from "react-native-svg";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";

import { colors, spacing, radius, type, font } from "@/src/theme";
import { getCategory } from "@/src/categories";
import { formatMoney } from "@/src/format";
import { getAllExpenses, Expense } from "@/src/db";
import { storage } from "@/src/utils/storage";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function donutSlice(cx: number, cy: number, rO: number, rI: number, start: number, end: number): string {
  const large = end - start > 180 ? 1 : 0;
  const oS = polar(cx, cy, rO, end);
  const oE = polar(cx, cy, rO, start);
  const iS = polar(cx, cy, rI, start);
  const iE = polar(cx, cy, rI, end);
  return `M ${oS.x} ${oS.y} A ${rO} ${rO} 0 ${large} 0 ${oE.x} ${oE.y} L ${iS.x} ${iS.y} A ${rI} ${rI} 0 ${large} 1 ${iE.x} ${iE.y} Z`;
}

export default function Insights() {
  const insets = useSafeAreaInsets();
  const now = new Date();

  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [symbol, setSymbol] = useState("₹");
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [sparkWidth, setSparkWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      storage.getItem<string>("currency_symbol", "₹").then((s) => setSymbol(s ?? "₹"));
      getAllExpenses().then(setAllExpenses);
    }, []),
  );

  const isIncome = (e: Expense) => e.category === "Income";
  const inMonth = (e: Expense, m: number, y: number) => {
    const d = new Date(`${e.expense_date}T00:00:00`);
    return d.getMonth() === m && d.getFullYear() === y;
  };

  const monthExpenses = useMemo(
    () => allExpenses.filter((e) => inMonth(e, selMonth, selYear)),
    [allExpenses, selMonth, selYear],
  );

  const spent = monthExpenses.filter((e) => !isIncome(e)).reduce((s, e) => s + e.amount, 0);
  const income = monthExpenses.filter(isIncome).reduce((s, e) => s + e.amount, 0);
  const saved = income - spent;

  // category breakdown (expenses only)
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.filter((e) => !isIncome(e)).forEach((e) => {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([key, amount]) => ({ key, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses]);

  // donut slices
  const slices = useMemo(() => {
    const total = categoryTotals.reduce((s, c) => s + c.amount, 0);
    if (total === 0) return [];
    const gap = 2;
    const avail = 360 - categoryTotals.length * gap;
    let cursor = 0;
    return categoryTotals.map((c) => {
      const sweep = (c.amount / total) * avail;
      const start = cursor + gap;
      const end = start + sweep;
      cursor = end;
      return { key: c.key, d: donutSlice(90, 90, 80, 52, start, end), colour: getCategory(c.key).iconColor };
    });
  }, [categoryTotals]);

  // payment method breakdown
  const paymentTotals = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.filter((e) => !isIncome(e)).forEach((e) => {
      map.set(e.payment_method, (map.get(e.payment_method) ?? 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses]);

  // daily spending
  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const dailyTotals = useMemo(() => {
    const arr = new Array(daysInMonth).fill(0);
    monthExpenses.filter((e) => !isIncome(e)).forEach((e) => {
      const d = new Date(`${e.expense_date}T00:00:00`).getDate();
      arr[d - 1] += e.amount;
    });
    return arr;
  }, [monthExpenses, daysInMonth]);

  const maxDaily = Math.max(...dailyTotals, 0);
  const activeDays = dailyTotals.filter((v) => v > 0).length;
  const peakIdx = dailyTotals.reduce((best, v, i) => (v > dailyTotals[best] ? i : best), 0);
  const peakValue = dailyTotals[peakIdx] ?? 0;

  // smart insight
  const prevMonth = selMonth === 0 ? 11 : selMonth - 1;
  const prevYear = selMonth === 0 ? selYear - 1 : selYear;
  const insight = useMemo(() => {
    if (monthExpenses.length === 0) return null;
    const prev = allExpenses.filter((e) => inMonth(e, prevMonth, prevYear) && !isIncome(e));
    const prevByCat = new Map<string, number>();
    prev.forEach((e) => prevByCat.set(e.category, (prevByCat.get(e.category) ?? 0) + e.amount));
    // 1. category change >30%
    for (const c of categoryTotals) {
      const p = prevByCat.get(c.key) ?? 0;
      if (p > 0) {
        const change = ((c.amount - p) / p) * 100;
        if (Math.abs(change) > 30) {
          const dir = change > 0 ? "up" : "down";
          return `Your ${c.key} spending is ${dir} ${Math.abs(Math.round(change))}% vs last month (${formatMoney(p, symbol)} → ${formatMoney(c.amount, symbol)})`;
        }
      }
    }
    // 2. UPI most transactions
    const txByMethod = new Map<string, number>();
    monthExpenses.filter((e) => !isIncome(e)).forEach((e) => txByMethod.set(e.payment_method, (txByMethod.get(e.payment_method) ?? 0) + 1));
    let topMethod = ""; let topCount = 0;
    txByMethod.forEach((v, k) => { if (v > topCount) { topCount = v; topMethod = k; } });
    if (topMethod === "UPI" && topCount > 0) {
      return `UPI is your most-used payment method — ${topCount} transaction${topCount === 1 ? "" : "s"} this month`;
    }
    // 3. peak day
    if (peakValue > 0) {
      const d = new Date(selYear, selMonth, peakIdx + 1);
      return `Your biggest spending day was ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} at ${formatMoney(peakValue, symbol)}`;
    }
    // 4. fallback
    return `You've tracked ${monthExpenses.length} expense${monthExpenses.length === 1 ? "" : "s"} totalling ${formatMoney(spent, symbol)} this month`;
  }, [monthExpenses, categoryTotals, allExpenses, prevMonth, prevYear, peakValue, peakIdx, selMonth, selYear, spent, symbol]);

  // month navigation
  const isCurrent = selMonth === now.getMonth() && selYear === now.getFullYear();
  const firstOfSel = new Date(selYear, selMonth, 1);
  const hasEarlier = allExpenses.some((e) => new Date(`${e.expense_date}T00:00:00`) < firstOfSel);

  const goBack = () => {
    if (selMonth === 0) {
      setSelMonth(11);
      setSelYear((y) => y - 1);
    } else setSelMonth((m) => m - 1);
  };
  const goForward = () => {
    if (isCurrent) return;
    if (selMonth === 11) {
      setSelMonth(0);
      setSelYear((y) => y + 1);
    } else setSelMonth((m) => m + 1);
  };

  const grandPayment = paymentTotals.reduce((s, p) => s + p.amount, 0);
  const topCat = categoryTotals[0];

  return (
    <View style={styles.root} testID="insights-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.base, paddingBottom: 100 }}>
        <Text style={[type.heading, { paddingHorizontal: spacing.screenH }]}>Insights</Text>

        {/* Month navigator */}
        <View style={styles.monthNav}>
          <Pressable testID="month-back" onPress={goBack} hitSlop={8}>
            <Ionicons name="chevron-back-outline" size={22} color={hasEarlier ? colors.textSecondary : colors.textTertiary} />
          </Pressable>
          <Text style={[type.title, { flex: 1, textAlign: "center" }]} testID="month-label">
            {MONTHS_LONG[selMonth]} {selYear}
          </Text>
          <Pressable testID="month-forward" onPress={goForward} hitSlop={8} disabled={isCurrent}>
            <Ionicons name="chevron-forward-outline" size={22} color={isCurrent ? colors.textTertiary : colors.textSecondary} />
          </Pressable>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <SummaryCard label="SPENT" value={formatMoney(spent, symbol)} colour={colors.expense} />
          <SummaryCard label="INCOME" value={formatMoney(income, symbol)} colour={colors.income} />
          <SummaryCard
            label="SAVED"
            value={formatMoney(saved, symbol)}
            colour={saved > 0 ? colors.income : saved < 0 ? colors.expense : colors.textPrimary}
          />
        </View>

        {/* Category breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>By Category</Text>
          <View style={{ alignItems: "center", marginBottom: spacing.base }}>
            <Svg width={180} height={180}>
              {slices.length === 0 ? (
                <Circle cx={90} cy={90} r={66} stroke={colors.surface} strokeWidth={28} fill="none" />
              ) : (
                slices.map((s, i) => <DonutSlice key={s.key} d={s.d} colour={s.colour} index={i} />)
              )}
            </Svg>
            <View style={styles.donutCenter} pointerEvents="none">
              {topCat ? (
                <>
                  <Text style={[type.caption, { color: colors.textSecondary }]}>{topCat.key}</Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 16, color: colors.textPrimary }}>
                    {formatMoney(topCat.amount, symbol)}
                  </Text>
                </>
              ) : (
                <Text style={[type.caption, { color: colors.textTertiary }]}>No data this month</Text>
              )}
            </View>
          </View>

          {categoryTotals.map((c) => {
            const pct = spent > 0 ? Math.round((c.amount / spent) * 100) : 0;
            return (
              <View key={c.key} style={styles.catRow}>
                <View style={[styles.catDot, { backgroundColor: getCategory(c.key).iconColor }]} />
                <Text style={[styles.catName, { flex: 1 }]}>{c.key}</Text>
                <Text style={styles.catAmount}>{formatMoney(c.amount, symbol)}</Text>
                <Text style={styles.catPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        {/* Payment method */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>By Payment Method</Text>
          {paymentTotals.length === 0 ? (
            <Text style={[type.caption, { color: colors.textTertiary }]}>No spending this month</Text>
          ) : (
            paymentTotals.map((p, i) => (
              <PaymentBar
                key={p.method}
                method={p.method}
                amount={p.amount}
                fraction={grandPayment > 0 ? p.amount / grandPayment : 0}
                symbol={symbol}
                index={i}
              />
            ))
          )}
        </View>

        {/* Spending trend */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Daily Spending</Text>
          <View onLayout={(e: LayoutChangeEvent) => setSparkWidth(e.nativeEvent.layout.width)}>
            {sparkWidth > 0 && (
              <Sparkline width={sparkWidth} daily={dailyTotals} maxDaily={maxDaily} daysInMonth={daysInMonth} />
            )}
          </View>
          <View style={styles.trendMeta}>
            <Text style={styles.trendMetaText}>{activeDays} active spending day{activeDays === 1 ? "" : "s"}</Text>
            {peakValue > 0 && (
              <Text style={styles.trendMetaText}>
                Peak: {formatMoney(peakValue, symbol)} on {new Date(selYear, selMonth, peakIdx + 1).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </Text>
            )}
          </View>
        </View>

        {/* Smart insight */}
        {insight && (
          <View style={styles.insightCard} testID="smart-insight">
            <Ionicons name="bulb-outline" size={18} color={colors.indigoHover} />
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryCard({ label, value, colour }: { label: string; value: string; colour: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colour }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function DonutSlice({ d, colour, index }: { d: string; colour: string; index: number }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(index * 80, withTiming(1, { duration: 300 }));
  }, [index]);
  const animatedProps = useAnimatedProps(() => ({ opacity: o.value }));
  return <AnimatedPath d={d} fill={colour} animatedProps={animatedProps} />;
}

function PaymentBar({
  method,
  amount,
  fraction,
  symbol,
  index,
}: {
  method: string;
  amount: number;
  fraction: number;
  symbol: string;
  index: number;
}) {
  const [w, setW] = useState(0);
  const fill = useSharedValue(0);
  useEffect(() => {
    if (w > 0) {
      fill.value = 0;
      fill.value = withDelay(index * 60, withTiming(w * fraction, { duration: 500 }));
    }
  }, [w, fraction, index]);
  const fillStyle = useAnimatedStyle(() => ({ width: fill.value }));
  return (
    <View style={styles.payRow}>
      <Text style={styles.payName}>{method}</Text>
      <View style={styles.payTrack} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.payFill, fillStyle]} />
      </View>
      <Text style={styles.payAmount}>{formatMoney(amount, symbol)}</Text>
    </View>
  );
}

function Sparkline({
  width,
  daily,
  maxDaily,
  daysInMonth,
}: {
  width: number;
  daily: number[];
  maxDaily: number;
  daysInMonth: number;
}) {
  const H = 80;
  const baseline = H;
  const top = 10;
  const usable = H - top;
  const xFor = (i: number) => (daysInMonth > 1 ? (i / (daysInMonth - 1)) * width : width / 2);
  const yFor = (v: number) => (maxDaily > 0 ? H - (v / maxDaily) * usable : baseline);

  const points = daily.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
  const hasData = maxDaily > 0;
  let areaPath = "";
  if (hasData) {
    areaPath = `M ${xFor(0)} ${baseline} ` + daily.map((v, i) => `L ${xFor(i)} ${yFor(v)}`).join(" ") + ` L ${xFor(daysInMonth - 1)} ${baseline} Z`;
  }
  const labelDays = [1, 8, 15, 22, daysInMonth].filter((d, i, a) => a.indexOf(d) === i && d <= daysInMonth);

  return (
    <Animated.View entering={FadeIn.duration(700)}>
      <Svg width={width} height={H}>
        {hasData && <Path d={areaPath} fill="rgba(79,70,229,0.12)" />}
        <Polyline points={points} stroke={colors.indigo} strokeWidth={2} fill="none" />
        {hasData &&
          daily.map((v, i) =>
            v > 0 ? <Circle key={i} cx={xFor(i)} cy={yFor(v)} r={3} fill={colors.indigo} /> : null,
          )}
      </Svg>
      <View style={styles.axisRow}>
        {labelDays.map((d) => (
          <Text key={d} style={[styles.axisLabel, { position: "absolute", left: xFor(d - 1) - 6 }]}>
            {d}
          </Text>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  monthNav: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.screenH,
    flexDirection: "row",
    alignItems: "center",
  },

  summaryRow: { marginTop: spacing.base, paddingHorizontal: spacing.screenH, flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.button, paddingVertical: 14, paddingHorizontal: 12, alignItems: "center" },
  summaryLabel: { fontFamily: font.medium, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.5 },
  summaryValue: { fontFamily: font.bold, fontSize: 20, marginTop: spacing.xs },

  card: {
    marginTop: spacing.base,
    marginHorizontal: spacing.screenH,
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    padding: spacing.lg,
  },
  cardLabel: {
    fontFamily: font.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginBottom: spacing.base,
  },

  donutCenter: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },

  catRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  catName: { fontFamily: font.regular, fontSize: 13, color: colors.textPrimary },
  catAmount: { fontFamily: font.semibold, fontSize: 13, color: colors.expense, marginRight: spacing.sm },
  catPct: { fontFamily: font.regular, fontSize: 11, color: colors.textTertiary, width: 34, textAlign: "right" },

  payRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  payName: { fontFamily: font.regular, fontSize: 13, color: colors.textPrimary, width: 90 },
  payTrack: { flex: 1, height: 6, backgroundColor: colors.surface, borderRadius: 3, marginHorizontal: 10, overflow: "hidden" },
  payFill: { height: 6, backgroundColor: colors.indigo, borderRadius: 3 },
  payAmount: { fontFamily: font.regular, fontSize: 12, color: colors.textSecondary, width: 70, textAlign: "right" },

  trendMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  trendMetaText: { fontFamily: font.regular, fontSize: 11, color: colors.textTertiary },
  axisRow: { height: 14, marginTop: 2 },
  axisLabel: { fontFamily: font.regular, fontSize: 9, color: colors.textTertiary },

  insightCard: {
    marginTop: spacing.base,
    marginHorizontal: spacing.screenH,
    backgroundColor: "rgba(79,70,229,0.10)",
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.22)",
    borderRadius: radius.button,
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  insightText: { fontFamily: font.regular, fontSize: 13, color: colors.textPrimary, flex: 1, lineHeight: 20 },
});
