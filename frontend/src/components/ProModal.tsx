import { Modal, View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, type, font } from "@/src/theme";

// Generic Pro upgrade modal — features passed by caller so it can be reused
// for the groups limit, templates limit, etc.
export function ProModal({
  visible,
  onClose,
  features,
}: {
  visible: boolean;
  onClose: () => void;
  features: string[];
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}} testID="pro-modal">
          <Ionicons name="star-outline" size={36} color="#F59E0B" style={{ alignSelf: "center", marginBottom: spacing.md }} />
          <Text style={[type.heading, { textAlign: "center" }]}>Upgrade to Pro</Text>
          <Text style={[type.caption, { textAlign: "center", marginTop: spacing.xs }]}>Unlock all premium features</Text>
          <View style={styles.divider} />
          {features.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.teal} />
              <Text style={[type.caption, { marginLeft: spacing.sm, color: colors.textSecondary }]}>{f}</Text>
            </View>
          ))}
          <Pressable style={styles.btn} onPress={onClose} testID="pro-cta">
            <Text style={styles.btnText}>Try 14 days free — ₹799/year</Text>
          </Pressable>
          <Pressable onPress={onClose} testID="pro-maybe-later">
            <Text style={styles.later}>Maybe later</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    paddingVertical: 28,
    paddingHorizontal: spacing.xl,
    marginHorizontal: spacing["2xl"],
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.3)",
    alignSelf: "stretch",
  },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.base },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  btn: { height: 52, backgroundColor: colors.indigo, borderRadius: radius.button, marginTop: spacing.lg, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: font.semibold, fontSize: 14, color: "#FFFFFF" },
  later: { fontFamily: font.regular, fontSize: 13, color: colors.textTertiary, textAlign: "center", marginTop: 14 },
});
