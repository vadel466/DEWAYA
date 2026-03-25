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
import { useApp } from "@/context/AppContext";

const { width } = Dimensions.get("window");
const ND = Platform.OS !== "web";

interface IntroScreenProps {
  onFinish: () => void;
}

export default function IntroScreen({ onFinish }: IntroScreenProps) {
  const { language } = useApp();
  const logoAnim       = useRef(new Animated.Value(0)).current;
  const titleOpacity   = useRef(new Animated.Value(0)).current;
  const titleY         = useRef(new Animated.Value(18)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY       = useRef(new Animated.Value(10)).current;
  const screenOpacity  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const fallback = setTimeout(onFinish, 5000);

    Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 280, useNativeDriver: ND }),
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 280, useNativeDriver: ND }),
        Animated.timing(titleY,       { toValue: 0, duration: 280, useNativeDriver: ND }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 260, useNativeDriver: ND }),
        Animated.timing(taglineY,       { toValue: 0, duration: 260, useNativeDriver: ND }),
      ]),
      Animated.delay(1600),
      Animated.timing(screenOpacity, { toValue: 0, duration: 320, useNativeDriver: ND }),
    ]).start(() => {
      clearTimeout(fallback);
      onFinish();
    });

    return () => clearTimeout(fallback);
  }, []);

  const logoScale = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <View style={[styles.bgCircle, styles.bgCircle1]} />
      <View style={[styles.bgCircle, styles.bgCircle2]} />
      <View style={[styles.bgCircle, styles.bgCircle3]} />

      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: logoAnim, transform: [{ scale: logoScale }] },
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

      <Animated.View
        style={{
          opacity: titleOpacity,
          transform: [{ translateY: titleY }],
          alignItems: "center",
        }}
      >
        <Text style={styles.titleAr}>أدْواَيَة</Text>
        <Text style={styles.titleFr}>DEWAYA</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.taglineWrap,
          { opacity: taglineOpacity, transform: [{ translateY: taglineY }] },
        ]}
      >
        <View style={styles.taglinePill}>
          <Text style={styles.taglineText}>
            {language === "ar" ? "خدمة صحية متكاملة" : "Service de santé intégré"}
          </Text>
        </View>
      </Animated.View>

      <View style={styles.dots}>
        <Dot delay={0} />
        <Dot delay={200} />
        <Dot delay={400} />
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
        Animated.timing(opacity, { toValue: 1,   duration: 360, useNativeDriver: ND }),
        Animated.timing(opacity, { toValue: 0.3, duration: 360, useNativeDriver: ND }),
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
  },
  bgCircle1: {
    width: width * 1.6,
    height: width * 1.6,
    top: -width * 0.55,
    left: -width * 0.3,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  bgCircle2: {
    width: width * 1.1,
    height: width * 1.1,
    bottom: -width * 0.5,
    right: -width * 0.25,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  bgCircle3: {
    width: width * 0.6,
    height: width * 0.6,
    bottom: width * 0.1,
    left: -width * 0.15,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  logoWrapper: {
    marginBottom: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  logoShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 14,
    borderRadius: 48,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 32,
  },
  titleAr: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  titleFr: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 10,
    textAlign: "center",
  },
  taglineWrap: {
    marginTop: 22,
    alignItems: "center",
  },
  taglinePill: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 100,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  taglineText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  dots: {
    position: "absolute",
    bottom: 56,
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
});
