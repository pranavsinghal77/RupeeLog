import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { SlideInDown } from "react-native-reanimated";

import { colors, spacing, radius, type, font } from "@/src/theme";
import { formatMoney } from "@/src/format";
import { getGroups, createGroup, GroupWithStats } from "@/src/db";
import { storage } from "@/src/utils/storage";

const GROUP_COLOURS = ["#4F46E5", "#10B981", "#F87171", "#F59E0B", "#6366F1", "#EC4899"];
const FREE_LIMIT = 3;

function fmtDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function dateRange(min: string | null, max: string | null): string {
  if (!min || !max) return "—";
  if (min === max) return fmtDay(min);
  return `${fmtDay(min)} – ${fmtDay(max)}`;
}

export default function GroupsList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [groups, setGroups] = useState<GroupWithStats[]>([]);
  const [symbol, setSymbol] = useState("₹");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(() => {
    storage.getItem<string>("currency_symbol", "₹").then((s) => setSymbol(s ?? "₹"));
    getGroups().then(setGroups);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (groups.length >= FREE_LIMIT) {
      setUpgradeOpen(true);
    } else {
      setSheetOpen(true);
    }
  };

  const handleCreate = async (name: string, colour: string) => {
    await createGroup(name, colour);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSheetOpen(false);
    load();
  };

  const netColour = (g: GroupWithStats) =>
    g.expense_count === 0 ? colors.textSecondary : colors.expense;

  return (
    <View style={styles.root} testID="groups-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.base }]}>
        <Text style={type.heading}>Groups</Text>
        <TouchableOpacity testID="add-group-button" onPress={onAddPress} hitSlop={8} activeOpacity={0.75}>
          <Ionicons name="add-circle-outline" size={26} color={colors.indigo} />
        </TouchableOpacity>
      </View>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="folder-open-outline" size={52} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySub}>Track trips, events, or project expenses together.</Text>
          <Pressable
            testID="create-first-group"
            style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
            onPress={onAddPress}
          >
            <Text style={styles.emptyBtnText}>+ Create your first group</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.screenH, paddingBottom: 100, paddingTop: spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              testID={`group-card-${item.id}`}
              style={styles.cardWrap}
              onPress={() => router.push(`/groups/${item.id}`)}
            >
              <View style={styles.card}>
                <View style={[styles.accent, { backgroundColor: item.colour }]} />
                <View style={styles.cardRow}>
                  <Text style={[styles.groupName, { flex: 1 }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.groupNet, { color: netColour(item) }]}>
                    {formatMoney(item.total, symbol)}
                  </Text>
                </View>
                <View style={[styles.cardRow, { marginTop: spacing.xs }]}>
                  <Text style={[styles.metaText, { flex: 1 }]}>
                    {item.expense_count} expense{item.expense_count === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.metaText}>{dateRange(item.min_date, item.max_date)}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <CreateGroupSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onCreate={handleCreate} />
      <UpgradeModal visible={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </View>
  );
}

/* ------------------------------ Create Group ------------------------------ */

function CreateGroupSheet({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, colour: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [colour, setColour] = useState(GROUP_COLOURS[0]);

  const reset = () => {
    setName("");
    setColour(GROUP_COLOURS[0]);
  };

  if (!visible) return null;
  const canCreate = name.trim().length > 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={styles.backdrop} onPress={onClose} testID="create-group-backdrop" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Animated.View
            entering={SlideInDown.duration(380)}
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing["2xl"] }]}
          >
            <View style={styles.handle} />
            <Text style={[type.heading, { marginTop: spacing.base, marginHorizontal: spacing.screenH }]}>
              New Group
            </Text>

            <TextInput
              testID="group-name-input"
              style={styles.nameInput}
              placeholder="Group name e.g. Goa Trip"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              autoFocus
            />

            <Text style={[type.caption, { marginTop: spacing.lg, marginHorizontal: spacing.screenH }]}>Colour</Text>
            <View style={styles.dotsRow}>
              {GROUP_COLOURS.map((c) => {
                const sel = c === colour;
                return (
                  <TouchableOpacity
                    key={c}
                    testID={`colour-${c}`}
                    activeOpacity={0.8}
                    onPress={() => setColour(c)}
                    style={[
                      styles.dot,
                      { backgroundColor: c },
                      sel && { borderWidth: 3, borderColor: "#FFFFFF", transform: [{ scale: 1.15 }] },
                    ]}
                  />
                );
              })}
            </View>

            <Pressable
              testID="create-group-submit"
              disabled={!canCreate}
              style={[styles.createBtn, !canCreate && { backgroundColor: colors.surface }]}
              onPress={() => {
                onCreate(name.trim(), colour);
                reset();
              }}
            >
              <Text style={[styles.createBtnText, !canCreate && { color: colors.textTertiary }]}>Create Group</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ------------------------------ Upgrade Modal ------------------------------ */

function UpgradeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const features = [
    "Unlimited expense groups",
    "PDF & Excel export any date range",
    "Cloud sync across all your devices",
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.upgradeOverlay} onPress={onClose}>
        <Pressable style={styles.upgradeCard} onPress={() => {}} testID="upgrade-modal">
          <Ionicons name="star-outline" size={36} color="#F59E0B" style={{ alignSelf: "center", marginBottom: spacing.md }} />
          <Text style={[type.heading, { textAlign: "center" }]}>Upgrade to Pro</Text>
          <Text style={[type.caption, { textAlign: "center", marginTop: spacing.xs }]}>
            Unlock all premium features
          </Text>
          <View style={styles.upgradeDivider} />
          {features.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.teal} />
              <Text style={[type.caption, { marginLeft: spacing.sm, color: colors.textSecondary }]}>{f}</Text>
            </View>
          ))}
          <Pressable testID="upgrade-cta" style={styles.upgradeBtn} onPress={onClose}>
            <Text style={styles.upgradeBtnText}>Try 14 days free — ₹799/year</Text>
          </Pressable>
          <Pressable onPress={onClose} testID="maybe-later">
            <Text style={styles.maybeLater}>Maybe later</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.screenH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  emptyTitle: { fontFamily: font.semibold, fontSize: 18, color: colors.textSecondary, marginTop: spacing.md },
  emptySub: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: spacing["2xl"],
  },
  emptyBtn: {
    height: 46,
    backgroundColor: colors.indigo,
    borderRadius: radius.icon,
    marginTop: spacing.lg,
    alignSelf: "stretch",
    marginHorizontal: spacing["2xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBtnText: { fontFamily: font.semibold, fontSize: 14, color: "#FFFFFF" },

  cardWrap: { borderRadius: radius.medium, overflow: "hidden", marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: radius.medium, paddingVertical: spacing.base, paddingHorizontal: spacing.lg },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  cardRow: { flexDirection: "row", alignItems: "center" },
  groupName: { fontFamily: font.semibold, fontSize: 15, color: colors.textPrimary },
  groupNet: { fontFamily: font.semibold, fontSize: 15 },
  metaText: { fontFamily: font.regular, fontSize: 12, color: colors.textTertiary },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: spacing.md,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center" },
  nameInput: {
    height: 50,
    marginTop: spacing.lg,
    marginHorizontal: spacing.screenH,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.base,
    color: colors.textPrimary,
    fontFamily: font.regular,
    fontSize: 14,
  },
  dotsRow: { flexDirection: "row", gap: spacing.base, marginTop: 10, marginHorizontal: spacing.screenH },
  dot: { width: 36, height: 36, borderRadius: 18 },
  createBtn: {
    height: 54,
    backgroundColor: colors.indigo,
    borderRadius: radius.button,
    marginTop: spacing["2xl"],
    marginHorizontal: spacing.screenH,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnText: { fontFamily: font.semibold, fontSize: 15, color: "#FFFFFF" },

  upgradeOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  upgradeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    paddingVertical: 28,
    paddingHorizontal: spacing.xl,
    marginHorizontal: spacing["2xl"],
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.3)",
    alignSelf: "stretch",
  },
  upgradeDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.base },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  upgradeBtn: {
    height: 52,
    backgroundColor: colors.indigo,
    borderRadius: radius.button,
    marginTop: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeBtnText: { fontFamily: font.semibold, fontSize: 14, color: "#FFFFFF" },
  maybeLater: { fontFamily: font.regular, fontSize: 13, color: colors.textTertiary, textAlign: "center", marginTop: 14 },
});
