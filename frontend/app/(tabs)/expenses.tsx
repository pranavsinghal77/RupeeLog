import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  FlatList,
  Modal,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { colors, spacing, radius, type, font } from "@/src/theme";
import { CATEGORIES, getCategory } from "@/src/categories";
import { formatMoney, relativeTime } from "@/src/format";
import { getAllExpenses, deleteExpense, Expense } from "@/src/db";
import { storage } from "@/src/utils/storage";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CATEGORY_FILTERS = ["All", ...CATEGORIES.map((c) => c.key)];
const PAYMENT_FILTERS = ["All", "Cash", "UPI", "Debit Card", "Credit Card", "Net Banking", "Wallet", "BNPL", "Cheque"];

type SortKey = "newest" | "oldest" | "highest" | "lowest";
const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  highest: "Highest amount",
  lowest: "Lowest amount",
};

type ListRow =
  | { kind: "header"; key: string; label: string }
  | { kind: "item"; key: string; expense: Expense };

function dateHeaderLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

export default function Expenses() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [allItems, setAllItems] = useState<Expense[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [symbol, setSymbol] = useState("₹");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const pendingRef = useRef<{ item: Expense; timer: ReturnType<typeof setTimeout> } | null>(null);

  const commitPending = useCallback(() => {
    const p = pendingRef.current;
    if (p) {
      clearTimeout(p.timer);
      deleteExpense(p.item.id);
      pendingRef.current = null;
    }
  }, []);

  const load = useCallback(() => {
    storage.getItem<string>("currency_symbol", "₹").then((s) => setSymbol(s ?? "₹"));
    getAllExpenses().then((rows) => {
      setAllItems(rows);
      setLoaded(true);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => commitPending();
    }, [load, commitPending]),
  );

  useEffect(() => () => commitPending(), [commitPending]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allItems.filter((e) => {
      if (q && !(e.title.toLowerCase().includes(q) || (e.note ?? "").toLowerCase().includes(q))) return false;
      if (categoryFilter !== "All" && e.category !== categoryFilter) return false;
      if (paymentFilter !== "All" && e.payment_method !== paymentFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.created_at < b.created_at ? -1 : 1;
        case "highest":
          return b.amount - a.amount;
        case "lowest":
          return a.amount - b.amount;
        default:
          return a.created_at < b.created_at ? 1 : -1;
      }
    });
    return list;
  }, [allItems, search, categoryFilter, paymentFilter, sort]);

  const filterActive = categoryFilter !== "All" || paymentFilter !== "All";
  const filteredTotal = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);

  const rows = useMemo<ListRow[]>(() => {
    const out: ListRow[] = [];
    const seen = new Set<string>();
    for (const e of filtered) {
      if (!seen.has(e.expense_date)) {
        seen.add(e.expense_date);
        out.push({ kind: "header", key: `h-${e.expense_date}`, label: dateHeaderLabel(e.expense_date) });
      }
      out.push({ kind: "item", key: `r-${e.id}`, expense: e });
    }
    return out;
  }, [filtered]);

  const onDelete = (item: Expense) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // commit any prior pending delete immediately, then start a fresh one
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timer);
      deleteExpense(pendingRef.current.item.id);
      pendingRef.current = null;
    }
    if (Platform.OS !== "web") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAllItems((prev) => prev.filter((x) => x.id !== item.id));
    setToastVisible(true);
    const timer = setTimeout(() => {
      deleteExpense(item.id);
      pendingRef.current = null;
      setToastVisible(false);
    }, 4000);
    pendingRef.current = { item, timer };
  };

  const onUndo = () => {
    const p = pendingRef.current;
    if (p) {
      clearTimeout(p.timer);
      if (Platform.OS !== "web") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAllItems((prev) => [...prev, p.item]);
      pendingRef.current = null;
    }
    setToastVisible(false);
  };

  const onEdit = (e: Expense) => {
    router.push({
      pathname: "/add-expense",
      params: {
        id: String(e.id),
        title: e.title,
        amount: String(e.amount),
        category: e.category,
        payment_method: e.payment_method,
        expense_date: e.expense_date,
        expense_time: e.expense_time,
        note: e.note ?? "",
      },
    });
  };

  const renderRow = ({ item }: { item: ListRow }) => {
    if (item.kind === "header") {
      return <Text style={styles.dateHeader}>{item.label}</Text>;
    }
    return <ExpenseRow expense={item.expense} symbol={symbol} onDelete={onDelete} onEdit={onEdit} />;
  };

  return (
    <View style={styles.root} testID="expenses-screen">
      {/* Sticky header */}
      <View style={{ paddingTop: insets.top + spacing.base }}>
        <View style={styles.headerText}>
          <Text style={type.heading}>Expenses</Text>
          <Text style={[type.caption, { marginTop: 2 }]} testID="transactions-count">
            {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            testID="search-input"
            style={styles.searchInput}
            placeholder="Search expenses…"
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable testID="clear-search" onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle-outline" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        {/* Category filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ marginTop: 10 }}
        >
          {CATEGORY_FILTERS.map((c) => {
            const sel = categoryFilter === c;
            return (
              <Pressable
                key={c}
                testID={`category-filter-${c}`}
                style={[styles.chip, sel ? styles.chipSel : styles.chipUnsel]}
                onPress={() => setCategoryFilter(c)}
              >
                <Text style={[styles.chipText, { color: sel ? "#FFFFFF" : colors.textSecondary }]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Payment filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ marginTop: spacing.sm }}
        >
          {PAYMENT_FILTERS.map((p) => {
            const sel = paymentFilter === p;
            return (
              <Pressable
                key={p}
                testID={`payment-filter-${p}`}
                style={[styles.chip, sel ? styles.chipSel : styles.chipUnsel]}
                onPress={() => setPaymentFilter(p)}
              >
                <Text style={[styles.chipText, { color: sel ? "#FFFFFF" : colors.textSecondary }]}>{p}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sort row */}
        <Pressable style={styles.sortRow} onPress={() => setSortOpen(true)} testID="sort-button">
          <Text style={[type.caption, { color: colors.textTertiary }]}>Sort:</Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>{SORT_LABELS[sort]}</Text>
          <Ionicons name="chevron-down-outline" size={13} color={colors.textTertiary} />
        </Pressable>

        {/* Filtered summary strip (only when a filter is active) */}
        {filterActive && (
          <View style={styles.summaryStrip} testID="summary-strip">
            <Ionicons name="bar-chart-outline" size={15} color={colors.indigoHover} />
            <Text style={styles.summaryText}>
              {formatMoney(filteredTotal, symbol)} across {filtered.length} expense
              {filtered.length === 1 ? "" : "s"}
            </Text>
          </View>
        )}
      </View>

      {/* List */}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={renderRow}
        showsVerticalScrollIndicator={false}
        style={{ marginTop: spacing.md }}
        contentContainerStyle={[
          { paddingHorizontal: spacing.screenH, paddingBottom: 100 },
          rows.length === 0 && { flexGrow: 1 },
        ]}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty} testID="empty-state">
              <Ionicons name="receipt-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No expenses found</Text>
              <Text style={styles.emptySub}>Try adjusting your search or filters</Text>
            </View>
          ) : null
        }
      />

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

      {/* Undo toast */}
      {toastVisible && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          style={[styles.toast, { bottom: insets.bottom + 72 }]}
          testID="undo-toast"
        >
          <Text style={styles.toastText}>Expense deleted</Text>
          <Pressable onPress={onUndo} testID="undo-button" hitSlop={8}>
            <Text style={styles.toastUndo}>Undo</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Sort modal */}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSortOpen(false)}>
          <View style={[styles.sortSheet, { paddingBottom: insets.bottom + spacing.base }]}>
            <Text style={[type.title, { marginBottom: spacing.sm }]}>Sort by</Text>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => {
              const active = sort === k;
              return (
                <Pressable
                  key={k}
                  testID={`sort-option-${k}`}
                  style={styles.sortOption}
                  onPress={() => {
                    setSort(k);
                    setSortOpen(false);
                  }}
                >
                  <Text style={[type.body, { color: active ? colors.indigoHover : colors.textPrimary }]}>
                    {SORT_LABELS[k]}
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

function ExpenseRow({
  expense,
  symbol,
  onDelete,
  onEdit,
}: {
  expense: Expense;
  symbol: string;
  onDelete: (e: Expense) => void;
  onEdit: (e: Expense) => void;
}) {
  const swipeRef = useRef<React.ElementRef<typeof ReanimatedSwipeable>>(null);
  const cat = getCategory(expense.category);
  const income = expense.category === "Income";

  const renderRight = () => (
    <Pressable
      testID={`delete-${expense.id}`}
      style={styles.deleteAction}
      onPress={() => {
        swipeRef.current?.close();
        onDelete(expense);
      }}
    >
      <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
    </Pressable>
  );

  const renderLeft = () => (
    <Pressable
      testID={`edit-${expense.id}`}
      style={styles.editAction}
      onPress={() => {
        swipeRef.current?.close();
        onEdit(expense);
      }}
    >
      <Ionicons name="create-outline" size={20} color="#FFFFFF" />
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      leftThreshold={40}
      overshootRight={false}
      overshootLeft={false}
      renderRightActions={renderRight}
      renderLeftActions={renderLeft}
      containerStyle={styles.swipeContainer}
    >
      <View style={styles.row} testID={`expense-row-${expense.id}`}>
        <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
          <Ionicons name={cat.icon} size={18} color={cat.iconColor} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={type.title} numberOfLines={1} ellipsizeMode="tail">
            {expense.title}
          </Text>
          <Text style={[type.caption, { color: colors.textTertiary, marginTop: 2 }]}>
            {expense.payment_method}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[type.title, { color: income ? colors.income : colors.expense }]}>
            {income ? "+" : "-"}
            {formatMoney(expense.amount, symbol).replace("-", "")}
          </Text>
          <Text style={[type.caption, { color: colors.textTertiary, marginTop: 2 }]}>
            {relativeTime(expense.created_at)}
          </Text>
        </View>
      </View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerText: { paddingHorizontal: spacing.screenH },

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
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.textPrimary,
    fontFamily: font.regular,
    fontSize: 14,
  },

  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.screenH },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: radius.chip, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipSel: { backgroundColor: colors.indigo },
  chipUnsel: { backgroundColor: colors.surface },
  chipText: { fontFamily: font.medium, fontSize: 12 },

  sortRow: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.screenH,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  summaryStrip: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.screenH,
    backgroundColor: "rgba(79,70,229,0.12)",
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.25)",
    borderRadius: radius.icon,
    paddingVertical: 10,
    paddingHorizontal: spacing.base,
    flexDirection: "row",
    alignItems: "center",
  },
  summaryText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },

  dateHeader: {
    fontFamily: font.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textTertiary,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },

  swipeContainer: { borderRadius: radius.button, marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.button,
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  catIcon: { width: 36, height: 36, borderRadius: radius.chip, alignItems: "center", justifyContent: "center" },

  deleteAction: {
    width: 72,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderTopRightRadius: radius.button,
    borderBottomRightRadius: radius.button,
  },
  editAction: {
    width: 72,
    backgroundColor: colors.indigo,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: radius.button,
    borderBottomLeftRadius: radius.button,
  },

  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: font.semibold, fontSize: 18, color: colors.textSecondary, marginTop: spacing.md },
  emptySub: { fontFamily: font.regular, fontSize: 14, color: colors.textTertiary, marginTop: spacing.xs },

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

  toast: {
    position: "absolute",
    left: spacing.screenH,
    right: spacing.screenH,
    zIndex: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: radius.icon,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toastText: { fontFamily: font.regular, fontSize: 13, color: colors.textPrimary },
  toastUndo: { fontFamily: font.semibold, fontSize: 13, color: colors.indigoHover },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sortSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
});
