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
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

const INTRO_KEY = "@dewaya_intro_shown";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import IntroScreen from "@/components/IntroScreen";
import { AppProvider } from "@/context/AppContext";

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

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
      <Stack.Screen name="company-portal"   options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="about"            options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);
  /* null = checking AsyncStorage, true/false = result */
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  /* ── Font loading ── */
  useEffect(() => {
    if (Platform.OS === "web") {
      /* On web fonts load via CSS — mark ready immediately */
      setFontsReady(true);
      return;
    }

    const fallback = setTimeout(() => setFontsReady(true), 2500);

    Font.loadAsync({
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
    })
      .catch(() => {})
      .finally(() => {
        clearTimeout(fallback);
        setFontsReady(true);
      });

    return () => clearTimeout(fallback);
  }, []);

  /* ── Intro check — fast, with 1s safety timeout ── */
  useEffect(() => {
    const safetyTimeout = setTimeout(() => setShowIntro(false), 1000);

    AsyncStorage.getItem(INTRO_KEY)
      .then((val) => {
        clearTimeout(safetyTimeout);
        setShowIntro(val !== "1");
      })
      .catch(() => {
        clearTimeout(safetyTimeout);
        setShowIntro(true);
      });

    return () => clearTimeout(safetyTimeout);
  }, []);

  /* ── Hide native splash once both are ready ── */
  useEffect(() => {
    if (fontsReady && showIntro !== null && Platform.OS !== "web") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady, showIntro]);

  const handleIntroFinish = useCallback(() => {
    AsyncStorage.setItem(INTRO_KEY, "1").catch(() => {});
    setShowIntro(false);
  }, []);

  /* Show splash overlay while fonts or intro state are loading */
  const showingSplash = !fontsReady || showIntro === null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <AppProvider>
                {fontsReady && <RootLayoutNav />}
                {fontsReady && showIntro === true && (
                  <IntroScreen onFinish={handleIntroFinish} />
                )}
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>

      {/* Splash overlay — hides once fonts + intro state are both known */}
      {showingSplash && (
        <View style={styles.splash} pointerEvents="none">
          {/* App icon — same icon used on Play Store / App Store */}
          <View style={styles.splashIconWrap}>
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.splashIcon}
              resizeMode="contain"
            />
          </View>
          {/* App name in Arabic */}
          <Text style={styles.splashNameAr}>أدوايـا</Text>
          {/* Tagline in Latin */}
          <Text style={styles.splashNameLat}>D E W A Y A</Text>
          {/* Subtle tagline */}
          <Text style={styles.splashSub}>خدمة صحية متكاملة · موريتانيا</Text>
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
  splashIconWrap: {
    width: 130, height: 130, borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12,
    elevation: 8,
  },
  splashIcon: { width: 100, height: 100 },
  splashNameAr: {
    color: "#fff", fontSize: 36, fontWeight: "800",
    letterSpacing: 0.5, marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.15)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  splashNameLat: {
    color: "rgba(255,255,255,0.75)", fontSize: 12,
    fontWeight: "700", letterSpacing: 6, marginBottom: 20,
  },
  splashSub: {
    color: "rgba(255,255,255,0.5)", fontSize: 12,
    fontWeight: "400", letterSpacing: 0.3,
  },
});
