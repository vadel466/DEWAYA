import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

type BrandSize = "xs" | "sm" | "md" | "lg";

interface DewyaBrandProps {
  isRTL?: boolean;
  size?: BrandSize;
  variant?: "badge" | "bar" | "watermark";
}

const SIZE_CONFIG: Record<BrandSize, {
  iconSize: number; arSize: number; frSize: number; sepSize: number;
  padH: number; padV: number; gap: number; radius: number; iconBox: number;
}> = {
  xs: { iconSize: 9,  arSize: 10, frSize: 9,  sepSize: 8,  padH: 8,  padV: 3,  gap: 5,  radius: 8,  iconBox: 18 },
  sm: { iconSize: 11, arSize: 12, frSize: 11, sepSize: 9,  padH: 10, padV: 5,  gap: 6,  radius: 10, iconBox: 22 },
  md: { iconSize: 13, arSize: 15, frSize: 13, sepSize: 10, padH: 14, padV: 7,  gap: 8,  radius: 12, iconBox: 28 },
  lg: { iconSize: 16, arSize: 19, frSize: 15, sepSize: 12, padH: 18, padV: 10, gap: 10, radius: 14, iconBox: 34 },
};

export function DewyaBrand({ isRTL = false, size = "sm", variant = "badge" }: DewyaBrandProps) {
  const c = SIZE_CONFIG[size];

  if (variant === "watermark") {
    return (
      <View style={[styles.watermark, isRTL && styles.rtlRow]}>
        <MaterialCommunityIcons name="pill" size={c.iconSize} color={Colors.primary} />
        <Text style={[styles.watermarkTextAr, { fontSize: c.arSize }]}>أدْواَيَ</Text>
        <Text style={[styles.sep, { fontSize: c.sepSize }]}>·</Text>
        <Text style={[styles.watermarkTextFr, { fontSize: c.frSize }]}>DEWAYA</Text>
      </View>
    );
  }

  if (variant === "bar") {
    return (
      <View style={[styles.bar, { paddingHorizontal: c.padH, paddingVertical: c.padV }]}>
        <View style={[styles.barInner, isRTL && styles.rtlRow]}>
          <View style={[styles.iconBox, { width: c.iconBox, height: c.iconBox, borderRadius: c.iconBox / 2 }]}>
            <MaterialCommunityIcons name="pill" size={c.iconSize} color="#fff" />
          </View>
          <View style={[styles.barTexts, isRTL && styles.rtlRow, { gap: c.gap * 0.5 }]}>
            <Text style={[styles.barAr, { fontSize: c.arSize }]}>أدْواَيَ</Text>
            <Text style={[styles.barSep, { fontSize: c.sepSize }]}>|</Text>
            <Text style={[styles.barFr, { fontSize: c.frSize }]}>DEWAYA</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.badge,
      { paddingHorizontal: c.padH, paddingVertical: c.padV, borderRadius: c.radius, gap: c.gap },
      isRTL && styles.rtlRow,
    ]}>
      <View style={[styles.iconBox, { width: c.iconBox, height: c.iconBox, borderRadius: c.iconBox / 2 }]}>
        <MaterialCommunityIcons name="pill" size={c.iconSize} color="#fff" />
      </View>
      <Text style={[styles.badgeAr, { fontSize: c.arSize }]}>أدْواَيَ</Text>
      <Text style={[styles.badgeSep, { fontSize: c.sepSize }]}>|</Text>
      <Text style={[styles.badgeFr, { fontSize: c.frSize }]}>DEWAYA</Text>
    </View>
  );
}

export function DewyaModalHeader({
  isRTL = false,
  titleAr,
  titleFr,
  subtitleAr,
  subtitleFr,
}: {
  isRTL?: boolean;
  titleAr?: string;
  titleFr?: string;
  subtitleAr?: string;
  subtitleFr?: string;
}) {
  return (
    <View style={styles.modalHeader}>
      <DewyaBrand isRTL={isRTL} size="md" variant="bar" />
      {(titleAr || titleFr) && (
        <Text style={[styles.modalHeaderTitle, isRTL && styles.rtlText]}>
          {isRTL ? titleAr : titleFr}
        </Text>
      )}
      {(subtitleAr || subtitleFr) && (
        <Text style={[styles.modalHeaderSubtitle, isRTL && styles.rtlText]}>
          {isRTL ? subtitleAr : subtitleFr}
        </Text>
      )}
    </View>
  );
}

export function DewyaFooter({ isRTL = false }: { isRTL?: boolean }) {
  return (
    <View style={styles.footer}>
      <DewyaBrand isRTL={isRTL} size="xs" variant="watermark" />
    </View>
  );
}

const styles = StyleSheet.create({
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right" },

  watermark: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, opacity: 0.38,
  },
  watermarkTextAr: {
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  watermarkTextFr: {
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
    letterSpacing: 0.6,
  },
  sep: {
    color: Colors.primary,
    fontFamily: "Inter_500Medium",
    opacity: 0.5,
  },

  bar: {
    backgroundColor: Colors.primary + "0D",
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + "18",
  },
  barInner: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  barTexts: {
    flexDirection: "row", alignItems: "center",
  },
  barAr: {
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  barSep: {
    color: Colors.primary + "50",
    fontFamily: "Inter_400Regular",
    marginHorizontal: 4,
  },
  barFr: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
    letterSpacing: 1,
    opacity: 0.8,
  },

  badge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.primary + "0F",
    borderWidth: 1, borderColor: Colors.primary + "20",
    alignSelf: "center",
  },
  iconBox: {
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  badgeAr: {
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  badgeSep: {
    color: Colors.primary + "50",
    fontFamily: "Inter_400Regular",
    marginHorizontal: 2,
  },
  badgeFr: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
    letterSpacing: 1,
    opacity: 0.8,
  },

  modalHeader: {
    marginBottom: 16, overflow: "hidden",
    borderRadius: 12, borderWidth: 1, borderColor: Colors.primary + "15",
  },
  modalHeaderTitle: {
    fontSize: 17, fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    textAlign: "center", paddingTop: 12, paddingHorizontal: 16,
  },
  modalHeaderSubtitle: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center", paddingBottom: 12, paddingHorizontal: 16, lineHeight: 19,
  },

  footer: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.light.border,
    alignItems: "center",
  },
});
