import { Tabs } from "expo-router";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { colors, font } from "@/src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: "index", label: "Home", icon: "home-outline" },
  { name: "expenses", label: "Expenses", icon: "list-outline" },
  { name: "groups", label: "Groups", icon: "folder-outline" },
  { name: "insights", label: "Insights", icon: "bar-chart-outline" },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { height: 64 + insets.bottom, paddingBottom: insets.bottom }]}>
      {state.routes.map((route, i) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const focused = state.index === i;
        const color = focused ? colors.indigoHover : colors.textTertiary;
        return (
          <Pressable
            key={route.key}
            testID={`tab-${tab.label.toLowerCase()}`}
            style={styles.tab}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          >
            <View style={styles.pill}>{focused && <View style={styles.pillActive} />}</View>
            <Ionicons name={tab.icon} size={24} color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="expenses" />
      <Tabs.Screen name="groups" />
      <Tabs.Screen name="insights" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingTop: 8 },
  pill: { height: 4, marginBottom: 4, justifyContent: "center" },
  pillActive: { width: 16, height: 4, borderRadius: 2, backgroundColor: colors.indigo },
  label: { fontFamily: font.medium, fontSize: 10, letterSpacing: 0.4 },
});
