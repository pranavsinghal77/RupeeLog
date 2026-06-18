import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Modal,
  Share,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { SlideInDown } from "react-native-reanimated";

import { colors, spacing, radius, type, font } from "@/src/theme";
import { formatMoney } from "@/src/format";
import {
  getGroupById,
  getGroupExpenses,
  getExpensesNotInAnyGroup,
  addExpenseToGroup,
  GroupWithStats,
  Expense,
} from "@/src/db";
import { storage } from "@/src/utils/storage";
import { ExpenseDisplayRow } from "@/src/components/ExpenseDisplayRow";

function fmtDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function dateRange(min: string | null, max: string | null): string {
  if (!min || !max) return "—";
  if (min === max) return fmtDay(min);
  return `${fmtDay(min)} – ${fmtDay(max)}`;
}

export default function GroupDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);

  const [group, setGroup] = useState<GroupWithStats | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [symbol, setSymbol] = useState("₹");
  const [actionOpen, setActionOpen] = useState(false);
  const [existingOpen, setExistingOpen] = useState(false);

  const load = useCallback(() => {
    storage.getItem<string>("currency_symbol", "₹").then((s) => setSymbol(s ?? "₹"));
    getGroupById(groupId).then(setGroup);
    getGroupExpenses(groupId).then(setExpenses);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onShare = async () => {
    if (!group) return;
    const range = dateRange(group.min_date, group.max_date);
    const lines = expenses
      .map((e) => `• ${e.title}  ${formatMoney(e.amount, symbol)}  (${e.payment_method})`)
      .join("\n");
    const message = `RupeeLog — ${group.name}\n${range}\nTotal: ${formatMoney(group.total, symbol)}\n\n${lines}`;
    try {
      await Share.share({ message });
    } catch {
      /* user dismissed */
    }
  };

  const onNewExpense = () => {
    setActionOpen(false);
    router.push({ pathname: "/add-expense", params: { group_id: String(groupId) } });
  };

  const onAddExisting = async (expenseId: number) => {
    await addExpenseToGroup(expenseId, groupId);
    Haptics.selectionAsync();
    setExistingOpen(false);
    load();
  };

  return (
    <View style={styles.root} testID="group-detail-screen">
      {/* Nav bar */}
      <View style={[styles.nav, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="group-back" onPress={() => router.back()} hitSlop={8} style={styles.navSide}>
          <Ionicons name="chevron-back-outline" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[type.title, { fontSize: 18, flex: 1, textAlign: "center" }]} numberOfLines={1}>
          {group?.name ?? "Group"}
        </Text>
        <Pressable testID="group-share" onPress={onShare} hitSlop={8} style={[styles.navSide, { alignItems: "flex-end" }]}>
          <Ionicons name="share-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Total header */}
      {group && (
        <View style={styles.totalHeader}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={[styles.colourDot, { backgroundColor: group.colour }]} />
            <Text style={[type.body, { color: colors.textSecondary, marginLeft: 6 }]}>{group.name}</Text>
          </View>
          <Text style={[type.display, { marginTop: spacing.xs }]} testID="group-total">
            {formatMoney(group.total, symbol)}
          </Text>
          <Text style={[type.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
            {group.expense_count} expense{group.expense_count === 1 ? "" : "s"} · {dateRange(group.min_date, group.max_date)}
          </Text>
        </View>
      )}

      {/* Add expense row */}
      <Pressable testID="group-add-expense" style={styles.addRow} onPress={() => setActionOpen(true)}>
        <Ionicons name="add-outline" size={16} color={colors.indigoHover} />
        <Text style={styles.addRowText}>Add expense</Text>
      </Pressable>

      {/* Expenses list */}
      <FlatList
        data={expenses}
        keyExtractor={(e) => e.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingHorizontal: spacing.screenH, paddingBottom: 100 },
          expenses.length === 0 && { flexGrow: 1 },
        ]}
        renderItem={({ item }) => <ExpenseDisplayRow expense={item} symbol={symbol} testID={`group-expense-${item.id}`} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="group-empty">
            <Ionicons name="receipt-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No expenses in this group yet</Text>
          </View>
        }
      />

      {/* Action sheet */}
      <Modal visible={actionOpen} transparent animationType="fade" onRequestClose={() => setActionOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setActionOpen(false)}>
          <Animated.View
            entering={SlideInDown.duration(300)}
            style={[styles.actionSheet, { paddingBottom: insets.bottom + spacing.base }]}
          >
            <Pressable style={styles.actionOption} onPress={onNewExpense} testID="action-new-expense">
              <Ionicons name="add-circle-outline" size={20} color={colors.indigoHover} />
              <Text style={styles.actionText}>New expense</Text>
            </Pressable>
            <View style={styles.actionDivider} />
            <Pressable
              style={styles.actionOption}
              testID="action-add-existing"
              onPress={() => {
                setActionOpen(false);
                setExistingOpen(true);
              }}
            >
              <Ionicons name="albums-outline" size={20} color={colors.indigoHover} />
              <Text style={styles.actionText}>Add from existing</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Add from existing sheet */}
      <AddExistingSheet
        visible={existingOpen}
        symbol={symbol}
        onClose={() => setExistingOpen(false)}
        onPick={onAddExisting}
      />
    </View>
  );
}

function AddExistingSheet({
  visible,
  symbol,
  onClose,
  onPick,
}: {
  visible: boolean;
  symbol: string;
  onClose: () => void;
  onPick: (expenseId: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [items, setItems] = useState<Expense[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (visible) getExpensesNotInAnyGroup().then(setItems);
    }, [visible]),
  );

  if (!visible) return null;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter((e) => e.title.toLowerCase().includes(q) || (e.note ?? "").toLowerCase().includes(q))
    : items;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Animated.View
            entering={SlideInDown.duration(380)}
            style={[styles.existingSheet, { height: height * 0.7, paddingBottom: insets.bottom }]}
          >
            <View style={styles.handle} />
            <Text style={[type.heading, { marginTop: spacing.base, marginHorizontal: spacing.screenH }]}>
              Add from existing
            </Text>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search expenses…"
                placeholderTextColor={colors.textTertiary}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(e) => e.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.screenH, paddingTop: spacing.md, paddingBottom: spacing.xl }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <ExpenseDisplayRow
                  expense={item}
                  symbol={symbol}
                  onPress={() => onPick(item.id)}
                  testID={`existing-expense-${item.id}`}
                />
              )}
              ListEmptyComponent={
                <Text style={[type.body, { color: colors.textTertiary, textAlign: "center", marginTop: spacing.xl }]}>
                  No unassigned expenses
                </Text>
              }
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  nav: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.screenH, paddingBottom: spacing.sm },
  navSide: { width: 40, justifyContent: "center" },

  totalHeader: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  colourDot: { width: 10, height: 10, borderRadius: 5 },

  addRow: {
    height: 46,
    margin: spacing.base,
    marginHorizontal: spacing.screenH,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.4)",
    borderRadius: radius.icon,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  addRowText: { fontFamily: font.medium, fontSize: 14, color: colors.indigoHover },

  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontFamily: font.regular, fontSize: 14, color: colors.textSecondary, marginTop: spacing.md },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  actionSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    paddingTop: spacing.sm,
    marginTop: "auto",
  },
  actionOption: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.base, paddingHorizontal: spacing.xl },
  actionText: { fontFamily: font.medium, fontSize: 15, color: colors.textPrimary },
  actionDivider: { height: 1, backgroundColor: colors.divider, marginHorizontal: spacing.xl },

  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginTop: spacing.md },
  existingSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  searchBar: {
    height: 46,
    marginTop: spacing.base,
    marginHorizontal: spacing.screenH,
    backgroundColor: colors.surface,
    borderRadius: radius.icon,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, marginLeft: spacing.sm, color: colors.textPrimary, fontFamily: font.regular, fontSize: 14 },
});
