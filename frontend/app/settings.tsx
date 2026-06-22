import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  Modal,
  Alert,
  Share,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as StoreReview from "expo-store-review";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { colors, spacing, radius, type, font } from "@/src/theme";
import { CURRENCIES } from "@/src/format";
import { getAllExpenses, resetAllData } from "@/src/db";
import { storage } from "@/src/utils/storage";
import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleDailyReminder,
  cancelDailyReminder,
} from "@/src/notifications";

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [appLock, setAppLock] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [notifDisabled, setNotifDisabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(() => {
    storage.getItem<string>("user_name", "there").then((n) => setName(n ?? "there"));
    storage.getItem<string>("currency_code", "INR").then((code) => {
      const c = CURRENCIES.find((x) => x.code === code) ?? CURRENCIES[0];
      setCurrency(c);
    });
    storage.getItem<boolean>("rupeelog_app_lock", false).then((v) => setAppLock(!!v));
    (async () => {
      const granted = await getNotificationPermission();
      const stored = await storage.getItem<boolean>("rupeelog_notifications", true);
      if (!granted) {
        setNotifications(false);
        setNotifDisabled(true);
      } else {
        setNotifications(stored ?? true);
        setNotifDisabled(false);
      }
    })();
    storage.getItem<boolean>("rupeelog_sms_enabled", true).then((v) => setSmsEnabled(v ?? true));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const confirmName = async () => {
    const trimmed = nameDraft.trim() || "there";
    await storage.setItem("user_name", trimmed);
    setName(trimmed);
    setEditingName(false);
  };

  const pickCurrency = async (code: string, symbol: string) => {
    await storage.setItem("currency_code", code);
    await storage.setItem("currency_symbol", symbol);
    setCurrency({ code, symbol });
    setCurrencyOpen(false);
  };

  const toggle = async (key: string, val: boolean, setter: (b: boolean) => void) => {
    Haptics.selectionAsync();
    setter(val);
    await storage.setItem(key, val);
  };

  const toggleNotifications = async (val: boolean) => {
    Haptics.selectionAsync();
    if (val) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setNotifications(false);
        setNotifDisabled(true);
        return;
      }
      setNotifications(true);
      setNotifDisabled(false);
      await storage.setItem("rupeelog_notifications", true);
      await scheduleDailyReminder();
    } else {
      setNotifications(false);
      await storage.setItem("rupeelog_notifications", false);
      await cancelDailyReminder();
    }
  };

  const exportCsv = async () => {
    const all = await getAllExpenses();
    const now = new Date();
    const month = all.filter((e) => {
      const d = new Date(`${e.expense_date}T00:00:00`);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const header = "Date,Time,Title,Amount,Category,Payment Method,Note";
    const rows = month.map((e) =>
      [e.expense_date, e.expense_time, e.title, e.amount, e.category, e.payment_method, e.note ?? ""]
        .map((v) => csvEscape(String(v)))
        .join(","),
    );
    const csv = [header, ...rows].join("\n");
    try {
      await Share.share({ message: csv, title: `RupeeLog Export - ${MONTHS_LONG[now.getMonth()]} ${now.getFullYear()}` });
      showToast("Exported successfully");
    } catch {
      /* dismissed */
    }
  };

  const clearAll = () => {
    const doClear = async () => {
      await resetAllData();
      router.replace("/onboarding");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("This will permanently delete all your expenses, groups, and settings. This cannot be undone.")) {
        doClear();
      }
      return;
    }
    Alert.alert(
      "Clear all data?",
      "This will permanently delete all your expenses, groups, and settings. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete Everything", style: "destructive", onPress: doClear },
      ],
    );
  };

  const rate = async () => {
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
    } else {
      showToast("Store review not available");
    }
  };

  return (
    <View style={styles.root} testID="settings-screen">
      <View style={[styles.nav, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="settings-back" onPress={() => router.back()} hitSlop={8} style={styles.navSide}>
          <Ionicons name="chevron-back-outline" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[type.heading, { flex: 1, textAlign: "center" }]}>Settings</Text>
        <View style={styles.navSide} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.screenH, paddingBottom: 40 }}>
        {/* PROFILE */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>Name</Text>
            </View>
            {editingName ? (
              <View style={styles.rowRight}>
                <TextInput
                  testID="name-edit-input"
                  style={styles.inlineInput}
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  autoFocus
                  placeholder="Your name"
                  placeholderTextColor={colors.textTertiary}
                  onSubmitEditing={confirmName}
                />
                <Pressable testID="confirm-name" onPress={confirmName} hitSlop={8}>
                  <Ionicons name="checkmark-outline" size={20} color={colors.teal} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                testID="edit-name"
                style={styles.rowRight}
                onPress={() => {
                  setNameDraft(name);
                  setEditingName(true);
                }}
              >
                <Text style={styles.rowValue}>{name}</Text>
                <Ionicons name="chevron-forward-outline" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          <View style={styles.divider} />
          <Pressable style={styles.row} testID="open-currency" onPress={() => setCurrencyOpen(true)}>
            <View style={styles.rowLeft}>
              <Ionicons name="cash-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>Currency</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>
                {currency.symbol} {currency.code}
              </Text>
              <Ionicons name="chevron-forward-outline" size={16} color={colors.textTertiary} />
            </View>
          </Pressable>
        </View>

        {/* SECURITY */}
        <Text style={styles.sectionLabel}>Security</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>App Lock</Text>
            </View>
            <Switch
              testID="app-lock-switch"
              value={appLock}
              onValueChange={(v) => toggle("rupeelog_app_lock", v, setAppLock)}
              trackColor={{ false: colors.surface, true: colors.indigo }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text style={styles.rowNote}>Uses Face ID or fingerprint to unlock the app</Text>
        </View>

        {/* PREFERENCES */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="notifications-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>Notifications</Text>
            </View>
            <Switch
              testID="notifications-switch"
              value={notifications}
              onValueChange={(v) => toggle("rupeelog_notifications", v, setNotifications)}
              trackColor={{ false: colors.surface, true: colors.indigo }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.divider} />
          <View style={[styles.row, { alignItems: "flex-start" }]}>
            <View style={[styles.rowLeft, { flex: 1 }]}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={styles.rowLabelPlain}>SMS Auto-detect</Text>
                <Text style={[styles.rowNote, { marginLeft: 0, paddingHorizontal: 0, marginTop: 2 }]}>
                  Reads bank & UPI SMS to pre-fill expenses
                </Text>
              </View>
            </View>
            <Switch
              testID="sms-switch"
              value={smsEnabled}
              onValueChange={(v) => toggle("rupeelog_sms_enabled", v, setSmsEnabled)}
              trackColor={{ false: colors.surface, true: colors.indigo }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* DATA */}
        <Text style={styles.sectionLabel}>Data</Text>
        <View style={styles.card}>
          <Pressable style={styles.row} testID="export-csv" onPress={exportCsv}>
            <View style={styles.rowLeft}>
              <Ionicons name="download-outline" size={18} color={colors.teal} />
              <Text style={styles.rowLabel}>Export this month</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={16} color={colors.textTertiary} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row} testID="clear-data" onPress={clearAll}>
            <View style={styles.rowLeft}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={[styles.rowLabel, { color: "#EF4444" }]}>Clear all data</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={16} color={colors.textTertiary} />
          </Pressable>
        </View>

        {/* ABOUT */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={[styles.card, { marginBottom: 40 }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>Version</Text>
            </View>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <Pressable style={styles.row} testID="open-privacy" onPress={() => setPrivacyOpen(true)}>
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>Privacy</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={16} color={colors.textTertiary} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row} testID="rate-app" onPress={rate}>
            <View style={styles.rowLeft}>
              <Ionicons name="star-outline" size={18} color="#F59E0B" />
              <Text style={styles.rowLabel}>Rate RupeeLog</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={16} color={colors.textTertiary} />
          </Pressable>
        </View>
      </ScrollView>

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
                  testID={`settings-currency-${c.code}`}
                  style={styles.currencyOption}
                  onPress={() => pickCurrency(c.code, c.symbol)}
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

      {/* Privacy modal */}
      <Modal visible={privacyOpen} transparent animationType="fade" onRequestClose={() => setPrivacyOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPrivacyOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={[type.heading]}>Your Privacy</Text>
            <Text style={styles.privacyBody}>
              RupeeLog stores all your data on your device only. We have no servers, no accounts, and no access to your
              data. Your expenses never leave your phone. SMS reading (if enabled) processes messages on-device — nothing
              is transmitted anywhere.
            </Text>
            <Pressable style={styles.gotItBtn} onPress={() => setPrivacyOpen(false)} testID="privacy-got-it">
              <Text style={styles.gotItText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Toast */}
      {toast !== "" && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[styles.toast, { bottom: insets.bottom + spacing.xl }]}
          testID="settings-toast"
        >
          <Text style={styles.toastText}>✓ {toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  nav: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.screenH, paddingBottom: spacing.sm },
  navSide: { width: 40 },

  sectionLabel: {
    fontFamily: font.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  card: { backgroundColor: colors.card, borderRadius: radius.medium, overflow: "hidden" },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.base, paddingHorizontal: spacing.lg },
  rowLeft: { flexDirection: "row", alignItems: "center" },
  rowLabel: { fontFamily: font.regular, fontSize: 14, color: colors.textPrimary, marginLeft: spacing.md },
  rowLabelPlain: { fontFamily: font.regular, fontSize: 14, color: colors.textPrimary },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: { fontFamily: font.regular, fontSize: 14, color: colors.textSecondary },
  rowNote: { fontFamily: font.regular, fontSize: 12, color: colors.textTertiary, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginHorizontal: spacing.lg },
  inlineInput: {
    minWidth: 120,
    paddingVertical: 4,
    color: colors.textPrimary,
    fontFamily: font.regular,
    fontSize: 14,
    textAlign: "right",
  },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: spacing.xl },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.medium, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  currencyOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md },
  privacyBody: { fontFamily: font.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginTop: spacing.md },
  gotItBtn: { height: 48, backgroundColor: colors.surface, borderRadius: radius.button, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  gotItText: { fontFamily: font.semibold, fontSize: 14, color: "#FFFFFF" },

  toast: {
    position: "absolute",
    left: spacing.screenH,
    right: spacing.screenH,
    backgroundColor: "rgba(16,185,129,0.15)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    borderRadius: radius.icon,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    alignItems: "center",
  },
  toastText: { fontFamily: font.medium, fontSize: 13, color: colors.textPrimary },
});
