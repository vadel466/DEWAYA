import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import IntroScreen from "@/components/IntroScreen";
import { AppProvider } from "@/context/AppContext";

// Keep native splash visible until JS is ready
SplashScreen.preventAutoHideAsync();

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
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="duty-pharmacies"    options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="nearest-pharmacy"   options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="pharmacy-portal"    options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="drug-price"         options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="other-services"     options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="find-doctor"        options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
      <Stack.Screen name="duty-and-price"     options={{ headerShown: false, animation: "slide_from_bottom", presentation: "card" }} />
    </Stack>
  );
}

function IntroWrapper({ onFinish }: { onFinish: () => void }) {
  const splashHidden = useRef(false);

  // Hide native splash the moment this component is committed to screen
  // useLayoutEffect fires before paint — seamless handoff from native → JS splash
  useLayoutEffect(() => {
    if (!splashHidden.current) {
      splashHidden.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  return <IntroScreen onFinish={onFinish} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [showIntro, setShowIntro] = useState(true);

  const handleIntroFinish = useCallback(() => setShowIntro(false), []);

  // Fallback: if fonts somehow never load, still proceed after 3s
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <AppProvider>
                <RootLayoutNav />
                {showIntro && <IntroWrapper onFinish={handleIntroFinish} />}
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
