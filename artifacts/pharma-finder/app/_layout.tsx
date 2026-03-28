import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as Font from "expo-font";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

const INTRO_KEY = "@dewaya_intro_shown";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import IntroScreen from "@/components/IntroScreen";
import { AppProvider } from "@/context/AppContext";

/* ── Keep native OS splash visible until we are ready ── */
if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

/* ── Suppress known harmless web rejections ── */
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
  const [appReady, setAppReady] = useState(false);
  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  const [splashVisible, setSplashVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  /* ── Load everything in parallel: fonts + assets + intro check ── */
  useEffect(() => {
    let cancelled = false;

    const fontTimeout = setTimeout(() => {
      if (!cancelled) setAppReady(true);
    }, 2000);

    const introTimeout = setTimeout(() => {
      if (!cancelled && showIntro === null) setShowIntro(false);
    }, 600);

    Promise.all([
      /* Fonts */
      Font.loadAsync({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
        ...Ionicons.font,
        ...MaterialCommunityIcons.font,
      }).catch(() => {}),

      /* Intro check */
      AsyncStorage.getItem(INTRO_KEY)
        .then((val) => {
          if (!cancelled) {
            clearTimeout(introTimeout);
            setShowIntro(val !== "1");
          }
        })
        .catch(() => {
          if (!cancelled) {
            clearTimeout(introTimeout);
            setShowIntro(true);
          }
        }),
    ]).finally(() => {
      if (!cancelled) {
        clearTimeout(fontTimeout);
        setAppReady(true);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(fontTimeout);
      clearTimeout(introTimeout);
    };
  }, []);

  /* ── Once app is ready + intro state known: hide native splash, then fade React splash ── */
  useEffect(() => {
    if (!appReady || showIntro === null) return;

    /* Hide the native OS splash first */
    if (Platform.OS !== "web") {
      SplashScreen.hideAsync().catch(() => {});
    }

    /* Fade out the React overlay over 350ms */
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      setSplashVisible(false);
    });
  }, [appReady, showIntro, fadeAnim]);

  const handleIntroFinish = useCallback(() => {
    AsyncStorage.setItem(INTRO_KEY, "1").catch(() => {});
    setShowIntro(false);
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <AppProvider>
                {appReady && <RootLayoutNav />}
                {appReady && showIntro === true && (
                  <IntroScreen onFinish={handleIntroFinish} />
                )}
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>

      {/* React splash overlay — covers everything until app is ready, then fades out */}
      {splashVisible && (
        <Animated.View
          style={[styles.splash, { opacity: fadeAnim }]}
          pointerEvents="none"
        >
          {/* App icon */}
          <View style={styles.splashIconWrap}>
            <Image
              source={require("../assets/images/icon_v2.png")}
              style={styles.splashIcon}
              resizeMode="cover"
              fadeDuration={0}
            />
          </View>

          {/* App name */}
          <Text style={styles.splashNameAr}>أدوايـا</Text>
          <Text style={styles.splashNameLat}>D E W A Y A</Text>
          <Text style={styles.splashSub}>خدمة صحية متكاملة · موريتانيا</Text>
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
  splashIconWrap: {
    width: 140,
    height: 140,
    borderRadius: 36,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  splashIcon: { width: 140, height: 140 },
  splashNameAr: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  splashNameLat: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 6,
    marginBottom: 20,
  },
  splashSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "400",
    letterSpacing: 0.3,
  },
});
