import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";

import { storage } from "@/src/utils/storage";
import { colors } from "@/src/theme";

export default function Index() {
  const [route, setRoute] = useState<string | null>(null);

  useEffect(() => {
    storage.getItem<boolean>("onboarding_complete", false).then((done) => {
      setRoute(done ? "/(tabs)" : "/onboarding");
    });
  }, []);

  if (!route) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return <Redirect href={route as never} />;
}
