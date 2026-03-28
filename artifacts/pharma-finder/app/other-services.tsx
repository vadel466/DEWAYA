import React, { useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, FlatList, ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";

type OtherService = {
  id: string;
  nameAr: string;
  nameFr: string;
  descAr: string | null;
  descFr: string | null;
  icon: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
};

const SERVICES_PURPLE = "#7C3AED";

export default function OtherServicesScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: services = [], isLoading, refetch, isRefetching } = useQuery<OtherService[]>({
    queryKey: ["other-services"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/other-services`);
      if (!res.ok) throw new Error("fetch error");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const renderItem = useCallback(({ item }: { item: OtherService }) => {
    const name = isRTL ? item.nameAr : item.nameFr;
    const desc = isRTL ? item.descAr : item.descFr;
    const color = item.color || SERVICES_PURPLE;
    const lightBg = color + "18";

    return (
      <TouchableOpacity
        style={[styles.serviceCard, { borderLeftColor: color, borderLeftWidth: 4 }]}
        activeOpacity={0.85}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <View style={[styles.iconWrap, { backgroundColor: lightBg }]}>
          <MaterialCommunityIcons name={item.icon as any} size={32} color={color} />
        </View>
        <View style={[styles.cardText, isRTL && { alignItems: "flex-end" }]}>
          <Text style={[styles.cardTitle, { color }, isRTL && styles.rtlText]}>{name}</Text>
          {!!desc && (
            <Text style={[styles.cardDesc, isRTL && styles.rtlText]}>{desc}</Text>
          )}
        </View>
        <Ionicons
          name={isRTL ? "chevron-back" : "chevron-forward"}
          size={18}
          color={color + "80"}
        />
      </TouchableOpacity>
    );
  }, [isRTL]);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={[styles.headerCenter, isRTL && { alignItems: "flex-end" }]}>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
            {isRTL ? "خدمات أخرى" : "Autres services"}
          </Text>
          <Text style={[styles.headerSub, isRTL && styles.rtlText]}>
            {isRTL ? "خدمات إضافية متاحة" : "Services supplémentaires disponibles"}
          </Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: SERVICES_PURPLE + "15" }]}>
          <MaterialCommunityIcons name="view-grid-plus-outline" size={22} color={SERVICES_PURPLE} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={SERVICES_PURPLE} />
        </View>
      ) : services.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="view-grid-plus-outline" size={56} color={Colors.light.border} />
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
            {isRTL ? "لا توجد خدمات متاحة حالياً" : "Aucun service disponible pour le moment"}
          </Text>
          <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
            {isRTL ? "ستظهر الخدمات هنا عند إضافتها من الإدارة" : "Les services apparaîtront ici après ajout par l'admin"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={SERVICES_PURPLE} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.card,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "flex-start" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.text },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  headerIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },

  list: { padding: 16, gap: 14 },

  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 18,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrap: {
    width: 60, height: 60, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  cardText: { flex: 1, alignItems: "flex-start", gap: 4 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  cardDesc: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: Colors.light.textSecondary, lineHeight: 18,
  },

  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 12, paddingHorizontal: 32,
  },
  emptyText: {
    fontFamily: "Inter_600SemiBold", fontSize: 16,
    color: Colors.light.textSecondary, textAlign: "center",
  },
  emptySub: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: Colors.light.textTertiary, textAlign: "center", lineHeight: 19,
  },
});
