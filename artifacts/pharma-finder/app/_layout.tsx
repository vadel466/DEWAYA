import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as Font from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import IntroScreen from "@/components/IntroScreen";
import { AppProvider } from "@/context/AppContext";

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

/*
 * fontfaceobserver (used internally by expo-font on web) fires unhandled
 * promise rejections when a font times out — those escape our .catch() because
 * they originate inside a separate Promise.race() inside the library.
 * We suppress them globally on web so they never surface as error overlays.
 */
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    const msg: string =
      e?.reason?.message ?? e?.reason ?? String(e?.reason ?? "");
    if (msg.includes("timed out") || msg.includes("Délai") || msg.includes("FontFaceObserver")) {
      e.preventDefault();
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      retryDelay: 2000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="(tabs)"           options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="duty-pharmacies"  options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="nearest-pharmacy" options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="pharmacy-portal"  options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="drug-price"       options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="other-services"   options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="find-doctor"      options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="duty-and-price"   options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (Platform.OS === "web") {
      setReady(true);
      return;
    }

    const fallback = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 3000);

    Font.loadAsync({
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
    })
      .catch(() => {})
      .finally(() => {
        clearTimeout(fallback);
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (ready && Platform.OS !== "web") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  const handleIntroFinish = useCallback(() => setShowIntro(false), []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <AppProvider>
                <RootLayoutNav />
                {showIntro && <IntroScreen onFinish={handleIntroFinish} />}
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
      {!ready && (
        <View style={styles.splash} pointerEvents="none">
          <Image
            source={require("../assets/images/splash-icon.png")}
            style={styles.splashIcon}
            resizeMode="contain"
          />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0D9488",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  splashIcon: { width: 140, height: 140 },
});
