import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { colors, spacing, radius, type, font } from "@/src/theme";
import { CATEGORIES, PAYMENT_METHODS } from "@/src/categories";
import { addTemplate } from "@/src/templates";
import { ProModal } from "@/src/components/ProModal";

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
    } else num += ch;
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

export default function AddTemplate() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();

  const [expr, setExpr] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Food");
  const [payment, setPayment] = useState("UPI");
  const [proOpen, setProOpen] = useState(false);

  const amount = evaluate(expr);
  const canSave = amount > 0 && title.trim().length > 0;

  const translateY = useSharedValue(height);
  const startY = useSharedValue(0);

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
      } else translateY.value = withSpring(0, { damping: 18 });
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateY.value, [0, height], [0.65, 0]) }));

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

  const save = async () => {
    if (!canSave) return;
    const ok = await addTemplate({
      title: title.trim(),
      amount,
      category,
      paymentMethod: payment,
    });
    if (!ok) {
      setProOpen(true);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  return (
    <View style={styles.root} testID="add-template-screen">
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={close} testID="template-backdrop" />
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
          <Text style={[type.heading]}>New Template</Text>
          <Text style={[type.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Templates let you log frequent expenses in one tap
          </Text>

          <Text style={[type.caption, { marginTop: spacing.lg }]}>Amount</Text>
          <Text style={styles.amount} testID="template-amount">
            ₹{expr || "0"}
          </Text>
          <View style={styles.amountUnderline} />

          <View style={styles.calc}>
            {KEYS.map((row, ri) => (
              <View key={ri} style={styles.calcRow}>
                {row.map((k) => {
                  const isOp = OPERATORS.includes(k);
                  const isBack = k === "⌫";
                  return (
                    <Pressable
                      key={k}
                      testID={`tcalc-key-${k}`}
                      style={({ pressed }) => [styles.calcBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] }]}
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

          <Text style={[type.caption, { marginTop: spacing.lg }]}>Template name</Text>
          <TextInput
            testID="template-name-input"
            style={styles.input}
            placeholder="Template name e.g. Morning Coffee"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[type.caption, { marginTop: spacing.lg }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CATEGORIES.map((c) => {
              const sel = category === c.key;
              return (
                <Pressable
                  key={c.key}
                  testID={`tcategory-${c.key}`}
                  style={[styles.catChip, sel ? { backgroundColor: colors.indigo } : { backgroundColor: colors.surface }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCategory(c.key);
                  }}
                >
                  <Ionicons name={c.icon} size={16} color={sel ? "#FFFFFF" : colors.textSecondary} />
                  <Text style={[styles.catChipText, { color: sel ? "#FFFFFF" : colors.textSecondary }]}>{c.key}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[type.caption, { marginTop: spacing.base }]}>Payment method</Text>
          <View style={styles.payWrap}>
            {PAYMENT_METHODS.map((p) => {
              const sel = payment === p;
              return (
                <Pressable
                  key={p}
                  testID={`tpayment-${p}`}
                  style={[styles.payChip, sel ? styles.payChipSel : { backgroundColor: colors.surface }]}
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

          <Pressable
            testID="save-template-button"
            disabled={!canSave}
            style={[styles.saveBtn, !canSave && { backgroundColor: colors.surface }]}
            onPress={save}
          >
            <Text style={[styles.saveBtnText, !canSave && { color: colors.textTertiary }]}>Save Template</Text>
          </Pressable>
        </KeyboardAwareScrollView>
      </Animated.View>

      <ProModal
        visible={proOpen}
        onClose={() => {
          setProOpen(false);
          close();
        }}
        features={[
          "Unlimited quick-add templates",
          "PDF & Excel export any date range",
          "Cloud sync across all your devices",
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  handleArea: { alignItems: "center", paddingTop: spacing.md, paddingBottom: spacing.lg },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },

  amount: { fontFamily: font.bold, fontSize: 32, color: colors.textPrimary, textAlign: "center", marginTop: spacing.xs },
  amountUnderline: { height: 1, width: "80%", backgroundColor: colors.indigo, alignSelf: "center", marginTop: spacing.xs },

  calc: { marginTop: spacing.base, gap: spacing.sm },
  calcRow: { flexDirection: "row", gap: spacing.sm },
  calcBtn: { flex: 1, height: 52, backgroundColor: colors.surface, borderRadius: radius.icon, alignItems: "center", justifyContent: "center" },
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
  catChip: { height: 42, paddingHorizontal: 14, borderRadius: radius.chip, flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 0 },
  catChipText: { fontFamily: font.regular, fontSize: 14 },

  payWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  payChip: { height: 34, paddingHorizontal: spacing.md, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  payChipSel: { backgroundColor: colors.paymentSelectedBg, borderWidth: 1, borderColor: colors.indigo },
  payChipText: { fontFamily: font.regular, fontSize: 12 },

  saveBtn: { height: 54, backgroundColor: colors.indigo, borderRadius: radius.button, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  saveBtnText: { fontFamily: font.semibold, fontSize: 16, color: "#FFFFFF" },
});
