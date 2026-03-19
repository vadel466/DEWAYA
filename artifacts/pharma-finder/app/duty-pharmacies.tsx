import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Image,
  Alert,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { DUTY_REGIONS, type DutyRegion } from "@/constants/duty-regions";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DUTY_RED = "#DC3545";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

type DutyImage = {
  id: string;
  region: string;
  imageData: string;
  mimeType: string;
  caption: string | null;
  uploadedAt: string;
};

export default function DutyPharmaciesScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";
  const [selectedRegion, setSelectedRegion] = useState<DutyRegion | null>(null);

  const { data: images = [], isLoading, refetch } = useQuery<DutyImage[]>({
    queryKey: ["duty-images", selectedRegion?.id],
    queryFn: async () => {
      if (!selectedRegion) return [];
      const r = await fetch(`${API_BASE}/duty-images/${selectedRegion.id}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedRegion,
  });

  const selectRegion = useCallback((r: DutyRegion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedRegion(r);
  }, []);

  const goBack = () => {
    if (selectedRegion) {
      setSelectedRegion(null);
    } else {
      router.back();
    }
  };

  const regionLabel = (r: DutyRegion) => language === "ar" ? r.ar : r.fr;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <View style={[styles.headerTitleWrap, isRTL && { alignItems: "flex-end" }]}>
          <Text style={styles.headerTitle}>
            {selectedRegion ? regionLabel(selectedRegion) : (isRTL ? "صيدليات المداومة" : "Pharmacies de Garde")}
          </Text>
          {!selectedRegion && (
            <Text style={styles.headerSub}>
              {isRTL ? "اختر منطقتك لعرض الصيدليات" : "Choisissez votre région"}
            </Text>
          )}
        </View>
        <View style={styles.dutyIconWrap}>
          <MaterialCommunityIcons name="hospital-building" size={22} color={DUTY_RED} />
        </View>
      </View>

      {/* Region grid */}
      {!selectedRegion ? (
        <ScrollView
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? "اختر منطقتك" : "Sélectionnez votre région"}
          </Text>
          <View style={styles.regionsGrid}>
            {DUTY_REGIONS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.regionCard}
                onPress={() => selectRegion(r)}
                activeOpacity={0.8}
              >
                <View style={styles.regionIconWrap}>
                  <MaterialCommunityIcons name="hospital-building" size={28} color={DUTY_RED} />
                </View>
                <Text style={[styles.regionName, isRTL && styles.rtlText]} numberOfLines={2}>
                  {language === "ar" ? r.ar : r.fr}
                </Text>
                <Ionicons
                  name={isRTL ? "chevron-back" : "chevron-forward"}
                  size={16}
                  color={Colors.light.textTertiary}
                  style={styles.regionArrow}
                />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* Image viewer for selected region */
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={DUTY_RED} />
              <Text style={styles.loadingText}>
                {isRTL ? "جاري التحميل..." : "Chargement..."}
              </Text>
            </View>
          ) : images.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="image-off-outline" size={72} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                {isRTL ? "لا توجد صور متاحة لهذه المنطقة" : "Aucune image disponible pour cette région"}
              </Text>
              <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
                {isRTL ? "ستُضاف قوائم الصيدليات المداومة قريباً" : "Les listes de garde seront ajoutées prochainement"}
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
                <Ionicons name="refresh" size={16} color={DUTY_RED} />
                <Text style={styles.retryText}>{isRTL ? "إعادة التحميل" : "Actualiser"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={images}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.imageCard}>
                  <Image
                    source={{ uri: `data:${item.mimeType};base64,${item.imageData}` }}
                    style={styles.dutyImage}
                    resizeMode="contain"
                  />
                  {item.caption ? (
                    <View style={styles.captionRow}>
                      <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
                      <Text style={[styles.captionText, isRTL && styles.rtlText]}>{item.caption}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.uploadedAt}>
                    {new Date(item.uploadedAt).toLocaleDateString(
                      language === "ar" ? "ar-SA" : "fr-FR",
                      { day: "numeric", month: "long", year: "numeric" }
                    )}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerTitleWrap: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  dutyIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#DC354518", alignItems: "center", justifyContent: "center",
  },

  grid: { padding: 16 },
  sectionTitle: {
    fontSize: 16, fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    marginBottom: 16, textAlign: "center",
  },
  regionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  regionCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: DUTY_RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#DC354520",
    alignItems: "center",
  },
  regionIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#DC354514",
    alignItems: "center", justifyContent: "center",
    marginBottom: 10,
  },
  regionName: {
    fontSize: 14, fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    textAlign: "center", lineHeight: 20,
  },
  regionNameSub: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
    textAlign: "center", marginTop: 3,
  },
  regionArrow: { marginTop: 8 },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },

  emptyState: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 60, gap: 14, paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16, fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary, textAlign: "center",
  },
  emptySub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary, textAlign: "center", lineHeight: 20,
  },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: DUTY_RED,
    marginTop: 8,
  },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: DUTY_RED },

  imageCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  dutyImage: {
    width: "100%",
    height: SCREEN_WIDTH - 32,
    backgroundColor: Colors.light.inputBackground,
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  captionText: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary, flex: 1,
  },
  uploadedAt: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4,
  },
});
