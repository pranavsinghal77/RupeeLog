import { Ionicons } from "@expo/vector-icons";

export type CategoryKey =
  | "Food"
  | "Grocery"
  | "Transport"
  | "Rent"
  | "Utilities"
  | "Healthcare"
  | "Shopping"
  | "Entertainment"
  | "Education"
  | "Fuel"
  | "EMI"
  | "Insurance"
  | "Travel"
  | "Income"
  | "Other";

type IoniconName = keyof typeof Ionicons.glyphMap;

export interface CategoryDef {
  key: CategoryKey;
  icon: IoniconName;
  bg: string;
  iconColor: string;
}

export const CATEGORIES: CategoryDef[] = [
  { key: "Food", icon: "fast-food-outline", bg: "#2D1F3D", iconColor: "#A78BFA" },
  { key: "Grocery", icon: "basket-outline", bg: "#1A3A2A", iconColor: "#86EFAC" },
  { key: "Transport", icon: "car-outline", bg: "#1A2E4A", iconColor: "#60A5FA" },
  { key: "Rent", icon: "home-outline", bg: "#1A3A2E", iconColor: "#34D399" },
  { key: "Utilities", icon: "flash-outline", bg: "#2E2A1A", iconColor: "#FCD34D" },
  { key: "Healthcare", icon: "medical-outline", bg: "#2E1A1A", iconColor: "#F87171" },
  { key: "Shopping", icon: "bag-handle-outline", bg: "#2E1A2D", iconColor: "#F472B6" },
  { key: "Entertainment", icon: "film-outline", bg: "#1A1A3A", iconColor: "#818CF8" },
  { key: "Education", icon: "book-outline", bg: "#1A2E2D", iconColor: "#2DD4BF" },
  { key: "Fuel", icon: "flame-outline", bg: "#2E2210", iconColor: "#FB923C" },
  { key: "EMI", icon: "card-outline", bg: "#1A2030", iconColor: "#38BDF8" },
  { key: "Insurance", icon: "shield-checkmark-outline", bg: "#1E2A1A", iconColor: "#86EFAC" },
  { key: "Travel", icon: "airplane-outline", bg: "#1A2530", iconColor: "#7DD3FC" },
  { key: "Income", icon: "trending-up-outline", bg: "#0F2A1A", iconColor: "#34D399" },
  { key: "Other", icon: "ellipse-outline", bg: "#1E1E2E", iconColor: "#6B7280" },
];

const MAP: Record<string, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
);

export function getCategory(key: string): CategoryDef {
  return MAP[key] ?? MAP.Other;
}

export const PAYMENT_METHODS = [
  "UPI",
  "Cash",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Wallet",
];
