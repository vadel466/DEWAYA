import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const { width, height } = Dimensions.get("window");

interface IntroScreenProps {
  onFinish: () => void;
  language?: "ar" | "fr";
}

export default function IntroScreen({ onFinish, language = "ar" }: IntroScreenProps) {
  const bgScale = useRef(new Animated.Value(1.2)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ND = false;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, useNativeDriver: ND }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: ND }),
      ])
    );

    const timer = setTimeout(() => onFinish(), 3400);

    Animated.sequence([
      Animated.timing(bgScale, { toValue: 1, duration: 700, useNativeDriver: ND }),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: ND }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: ND }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 350, useNativeDriver: ND }),
        Animated.timing(titleY, { toValue: 0, duration: 350, useNativeDriver: ND }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: ND }),
      Animated.delay(800),
      Animated.timing(exitOpacity, { toValue: 0, duration: 400, useNativeDriver: ND }),
    ]).start(() => { clearTimeout(timer); onFinish(); });

    pulseLoop.start();
    return () => { pulseLoop.stop(); clearTimeout(timer); };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>
      <Animated.View style={[styles.bgCircle, styles.bgCircle1, { transform: [{ scale: bgScale }] }]} />
      <Animated.View style={[styles.bgCircle, styles.bgCircle2, { transform: [{ scale: bgScale }] }]} />

      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: logoOpacity, transform: [{ scale: Animated.multiply(logoScale, pulse) }] },
        ]}
      >
        <View style={styles.logoCircle}>
          <MaterialCommunityIcons name="pill" size={52} color="#fff" />
        </View>
        <View style={styles.logoBadge}>
          <MaterialCommunityIcons name="map-marker-check" size={18} color="#fff" />
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleY }], alignItems: "center" }}>
        <Text style={styles.titleAr}>أدْواَيَ</Text>
        <Text style={styles.titleFr}>DEWAYA</Text>
      </Animated.View>

      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        {language === "ar" ? "أقرب صيدلية لدوائك" : "La pharmacie la plus proche"}
      </Animated.Text>

      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <DotsAnimated key={i} delay={i * 200} />
        ))}
      </View>
    </Animated.View>
  );
}

function DotsAnimated({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0.3, duration: 400, useNativeDriver: false }),
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
    marginBottom: 28,
    position: "relative",
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.primary,
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
