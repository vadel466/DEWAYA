import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");
const ND = Platform.OS !== "web"; // native driver on native, JS thread on web

interface IntroScreenProps {
  onFinish: () => void;
  language?: "ar" | "fr";
}

export default function IntroScreen({
  onFinish,
  language = "ar",
}: IntroScreenProps) {
  // Icon is ALWAYS visible from the start — opacity stays at 1, no scale trick
  const logoAnim    = useRef(new Animated.Value(0)).current; // controls icon entrance
  const titleOpacity  = useRef(new Animated.Value(0)).current;
  const titleY        = useRef(new Animated.Value(16)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current; // full-screen exit

  useEffect(() => {
    // Safety fallback — if animation never completes, still call onFinish
    const fallback = setTimeout(onFinish, 5000);

    Animated.sequence([
      // 1. Icon fades/scales in quickly
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: ND,
      }),
      // 2. Short pause so user can see the icon fully
      Animated.delay(150),
      // 3. Title slides up
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: ND }),
        Animated.timing(titleY,       { toValue: 0, duration: 300, useNativeDriver: ND }),
      ]),
      // 4. Tagline fades in
      Animated.timing(taglineOpacity, { toValue: 1, duration: 260, useNativeDriver: ND }),
      // 5. Hold — icon+text visible for ~2 seconds as requested
      Animated.delay(2000),
      // 6. Fade the whole screen out
      Animated.timing(screenOpacity, { toValue: 0, duration: 350, useNativeDriver: ND }),
    ]).start(() => {
      clearTimeout(fallback);
      onFinish();
    });

    return () => clearTimeout(fallback);
  }, []);

  const logoScale = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      {/* Static decorative circles */}
      <View style={[styles.bgCircle, styles.bgCircle1]} />
      <View style={[styles.bgCircle, styles.bgCircle2]} />

      {/* Logo — animated entrance, then static */}
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: logoAnim,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <View style={styles.logoShadow}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.logoImage}
            resizeMode="contain"
            fadeDuration={0}
          />
        </View>
      </Animated.View>

      {/* App name */}
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
        {language === "ar"
          ? "أقرب صيدلية لدوائك"
          : "La pharmacie la plus proche"}
      </Animated.Text>

      {/* Loading dots */}
      <View style={styles.dots}>
        <Dot delay={0} />
        <Dot delay={220} />
        <Dot delay={440} />
      </View>
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1,   duration: 380, useNativeDriver: ND }),
        Animated.timing(opacity, { toValue: 0.3, duration: 380, useNativeDriver: ND }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return <Animated.View style={[styles.dot, { opacity }]} />;
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
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  bgCircle1: {
    width: width * 1.5,
    height: width * 1.5,
    top: -width * 0.5,
    left: -width * 0.25,
  },
  bgCircle2: {
    width: width * 1.2,
    height: width * 1.2,
    bottom: -width * 0.55,
    right: -width * 0.3,
  },
  logoWrapper: {
    marginBottom: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  logoShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 12,
    borderRadius: 48,
  },
  logoImage: {
    width: 200,
    height: 200,
    borderRadius: 48,
  },
  titleAr: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: 1,
  },
  titleFr: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.72)",
    letterSpacing: 9,
    textAlign: "center",
  },
  tagline: {
    marginTop: 20,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  dots: {
    position: "absolute",
    bottom: 60,
    flexDirection: "row",
    gap: 9,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
});
