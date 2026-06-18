// RupeeLog design system — exact tokens from the product spec.

export const colors = {
  bg: "#0D0F14",
  card: "#161A24",
  surface: "#1E2333",
  border: "rgba(255,255,255,0.07)",
  borderActive: "rgba(79,70,229,0.5)",
  heroBorder: "rgba(79,70,229,0.25)",
  divider: "rgba(255,255,255,0.06)",

  indigo: "#4F46E5",
  indigoHover: "#6366F1",
  teal: "#10B981",

  textPrimary: "#FFFFFF",
  textSecondary: "#8B8FA8",
  textTertiary: "#4B5268",

  expense: "#F87171",
  income: "#34D399",

  paymentSelectedBg: "#1A2E4A",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  screenH: 20,
  cardPad: 20,
  sectionGap: 16,
};

export const radius = {
  large: 20,
  medium: 16,
  chip: 10,
  button: 14,
  icon: 12,
  sheet: 24,
};

export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

// Reusable text styles per the typography scale.
export const type = {
  display: { fontFamily: font.bold, fontSize: 32, color: colors.textPrimary },
  heading: { fontFamily: font.semibold, fontSize: 20, color: colors.textPrimary },
  title: { fontFamily: font.semibold, fontSize: 16, color: colors.textPrimary },
  body: { fontFamily: font.regular, fontSize: 14, color: colors.textPrimary },
  caption: { fontFamily: font.regular, fontSize: 12, color: colors.textSecondary },
  micro: {
    fontFamily: font.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    color: colors.textSecondary,
  },
};

export const cardShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 12,
  elevation: 8,
};
