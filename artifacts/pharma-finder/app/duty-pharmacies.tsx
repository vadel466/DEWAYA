import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DUTY_RED = "#DC3545";

type DutyPharmacy = {
  id: string;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  region: string;
  date: string;
  scheduleText: string | null;
  notes: string | null;
  isActive: boolean;
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string, lang: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function DutyPharmaciesScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, region } = useApp();
  const isRTL = language === "ar";

  const [duties, setDuties] = useState<DutyPharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const today = todayStr();
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const fetchDuties = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (region?.id) params.append("region", region.id);
      const resp = await fetch(`${API_BASE}/duty-pharmacies?${params}`);
      if (resp.ok) {
        setDuties(await resp.json());
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDuties();
  }, [selectedDate, region]);

  const callPharmacy = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${phone}`);
  };

  const openMaps = (address: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const query = encodeURIComponent(address + ", Mauritanie");
    const url = Platform.OS === "ios"
      ? `maps:?q=${query}`
      : `https://maps.google.com/?q=${query}`;
    Linking.openURL(url);
  };

  const renderItem = ({ item }: { item: DutyPharmacy }) => (
    <View style={styles.card}>
      <View style={[styles.cardHeader, isRTL && styles.rtlRow]}>
        <View style={styles.dutyBadge}>
          <MaterialCommunityIcons name="hospital-building" size={20} color={DUTY_RED} />
        </View>
        <View style={[styles.cardHeaderInfo, isRTL && { alignItems: "flex-end" }]}>
          <Text style={[styles.pharmacyName, isRTL && styles.rtlText]}>{item.pharmacyName}</Text>
          <View style={[styles.addressRow, isRTL && styles.rtlRow]}>
            <Ionicons name="location-outline" size={13} color={Colors.light.textSecondary} />
            <Text style={[styles.addressText, isRTL && styles.rtlText]}>{item.pharmacyAddress}</Text>
          </View>
        </View>
      </View>

      {item.scheduleText ? (
        <View style={styles.scheduleBox}>
          <Ionicons name="time-outline" size={14} color={Colors.primary} />
          <Text style={[styles.scheduleText, isRTL && styles.rtlText]}>{item.scheduleText}</Text>
        </View>
      ) : null}

      {item.notes ? (
        <Text style={[styles.notes, isRTL && styles.rtlText]}>{item.notes}</Text>
      ) : null}

      <View style={[styles.cardActions, isRTL && styles.rtlRow]}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: Colors.accent + "15", borderColor: Colors.accent + "40" }]}
          onPress={() => callPharmacy(item.pharmacyPhone)}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={16} color={Colors.accent} />
          <Text style={[styles.actionBtnText, { color: Colors.accent }]}>{item.pharmacyPhone}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: Colors.primary + "10", borderColor: Colors.primary + "30" }]}
          onPress={() => openMaps(item.pharmacyAddress)}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate" size={16} color={Colors.primary} />
          <Text style={[styles.actionBtnText, { color: Colors.primary }]}>
            {isRTL ? "الاتجاهات" : "Itinéraire"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <View style={[styles.headerTitleWrap, isRTL && { alignItems: "flex-end" }]}>
          <Text style={styles.headerTitle}>{t("dutyPharmacies")}</Text>
          {region && (
            <Text style={styles.headerSub}>
              {language === "ar" ? region.ar : region.fr}
            </Text>
          )}
        </View>
        <View style={styles.dutyIconWrap}>
          <MaterialCommunityIcons name="hospital-building" size={22} color={DUTY_RED} />
        </View>
      </View>

      {/* Date selector */}
      <View style={styles.datePicker}>
        <FlatList
          horizontal
          data={dates}
          keyExtractor={(d) => d}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item: d }) => {
            const isSelected = d === selectedDate;
            const isToday = d === today;
            const dayLabel = new Date(d + "T00:00:00").toLocaleDateString(
              language === "ar" ? "ar-SA" : "fr-FR",
              { weekday: "short" }
            );
            const dayNum = new Date(d + "T00:00:00").getDate();
            return (
              <TouchableOpacity
                style={[styles.dateChip, isSelected && styles.dateChipActive]}
                onPress={() => {
                  setSelectedDate(d);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.dateChipDay, isSelected && styles.dateChipTextActive]}>{dayLabel}</Text>
                <Text style={[styles.dateChipNum, isSelected && styles.dateChipTextActive]}>{dayNum}</Text>
                {isToday && <View style={[styles.todayDot, isSelected && { backgroundColor: "#fff" }]} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <Text style={[styles.dateLabel, isRTL && styles.rtlText]}>
        {formatDate(selectedDate, language)}
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={DUTY_RED} />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      ) : (
        <FlatList
          data={duties}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            duties.length === 0 && styles.emptyList,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchDuties(true)}
              tintColor={DUTY_RED}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="hospital-building" size={64} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                {isRTL
                  ? "لا توجد صيدليات مداومة لهذا اليوم"
                  : "Aucune pharmacie de garde pour cette date"}
              </Text>
              <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
                {isRTL
                  ? "جرب تحديد منطقتك أو تاريخ آخر"
                  : "Essayez de sélectionner votre région ou une autre date"}
              </Text>
            </View>
          }
        />
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

  datePicker: { paddingVertical: 12 },
  dateChip: {
    width: 56, alignItems: "center", paddingVertical: 8,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
  },
  dateChipActive: { backgroundColor: DUTY_RED, borderColor: DUTY_RED },
  dateChipDay: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  dateChipNum: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text, marginTop: 2 },
  dateChipTextActive: { color: "#fff" },
  todayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: DUTY_RED, marginTop: 3 },

  dateLabel: {
    fontSize: 14, fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary, marginHorizontal: 20, marginBottom: 8,
  },

  list: { padding: 16, gap: 12 },
  emptyList: { flex: 1 },

  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#DC354520",
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  dutyBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#DC354514", alignItems: "center", justifyContent: "center",
  },
  cardHeaderInfo: { flex: 1 },
  pharmacyName: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.light.text },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  addressText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, flex: 1 },

  scheduleBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary + "0D", borderRadius: 10,
    padding: 10, marginBottom: 10,
  },
  scheduleText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary, flex: 1 },
  notes: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginBottom: 12, lineHeight: 19 },

  cardActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center", lineHeight: 19 },
});
