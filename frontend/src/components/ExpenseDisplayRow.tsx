import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius } from "@/src/theme";
import { type as typeStyles } from "@/src/theme";
import { getCategory } from "@/src/categories";
import { formatMoney, relativeTime } from "@/src/format";
import { Expense } from "@/src/db";

export function ExpenseDisplayRow({
  expense,
  symbol,
  onPress,
  testID,
}: {
  expense: Expense;
  symbol: string;
  onPress?: () => void;
  testID?: string;
}) {
  const cat = getCategory(expense.category);
  const income = expense.category === "Income";
  const Container: typeof Pressable | typeof View = onPress ? Pressable : View;

  return (
    <Container style={styles.row} onPress={onPress} testID={testID}>
      <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
        <Ionicons name={cat.icon} size={18} color={cat.iconColor} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={typeStyles.title} numberOfLines={1} ellipsizeMode="tail">
          {expense.title}
        </Text>
        <Text style={[typeStyles.caption, { color: colors.textTertiary, marginTop: 2 }]}>
          {expense.payment_method}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[typeStyles.title, { color: income ? colors.income : colors.expense }]}>
          {income ? "+" : "-"}
          {formatMoney(expense.amount, symbol).replace("-", "")}
        </Text>
        <Text style={[typeStyles.caption, { color: colors.textTertiary, marginTop: 2 }]}>
          {relativeTime(expense.created_at)}
        </Text>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.button,
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  catIcon: { width: 36, height: 36, borderRadius: radius.chip, alignItems: "center", justifyContent: "center" },
});
