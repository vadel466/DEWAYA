import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

/* Safe wrapper — expo-glass-effect native module may not be available in Expo Go */
function checkLiquidGlass(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isLiquidGlassAvailable } = require("expo-glass-effect");
    return typeof isLiquidGlassAvailable === "function" && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/* NativeTabLayout — only rendered on iOS 26+ with Liquid Glass */
function NativeTabLayout() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NativeTabs } = require("expo-router/unstable-native-tabs");
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index" />
        <NativeTabs.Trigger name="admin" />
      </NativeTabs>
    );
  } catch {
    return <ClassicTabLayout />;
  }
}

function ClassicTabLayout() {
  const { t } = useApp();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : "#FFFFFF",
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: Colors.light.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF" }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t("admin"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (checkLiquidGlass()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
