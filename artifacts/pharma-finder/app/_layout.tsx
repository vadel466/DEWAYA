import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as Font from "expo-font";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import IntroScreen from "@/components/IntroScreen";
import { AppProvider } from "@/context/AppContext";

/* ─────────────────────────────────────────────────────────────── */

const INTRO_KEY = "@dewaya_intro_shown";
const ICON      = require("../assets/images/icon_v2.png");

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

/* Prefetch splash icon into memory immediately */
Image.prefetch(ICON).catch(() => {});

/* Swallow harmless web font errors */
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String(e?.reason?.message ?? e?.reason ?? "");
    if (
      msg.includes("timed out") ||
      msg.includes("Délai") ||
      msg.includes("FontFaceObserver")
    ) e.preventDefault();
  });
}

/* ── React-Query client ── */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            60_000,
      gcTime:           10 * 60_000,
      retry:                1,
      retryDelay:           2_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect:   false,
    },
  },
});

/* ── Navigation tree ── */
function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="(tabs)"           options={{ animation: "fade" }} />
      <Stack.Screen name="duty-pharmacies"  options={{ animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="nearest-pharmacy" options={{ animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="pharmacy-portal"  options={{ animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="drug-price"       options={{ animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="other-services"   options={{ animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="find-doctor"      options={{ animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="duty-and-price"   options={{ animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="company-portal"   options={{ animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="about"            options={{ animation: "slide_from_bottom", presentation: "card" }} />
    </Stack>
  );
}

/* ─────────────────────────────────────────────────────────────── */

export default function RootLayout() {
  const [ready, setReady]             = useState(false);
  const [showIntro, setShowIntro]     = useState<boolean | null>(null);
  const [splashDone, setSplashDone]   = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  /* ── Step 1: Load fonts + read intro flag in parallel ── */
  useEffect(() => {
    let cancelled = false;

    /*
     * Hard ceiling: 1.5 s.
     * Fonts from @expo/vector-icons are bundled — they load in < 300 ms
     * on any device. This ceiling is just a safety net.
     */
    const ceiling = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 1_500);

    Promise.all([
      Font.loadAsync({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
        ...Ionicons.font,
        ...MaterialCommunityIcons.font,
      }).catch(() => { /* silently continue on error */ }),

      AsyncStorage.getItem(INTRO_KEY).then((val) => {
        if (!cancelled) setShowIntro(val !== "1");
      }).catch(() => {
        if (!cancelled) setShowIntro(true);
      }),
    ]).finally(() => {
      if (!cancelled) {
        clearTimeout(ceiling);
        setReady(true);
      }
    });

    return () => { cancelled = true; clearTimeout(ceiling); };
  }, []);

  /* ── Step 2: Fade out splash when ready + icon loaded ── */
  useEffect(() => {
    if (!ready || showIntro === null || !imageLoaded) return;

    if (Platform.OS !== "web") {
      SplashScreen.hideAsync().catch(() => {});
    }

    Animated.timing(fadeAnim, {
      toValue:         0,
      duration:        300,
      useNativeDriver: true,
    }).start(() => setSplashDone(true));
  }, [ready, showIntro, imageLoaded, fadeAnim]);

  /* ── Safety: mark icon loaded after 250 ms even if onLoadEnd is slow ── */
  useEffect(() => {
    const t = setTimeout(() => setImageLoaded(true), 250);
    return () => clearTimeout(t);
  }, []);

  const handleIntroFinish = useCallback(() => {
    AsyncStorage.setItem(INTRO_KEY, "1").catch(() => {});
    setShowIntro(false);
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={styles.root}>
            <AppProvider>
              {/* App renders immediately once ready — no extra gate */}
              {ready && <RootLayoutNav />}
              {ready && showIntro === true && (
                <IntroScreen onFinish={handleIntroFinish} />
              )}
            </AppProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>

      {/* Splash overlay — fades out when ready */}
      {!splashDone && (
        <Animated.View
          style={[styles.splash, { opacity: fadeAnim }]}
          pointerEvents="none"
        >
          <View style={styles.iconWrap}>
            <Image
              source={ICON}
              style={styles.icon}
              contentFit="cover"
              priority="high"
              cachePolicy="memory"
              onLoadEnd={() => setImageLoaded(true)}
              transition={0}
            />
          </View>
          <Text style={styles.nameAr}>أدوايـا</Text>
          <Text style={styles.nameLat}>D E W A Y A</Text>
          <Text style={styles.sub}>خدمة صحية متكاملة · موريتانيا</Text>
        </Animated.View>
      )}
    </SafeAreaProvider>
  );
}

/* ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1 },

  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0D9488",
    justifyContent:  "center",
    alignItems:      "center",
    zIndex:          9999,
  },

  iconWrap: {
    width:           144,
    height:          144,
    borderRadius:    36,
    backgroundColor: "#fff",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    28,
    overflow:        "hidden",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.25,
    shadowRadius:    20,
    elevation:       12,
  },

  icon: { width: 144, height: 144 },

  nameAr: {
    color:            "#fff",
    fontSize:         36,
    fontWeight:       "800",
    letterSpacing:    0.5,
    marginBottom:     4,
    textShadowColor:  "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  nameLat: {
    color:         "rgba(255,255,255,0.7)",
    fontSize:      12,
    fontWeight:    "700",
    letterSpacing: 6,
    marginBottom:  20,
  },

  sub: {
    color:         "rgba(255,255,255,0.45)",
    fontSize:      12,
    fontWeight:    "400",
    letterSpacing: 0.3,
  },
});
