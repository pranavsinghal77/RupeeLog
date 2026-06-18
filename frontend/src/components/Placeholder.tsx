import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, radius, type } from "@/src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

export function Placeholder({
  title,
  subtitle,
  icon,
  testID,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID={testID}>
      <View style={styles.header}>
        <Text style={type.heading}>{title}</Text>
      </View>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={32} color={colors.indigoHover} />
        </View>
        <Text style={[type.title, styles.t]}>Coming soon</Text>
        <Text style={[type.body, styles.s]}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.screenH, paddingTop: spacing.base, paddingBottom: spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.base,
  },
  t: { marginBottom: spacing.sm },
  s: { color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
