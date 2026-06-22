import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  runOnJS,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { colors, spacing, radius, type, font } from "@/src/theme";
import { CATEGORIES, PAYMENT_METHODS } from "@/src/categories";
import { addExpense, updateExpense, addExpenseToGroup } from "@/src/db";
import { updateStreak } from "@/src/streak";

const KEYS = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
  [".", "0", "⌫", "+"],
];
const OPERATORS = ["÷", "×", "−", "+"];

function evaluate(expr: string): number {
  const norm = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  const tokens: (number | string)[] = [];
  let num = "";
  for (const ch of norm) {
    if ("+-*/".includes(ch)) {
      if (num) {
        tokens.push(parseFloat(num));
        num = "";
      }
      tokens.push(ch);
    } else {
      num += ch;
    }
  }
  if (num) tokens.push(parseFloat(num));
  if (typeof tokens[tokens.length - 1] === "string") tokens.pop();
  if (tokens.length === 0) return 0;

  const p1: (number | string)[] = [tokens[0]];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as string;
    const v = tokens[i + 1] as number;
    if (op === "*") p1[p1.length - 1] = (p1[p1.length - 1] as number) * v;
    else if (op === "/") p1[p1.length - 1] = v ? (p1[p1.length - 1] as number) / v : 0;
    else p1.push(op, v);
  }
  let res = p1[0] as number;
  for (let i = 1; i < p1.length; i += 2) {
    const op = p1[i] as string;
    const v = p1[i + 1] as number;
    res = op === "+" ? res + v : res - v;
  }
  return Math.round(res * 100) / 100;
}

function fmtDateLabel(d: Date): string {
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const m = d.toLocaleDateString("en-IN", { month: "short" });
  const label = `${m} ${d.getDate()}`;
  return same ? `Today, ${label}` : label;
}
function fmtTimeLabel(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}
function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function AddExpense() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    amount?: string;
    category?: string;
    payment_method?: string;
    expense_date?: string;
    expense_time?: string;
    note?: string;
    group_id?: string;
  }>();
  const editingId = params.id ? Number(params.id) : null;
  const groupId = params.group_id ? Number(params.group_id) : null;

  const [expr, setExpr] = useState(params.amount ? String(params.amount) : "");
  const [merchant, setMerchant] = useState(params.title ?? "");
  const [category, setCategory] = useState(params.category ?? "Food");
  const [payment, setPayment] = useState(params.payment_method ?? "UPI");
  const [when, setWhen] = useState(() => {
    if (params.expense_date) {
      const d = new Date(`${params.expense_date}T${params.expense_time || "00:00"}:00`);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const [note, setNote] = useState(params.note ?? "");
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const amount = evaluate(expr);
  const canSave = amount > 0;

  // sheet animation
  const translateY = useSharedValue(height);
  const startY = useSharedValue(0);
  const checkScale = useSharedValue(0);

  // open on mount
  useEffect(() => {
    translateY.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.back(1.2)) });
  }, []);

  const close = () => {
    translateY.value = withTiming(height, { duration: 250, easing: Easing.in(Easing.cubic) }, (f) => {
      if (f) runOnJS(router.back)();
    });
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const next = startY.value + e.translationY;
      translateY.value = next < 0 ? 0 : next;
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        translateY.value = withTiming(height, { duration: 220 }, (f) => {
          if (f) runOnJS(router.back)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 18 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, height], [0.65, 0]),
  }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));

  const press = (key: string) => {
    Haptics.selectionAsync();
    if (key === "⌫") {
      setExpr((e) => e.slice(0, -1));
      return;
    }
    if (OPERATORS.includes(key)) {
      setExpr((e) => {
        if (!e) return e;
        const last = e[e.length - 1];
        if (OPERATORS.includes(last)) return e.slice(0, -1) + key;
        return e + key;
      });
      return;
    }
    if (key === ".") {
      setExpr((e) => {
        const seg = e.split(/[÷×−+]/).pop() ?? "";
        if (seg.includes(".")) return e;
        return e === "" ? "0." : e + ".";
      });
      return;
    }
    setExpr((e) => e + key);
  };

  const onDateChange = (_: DateTimePickerEvent, d?: Date) => {
    setShowDate(Platform.OS === "ios");
    if (d) {
      const nd = new Date(when);
      nd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      setWhen(nd);
    }
  };
  const onTimeChange = (_: DateTimePickerEvent, d?: Date) => {
    setShowTime(Platform.OS === "ios");
    if (d) {
      const nd = new Date(when);
      nd.setHours(d.getHours(), d.getMinutes());
      setWhen(nd);
    }
  };

  const save = async () => {
    if (!canSave) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const payload = {
      title: merchant.trim() || category,
      amount,
      category,
      payment_method: payment,
      expense_date: `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`,
      expense_time: fmtTimeLabel(when),
      note: note.trim() || null,
      created_at: new Date().toISOString(),
    };
    if (editingId) {
      await updateExpense(editingId, payload);
    } else {
      const newId = await addExpense(payload);
      if (groupId) await addExpenseToGroup(newId, groupId);
      await updateStreak();
    }
    checkScale.value = withSequence(
      withTiming(1.2, { duration: 180 }),
      withTiming(1, { duration: 120 }, (f) => {
        if (f) runOnJS(close)();
      }),
    );
  };

  return (
    <View style={styles.root} testID="add-expense-screen">
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={close} testID="backdrop" />
      </Animated.View>

      <Animated.View style={[styles.sheet, { maxHeight: height * 0.92 }, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>

        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          bottomOffset={24}
          contentContainerStyle={{ paddingHorizontal: spacing.screenH, paddingBottom: insets.bottom + spacing["2xl"] }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Amount */}
          <Text style={[type.caption, styles.label]}>Amount</Text>
          <Text style={styles.amount} testID="amount-display">
            ₹{expr || "0"}
          </Text>
          <View style={styles.amountUnderline} />

          {/* Calculator */}
          <View style={styles.calc}>
            {KEYS.map((row, ri) => (
              <View key={ri} style={styles.calcRow}>
                {row.map((k) => {
                  const isOp = OPERATORS.includes(k);
                  const isBack = k === "⌫";
                  return (
                    <Pressable
                      key={k}
                      testID={`calc-key-${k}`}
                      style={({ pressed }) => [styles.calcBtn, pressed && styles.calcPressed]}
                      onPress={() => press(k)}
                    >
                      <Text
                        style={[
                          styles.calcText,
                          isOp && { color: colors.indigoHover },
                          isBack && { color: colors.expense, fontFamily: font.regular },
                        ]}
                      >
                        {k}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Merchant */}
          <Text style={[type.caption, styles.label, { marginTop: spacing.lg }]}>What did you spend on?</Text>
          <TextInput
            testID="merchant-input"
            style={styles.input}
            placeholder="e.g. Zomato order"
            placeholderTextColor={colors.textTertiary}
            value={merchant}
            onChangeText={setMerchant}
          />

          {/* Category */}
          <Text style={[type.caption, styles.label, { marginTop: spacing.lg }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CATEGORIES.map((c) => {
              const sel = category === c.key;
              return (
                <Pressable
                  key={c.key}
                  testID={`category-chip-${c.key}`}
                  style={[styles.catChip, sel ? styles.catChipSel : styles.catChipUnsel]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCategory(c.key);
                  }}
                >
                  <Ionicons name={c.icon} size={16} color={sel ? "#FFFFFF" : colors.textSecondary} />
                  <Text style={[styles.catChipText, { color: sel ? "#FFFFFF" : colors.textSecondary }]}>
                    {c.key}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Payment */}
          <Text style={[type.caption, styles.label, { marginTop: spacing.base }]}>Payment method</Text>
          <View style={styles.payWrap}>
            {PAYMENT_METHODS.map((p) => {
              const sel = payment === p;
              return (
                <Pressable
                  key={p}
                  testID={`payment-chip-${p}`}
                  style={[styles.payChip, sel ? styles.payChipSel : styles.payChipUnsel]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPayment(p);
                  }}
                >
                  <Text style={[styles.payChipText, { color: sel ? "#FFFFFF" : colors.textSecondary }]}>{p}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Date & time */}
          <View style={styles.dateRow}>
            <Pressable testID="date-pill" style={styles.datePill} onPress={() => setShowDate(true)}>
              <Ionicons name="calendar-outline" size={14} color={colors.textPrimary} />
              <Text style={styles.datePillText}>{fmtDateLabel(when)}</Text>
            </Pressable>
            <Pressable testID="time-pill" style={styles.datePill} onPress={() => setShowTime(true)}>
              <Ionicons name="time-outline" size={14} color={colors.textPrimary} />
              <Text style={styles.datePillText}>{fmtTimeLabel(when)}</Text>
            </Pressable>
          </View>

          {/* Note */}
          <TextInput
            testID="note-input"
            style={styles.noteInput}
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.textTertiary}
            value={note}
            onChangeText={setNote}
          />

          {/* Save */}
          <Pressable
            testID="save-expense-button"
            disabled={!canSave}
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={save}
          >
            <Text style={[styles.saveBtnText, !canSave && { color: colors.textTertiary }]}>
              {editingId ? "Update Expense" : "Save Expense"}
            </Text>
          </Pressable>
        </KeyboardAwareScrollView>

        {showDate && (
          <DateTimePicker
            value={when}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={onDateChange}
            themeVariant="dark"
          />
        )}
        {showTime && (
          <DateTimePicker
            value={when}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onTimeChange}
            themeVariant="dark"
          />
        )}
      </Animated.View>

      {/* Success checkmark overlay */}
      <Animated.View style={[styles.checkOverlay, checkStyle, { pointerEvents: "none" }]}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={44} color="#FFFFFF" />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  handleArea: { alignItems: "center", paddingTop: spacing.md, paddingBottom: spacing.lg },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },

  label: { color: colors.textSecondary },
  amount: { fontFamily: font.bold, fontSize: 32, color: colors.textPrimary, textAlign: "center", marginTop: spacing.xs },
  amountUnderline: { height: 1, width: "80%", backgroundColor: colors.indigo, alignSelf: "center", marginTop: spacing.xs },

  calc: { marginTop: spacing.base, gap: spacing.sm },
  calcRow: { flexDirection: "row", gap: spacing.sm },
  calcBtn: {
    flex: 1,
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.icon,
    alignItems: "center",
    justifyContent: "center",
  },
  calcPressed: { opacity: 0.75, transform: [{ scale: 0.95 }] },
  calcText: { fontFamily: font.semibold, fontSize: 16, color: colors.textPrimary },

  input: {
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.base,
    color: colors.textPrimary,
    fontFamily: font.regular,
    fontSize: 14,
    marginTop: spacing.sm,
  },

  chipRow: { gap: spacing.sm, paddingVertical: spacing.sm, paddingRight: spacing.base },
  catChip: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radius.chip,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 0,
  },
  catChipSel: { backgroundColor: colors.indigo },
  catChipUnsel: { backgroundColor: colors.surface },
  catChipText: { fontFamily: font.regular, fontSize: 14 },

  payWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  payChip: { height: 34, paddingHorizontal: spacing.md, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  payChipUnsel: { backgroundColor: colors.surface },
  payChipSel: { backgroundColor: colors.paymentSelectedBg, borderWidth: 1, borderColor: colors.indigo },
  payChipText: { fontFamily: font.regular, fontSize: 12 },

  dateRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.base },
  datePill: {
    flex: 1,
    height: 40,
    backgroundColor: colors.surface,
    borderRadius: radius.chip,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  datePillText: { fontFamily: font.regular, fontSize: 12, color: colors.textPrimary },

  noteInput: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: radius.icon,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: font.regular,
    fontSize: 14,
    marginTop: spacing.md,
  },

  saveBtn: {
    height: 56,
    backgroundColor: colors.indigo,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  saveBtnDisabled: { backgroundColor: colors.surface },
  saveBtnText: { fontFamily: font.semibold, fontSize: 16, color: "#FFFFFF" },

  checkOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
});
