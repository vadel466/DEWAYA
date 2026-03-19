import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");

interface IntroScreenProps {
  onFinish: () => void;
  language?: "ar" | "fr";
}

export default function IntroScreen({
  onFinish,
  language = "ar",
}: IntroScreenProps) {
  const logoScale   = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY      = useRef(new Animated.Value(14)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const dot0 = useRef(new Animated.Value(0.3)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const makeDot = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1,   duration: 350, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ])
      );

    const d0 = makeDot(dot0, 0);
    const d1 = makeDot(dot1, 200);
    const d2 = makeDot(dot2, 400);
    d0.start(); d1.start(); d2.start();

    // Main sequence — all native driver
    Animated.sequence([
      // 1. Icon pops in immediately
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 80,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]),
      // 2. Title slides up
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
      // 3. Tagline fades in
      Animated.timing(taglineOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      // 4. Hold
      Animated.delay(1000),
      // 5. Exit fade
      Animated.timing(exitOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start(() => {
      d0.stop(); d1.stop(); d2.stop();
      onFinish();
    });

    return () => { d0.stop(); d1.stop(); d2.stop(); };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>
      {/* Decorative circles — static, no animation cost */}
      <View style={[styles.bgCircle, styles.bgCircle1]} />
      <View style={[styles.bgCircle, styles.bgCircle2]} />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.logoImage}
          resizeMode="contain"
          fadeDuration={0}
        />
      </Animated.View>

      {/* Title */}
      <Animated.View
        style={{
          opacity: titleOpacity,
          transform: [{ translateY: titleY }],
          alignItems: "center",
        }}
      >
        <Text style={styles.titleAr}>أدْواَيَ</Text>
        <Text style={styles.titleFr}>DEWAYA</Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        {language === "ar" ? "أقرب صيدلية لدوائك" : "La pharmacie la plus proche"}
      </Animated.Text>

      {/* Loading dots */}
      <View style={styles.dots}>
        {([dot0, dot1, dot2] as Animated.Value[]).map((anim, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    overflow: "hidden",
  },
  bgCircle: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  bgCircle1: {
    width: width * 1.4,
    height: width * 1.4,
    top: -width * 0.4,
    left: -width * 0.2,
  },
  bgCircle2: {
    width: width * 1.2,
    height: width * 1.2,
    bottom: -width * 0.5,
    right: -width * 0.3,
  },
  logoWrapper: {
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 190,
    height: 190,
    borderRadius: 95,
  },
  titleAr: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 2,
    letterSpacing: 1,
  },
  titleFr: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 8,
    textAlign: "center",
  },
  tagline: {
    marginTop: 18,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  dots: {
    position: "absolute",
    bottom: 56,
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
});
