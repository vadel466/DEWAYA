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

const INTRO_KEY = "@dewaya_intro_shown";
const ICON = require("../assets/images/icon_v2.png");

import { ErrorBoundary } from "@/components/ErrorBoundary";
import IntroScreen from "@/components/IntroScreen";
import { AppProvider } from "@/context/AppContext";

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

Image.prefetch(ICON).catch(() => {});

if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    const msg: string =
      e?.reason?.message ?? e?.reason ?? String(e?.reason ?? "");
    if (
      msg.includes("timed out") ||
      msg.includes("Délai") ||
      msg.includes("FontFaceObserver")
    ) {
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
  const [appReady, setAppReady]           = useState(false);
  const [showIntro, setShowIntro]         = useState<boolean | null>(null);
  const [imageLoaded, setImageLoaded]     = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  /* ── Load fonts + check intro ── */
  useEffect(() => {
    let cancelled = false;

    /* Hard timeout: 1 second max — don't make user wait */
    const hardTimeout = setTimeout(() => {
      if (!cancelled) {
        setAppReady(true);
        setShowIntro((v) => (v === null ? false : v));
      }
    }, 1000);

    const introFallback = setTimeout(() => {
      if (!cancelled) setShowIntro((v) => (v === null ? false : v));
    }, 400);

    Promise.all([
      Font.loadAsync({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
        ...Ionicons.font,
        ...MaterialCommunityIcons.font,
      }).catch(() => {}),

      AsyncStorage.getItem(INTRO_KEY)
        .then((val) => {
          if (!cancelled) {
            clearTimeout(introFallback);
            setShowIntro(val !== "1");
          }
        })
        .catch(() => {
          if (!cancelled) {
            clearTimeout(introFallback);
            setShowIntro(true);
          }
        }),
    ]).finally(() => {
      if (!cancelled) {
        clearTimeout(hardTimeout);
        setAppReady(true);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(hardTimeout);
      clearTimeout(introFallback);
    };
  }, []);

  /* ── Hide splash when ready ── */
  useEffect(() => {
    if (!appReady || showIntro === null || !imageLoaded) return;

    if (Platform.OS !== "web") {
      SplashScreen.hideAsync().catch(() => {});
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => setSplashVisible(false));
  }, [appReady, showIntro, imageLoaded, fadeAnim]);

  /* ── Safety: imageLoaded within 200ms ── */
  useEffect(() => {
    const t = setTimeout(() => setImageLoaded(true), 200);
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
              {appReady && <RootLayoutNav />}
              {appReady && showIntro === true && (
                <IntroScreen onFinish={handleIntroFinish} />
              )}
            </AppProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>

      {splashVisible && (
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

const styles = StyleSheet.create({
  root: { flex: 1 },

  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0D9488",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },

  iconWrap: {
    width: 144,
    height: 144,
    borderRadius: 36,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },

  icon: { width: 144, height: 144 },

  nameAr: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  nameLat: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 6,
    marginBottom: 20,
  },

  sub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "400",
    letterSpacing: 0.3,
  },
});
