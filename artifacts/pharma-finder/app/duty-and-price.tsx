import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const DUTY_RED = "#DC3545";
const MAP_BLUE = "#0A7EA4";
const PRICE_AMBER = "#D97706";

export default function DutyAndPriceScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const goToDuty = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/duty-pharmacies");
  };

  const goToDrugPrice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/drug-price");
  };

  const goToMap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/nearest-pharmacy");
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.rowReverse]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={[styles.headerCenter, isRTL && { alignItems: "flex-end" }]}>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
            {isRTL ? "صيدليات المداومة وسعر الدواء" : "Garde & Prix des médicaments"}
          </Text>
          <Text style={[styles.headerSub, isRTL && styles.rtlText]}>
            {isRTL ? "اختر الخدمة المطلوبة" : "Choisissez le service"}
          </Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="hospital-building" size={22} color={DUTY_RED} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.cardsContainer, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Duty Pharmacies ── */}
        <TouchableOpacity style={styles.optionCard} onPress={goToDuty} activeOpacity={0.85}>
          <View style={[styles.cardInner, { borderLeftColor: DUTY_RED, borderLeftWidth: 4 }, isRTL && styles.rowReverse, isRTL && { borderLeftWidth: 0, borderRightColor: DUTY_RED, borderRightWidth: 4 }]}>
            <View style={[styles.cardIconWrap, { backgroundColor: DUTY_RED + "15" }]}>
              <MaterialCommunityIcons name="hospital-building" size={42} color={DUTY_RED} />
            </View>
            <View style={[styles.cardTextWrap, isRTL && { alignItems: "flex-end" }]}>
              <Text style={[styles.cardTitle, { color: DUTY_RED }, isRTL && styles.rtlText]}>
                {isRTL ? "صيدليات المداومة" : "Pharmacies de garde"}
              </Text>
              <Text style={[styles.cardDesc, isRTL && styles.rtlText]}>
                {isRTL
                  ? "اطّلع على جداول المداومة المرفوعة من الإدارة لكل منطقة"
                  : "Consultez les tableaux de garde par région"}
              </Text>
              <View style={[styles.cardArrow, isRTL && styles.rowReverse]}>
                <Text style={[styles.cardArrowText, { color: DUTY_RED }]}>
                  {isRTL ? "عرض الجداول" : "Voir les tableaux"}
                </Text>
                <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color={DUTY_RED} />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Drug Price ── */}
        <TouchableOpacity style={styles.optionCard} onPress={goToDrugPrice} activeOpacity={0.85}>
          <View style={[styles.cardInner, { borderLeftColor: PRICE_AMBER, borderLeftWidth: 4 }, isRTL && styles.rowReverse, isRTL && { borderLeftWidth: 0, borderRightColor: PRICE_AMBER, borderRightWidth: 4 }]}>
            <View style={[styles.cardIconWrap, { backgroundColor: PRICE_AMBER + "15" }]}>
              <MaterialCommunityIcons name="tag-outline" size={42} color={PRICE_AMBER} />
            </View>
            <View style={[styles.cardTextWrap, isRTL && { alignItems: "flex-end" }]}>
              <Text style={[styles.cardTitle, { color: PRICE_AMBER }, isRTL && styles.rtlText]}>
                {isRTL ? "سعر الدواء" : "Prix du médicament"}
              </Text>
              <Text style={[styles.cardDesc, isRTL && styles.rtlText]}>
                {isRTL
                  ? "ابحث في قاعدة بيانات الأسعار المحدّثة من الإدارة"
                  : "Recherchez dans la base de données des prix mise à jour"}
              </Text>
              <View style={[styles.cardArrow, isRTL && styles.rowReverse]}>
                <Text style={[styles.cardArrowText, { color: PRICE_AMBER }]}>
                  {isRTL ? "البحث عن سعر" : "Rechercher un prix"}
                </Text>
                <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color={PRICE_AMBER} />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Pharmacy Map ── */}
        <TouchableOpacity style={styles.optionCard} onPress={goToMap} activeOpacity={0.85}>
          <View style={[styles.cardInner, { borderLeftColor: MAP_BLUE, borderLeftWidth: 4 }, isRTL && styles.rowReverse, isRTL && { borderLeftWidth: 0, borderRightColor: MAP_BLUE, borderRightWidth: 4 }]}>
            <View style={[styles.cardIconWrap, { backgroundColor: MAP_BLUE + "15" }]}>
              <MaterialCommunityIcons name="map-marker-multiple-outline" size={42} color={MAP_BLUE} />
            </View>
            <View style={[styles.cardTextWrap, isRTL && { alignItems: "flex-end" }]}>
              <Text style={[styles.cardTitle, { color: MAP_BLUE }, isRTL && styles.rtlText]}>
                {isRTL ? "خريطة صيدليات نواكشوط" : "Carte des pharmacies"}
              </Text>
              <Text style={[styles.cardDesc, isRTL && styles.rtlText]}>
                {isRTL
                  ? "شاهد مواقع الصيدليات على الخريطة مع روابط غوغل ماب وترتيب حسب المسافة"
                  : "Voyez les pharmacies sur la carte avec liens Google Maps et tri par distance"}
              </Text>
              <View style={[styles.cardArrow, isRTL && styles.rowReverse]}>
                <Text style={[styles.cardArrowText, { color: MAP_BLUE }]}>
                  {isRTL ? "فتح الخريطة" : "Ouvrir la carte"}
                </Text>
                <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color={MAP_BLUE} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  rowReverse: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "flex-start" },
  headerTitle: {
    fontFamily: "Inter_700Bold", fontSize: 16,
    color: Colors.light.text,
  },
  headerSub: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: Colors.light.textSecondary, marginTop: 1,
  },
  headerIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#DC354512",
    alignItems: "center", justifyContent: "center",
  },

  cardsContainer: {
    paddingHorizontal: 18,
    paddingTop: 24,
    gap: 18,
  },

  optionCard: {
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 22,
    gap: 18,
  },
  cardIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTextWrap: {
    flex: 1,
    alignItems: "flex-start",
    gap: 6,
  },
  cardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  cardDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },
  cardArrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  cardArrowText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
});
