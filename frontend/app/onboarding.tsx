import { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { colors, spacing, radius, type, font } from "@/src/theme";
import { CURRENCIES } from "@/src/format";
import { storage } from "@/src/utils/storage";

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [index, setIndex] = useState(0);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  const finish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await storage.setItem("user_name", name.trim() || "there");
    await storage.setItem("currency_symbol", currency.symbol);
    await storage.setItem("currency_code", currency.code);
    await storage.setItem("onboarding_complete", true);
    router.replace("/(tabs)");
  };

  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="onboarding-screen">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        keyboardShouldPersistTaps="handled"
        scrollEnabled
      >
        {/* Slide 1 */}
        <View style={[styles.slide, { width }]} testID="onboarding-slide-1">
          <View style={styles.centerArea}>
            <View style={styles.appIcon}>
              <Text style={styles.rupeeLogo}>₹</Text>
            </View>
            <Text style={[type.display, styles.brand]}>RupeeLog</Text>
            <Text style={[type.body, styles.tagline]}>Every rupee. Tracked instantly.</Text>
          </View>
          <View style={styles.bottomArea}>
            <Pressable
              testID="get-started-button"
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={() => {
                tap();
                goTo(1);
              }}
            >
              <Text style={styles.primaryBtnText}>Get Started</Text>
            </Pressable>
          </View>
        </View>

        {/* Slide 2 */}
        <View style={[styles.slide, { width }]} testID="onboarding-slide-2">
          <View style={styles.formArea}>
            <Text style={[type.heading, styles.h]}>What's your name?</Text>
            <Text style={[type.body, styles.sub]}>We'll personalise your experience</Text>

            <TextInput
              testID="name-input"
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              autoFocus={index === 1}
              returnKeyType="done"
            />

            <Text style={[type.caption, styles.currencyLabel]}>Currency</Text>
            <Pressable
              testID="currency-selector"
              style={styles.currencyRow}
              onPress={() => setCurrencyOpen(true)}
            >
              <Text style={styles.currencyValue}>
                {currency.symbol} {currency.code}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.bottomArea}>
            <Pressable
              testID="continue-button"
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={() => {
                tap();
                goTo(2);
              }}
            >
              <Text style={styles.primaryBtnText}>Continue →</Text>
            </Pressable>
          </View>
        </View>

        {/* Slide 3 */}
        <View style={[styles.slide, { width }]} testID="onboarding-slide-3">
          <View style={styles.centerArea}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.income} />
            <Text style={[type.heading, styles.h, { marginTop: spacing.lg, textAlign: "center" }]}>
              Auto-detect payments
            </Text>
            <Text style={[type.body, styles.privacyText]}>
              We read only bank and UPI transaction SMS.{"\n"}
              OTPs and personal messages are never read.{"\n"}
              Nothing ever leaves your device.
            </Text>
          </View>
          <View style={styles.bottomArea}>
            <Pressable
              testID="allow-access-button"
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={finish}
            >
              <Text style={styles.primaryBtnText}>Allow access</Text>
            </Pressable>
            <Pressable
              testID="skip-button"
              style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
              onPress={finish}
            >
              <Text style={styles.ghostBtnText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Progress dots */}
      <View style={[styles.dots, { bottom: insets.bottom + spacing.xl, pointerEvents: "none" }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]} />
        ))}
      </View>

      {/* Currency modal */}
      <Modal visible={currencyOpen} transparent animationType="fade" onRequestClose={() => setCurrencyOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCurrencyOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={[type.title, { marginBottom: spacing.md }]}>Select currency</Text>
            {CURRENCIES.map((c) => {
              const active = c.code === currency.code;
              return (
                <Pressable
                  key={c.code}
                  testID={`currency-option-${c.code}`}
                  style={styles.currencyOption}
                  onPress={() => {
                    setCurrency(c);
                    setCurrencyOpen(false);
                  }}
                >
                  <Text style={[type.body, { color: active ? colors.indigoHover : colors.textPrimary }]}>
                    {c.symbol}  {c.code}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color={colors.indigoHover} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  slide: { flex: 1, paddingHorizontal: spacing.screenH, justifyContent: "space-between" },
  centerArea: { flex: 1, justifyContent: "center", alignItems: "center" },
  formArea: { flex: 1, justifyContent: "center" },
  bottomArea: { paddingBottom: spacing["3xl"] },

  appIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.large,
    backgroundColor: colors.indigo,
    alignItems: "center",
    justifyContent: "center",
  },
  rupeeLogo: { fontFamily: font.bold, fontSize: 40, color: "#FFFFFF" },
  brand: { marginTop: spacing.xl, textAlign: "center" },
  tagline: { marginTop: spacing.sm, color: colors.textSecondary, textAlign: "center" },

  h: { color: colors.textPrimary },
  sub: { color: colors.textSecondary, marginTop: spacing.sm },

  input: {
    height: 54,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.base,
    color: colors.textPrimary,
    fontFamily: font.regular,
    fontSize: 16,
    marginTop: spacing.xl,
  },
  currencyLabel: { marginTop: spacing.xl },
  currencyRow: {
    height: 54,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.base,
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  currencyValue: { fontFamily: font.semibold, fontSize: 16, color: colors.textPrimary },

  privacyText: {
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.base,
    paddingHorizontal: spacing.base,
  },

  primaryBtn: {
    height: 54,
    backgroundColor: colors.indigo,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontFamily: font.semibold, fontSize: 16, color: "#FFFFFF" },
  ghostBtn: {
    height: 54,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  ghostBtnText: { fontFamily: font.semibold, fontSize: 16, color: "#FFFFFF" },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },

  dots: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 22, backgroundColor: colors.indigo },
  dotInactive: { width: 6, backgroundColor: colors.textTertiary },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: spacing.xl },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
});
