import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking,
  TextInput, Platform, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";

type Pharmacy = {
  id: string;
  name: string;
  nameAr: string | null;
  address: string;
  addressAr: string | null;
  phone: string;
  lat: number | null;
  lon: number | null;
  region: string | null;
  isActive: boolean;
  hasPortal?: boolean;
};

export default function PharmacyResultsScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";
  const params = useLocalSearchParams<{ drug?: string }>();
  const drugQuery = params.drug?.trim() ?? "";

  const [allPharmacies, setAllPharmacies]   = useState<Pharmacy[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [search, setSearch]                 = useState("");
  const [error, setError]                   = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchPharmacies = useCallback(async (isRefresh = false) => {
    if (!mountedRef.current) return;
    if (isRefresh) setRefreshing(true);
    else { setLoading(true); setError(false); }

    try {
      const resp = await fetch(`${API_BASE}/pharmacies`, { cache: "no-store" });
      if (!resp.ok) throw new Error("Failed");
      const data: Pharmacy[] = await resp.json();
      if (!mountedRef.current) return;
      setAllPharmacies(data.filter(p => p.isActive));
      setError(false);
    } catch {
      if (mountedRef.current) setError(true);
    } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => { fetchPharmacies(); }, [fetchPharmacies]);

  const filtered = search.trim()
    ? allPharmacies.filter(p => {
        const q = search.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.nameAr ?? "").includes(q) ||
          (p.address ?? "").toLowerCase().includes(q) ||
          (p.addressAr ?? "").includes(q) ||
          (p.region ?? "").toLowerCase().includes(q)
        );
      })
    : allPharmacies;

  const callPharmacy = (phone: string) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const renderCard = ({ item, index }: { item: Pharmacy; index: number }) => (
    <View style={styles.card}>
      {/* Top strip for portal pharmacies */}
      {item.hasPortal && <View style={styles.portalStrip} />}

      <View style={[styles.cardTop, isRTL && styles.rtlRow]}>
        {/* Rank */}
        <View style={styles.rankBubble}>
          <Text style={styles.rankText}>{index + 1}</Text>
        </View>

        {/* Info */}
        <View style={[styles.cardInfo, isRTL && { alignItems: "flex-end" }]}>
          <View style={[styles.nameRow, isRTL && styles.rtlRow]}>
            <Text style={[styles.pharmaName, isRTL && styles.rtlText]} numberOfLines={2}>
              {isRTL && item.nameAr ? item.nameAr : item.name}
            </Text>
            {item.hasPortal && (
              <View style={styles.portalBadge}>
                <MaterialCommunityIcons name="store-check-outline" size={10} color="#1565C0" />
                <Text style={styles.portalBadgeText}>{isRTL ? "بوابة" : "Portail"}</Text>
              </View>
            )}
          </View>
          <View style={[styles.addrRow, isRTL && styles.rtlRow]}>
            <Ionicons name="location-outline" size={12} color={Colors.light.textSecondary} />
            <Text style={[styles.addrText, isRTL && styles.rtlText]} numberOfLines={2}>
              {isRTL && item.addressAr ? item.addressAr : item.address}
            </Text>
          </View>
          {item.region && (
            <View style={[styles.regionChip, isRTL && styles.rtlRow]}>
              <Ionicons name="map" size={10} color={Colors.primary + "99"} />
              <Text style={styles.regionText} numberOfLines={1}>{item.region}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Call button */}
      <TouchableOpacity
        style={[styles.callBtn, isRTL && styles.rtlRow]}
        onPress={() => callPharmacy(item.phone)}
        activeOpacity={0.8}
      >
        <Ionicons name="call" size={15} color={Colors.accent} />
        <Text style={styles.callText}>{item.phone}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>

      {/* ── Header ── */}
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={isRTL ? "chevron-forward" : "chevron-back"}
            size={24}
            color={Colors.light.text}
          />
        </TouchableOpacity>

        <View style={[styles.headerMid, isRTL && { alignItems: "flex-end" }]}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isRTL ? "الصيدليات المسجّلة" : "Pharmacies enregistrées"}
          </Text>
          {drugQuery !== "" && (
            <Text style={styles.headerSub} numberOfLines={1}>
              {isRTL ? `بحث: "${drugQuery}"` : `Recherche: «\u202f${drugQuery}\u202f»`}
            </Text>
          )}
        </View>

        {/* Refresh */}
        <TouchableOpacity
          style={styles.hBtn}
          onPress={() => fetchPharmacies(true)}
          disabled={refreshing || loading}
          activeOpacity={0.8}
        >
          {(loading && !refreshing)
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Ionicons name="refresh" size={19} color={Colors.primary} />}
        </TouchableOpacity>
      </View>

      {/* ── Drug context banner ── */}
      {drugQuery !== "" && (
        <View style={[styles.banner, isRTL && styles.rtlRow]}>
          <MaterialCommunityIcons name="pill" size={15} color="#1565C0" />
          <Text style={[styles.bannerText, isRTL && styles.rtlText]} numberOfLines={2}>
            {isRTL
              ? `تمّ البحث عن «${drugQuery}» — اتصل بأي صيدلية للاستفسار عن توفّره`
              : `Recherche de «\u00a0${drugQuery}\u00a0» — Appelez une pharmacie pour vérifier`}
          </Text>
        </View>
      )}

      {/* ── Search bar ── */}
      <View style={[styles.searchBar, isRTL && styles.rtlRow]}>
        <Ionicons name="search-outline" size={16} color={Colors.light.textTertiary} />
        <TextInput
          style={[styles.searchInput, isRTL && styles.rtlText]}
          placeholder={isRTL ? "فلترة الصيدليات..." : "Filtrer les pharmacies..."}
          placeholderTextColor={Colors.light.textTertiary}
          value={search}
          onChangeText={setSearch}
          textAlign={isRTL ? "right" : "left"}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={Colors.light.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Content ── */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
            {isRTL ? "جارٍ تحميل الصيدليات..." : "Chargement des pharmacies..."}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="wifi-off" size={56} color={Colors.light.textTertiary} />
          <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
            {isRTL ? "تعذّر الاتصال بالخادم" : "Impossible de joindre le serveur"}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPharmacies()} activeOpacity={0.8}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>{isRTL ? "إعادة المحاولة" : "Réessayer"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={[
            styles.list,
            filtered.length === 0 && styles.listEmpty,
            { paddingBottom: (Platform.OS === "web" ? 80 : insets.bottom + 80) },
          ]}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={15}
          initialNumToRender={15}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPharmacies(true)}
              tintColor={Colors.primary}
            />
          }
          ListHeaderComponent={
            filtered.length > 0 ? (
              <View style={[styles.listHeader, isRTL && styles.rtlRow]}>
                <MaterialCommunityIcons name="hospital-building" size={14} color={Colors.primary} />
                <Text style={[styles.listHeaderText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? `${filtered.length} صيدلية مسجّلة`
                    : `${filtered.length} pharmacie(s) enregistrée(s)`}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialCommunityIcons name="store-off-outline" size={60} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                {isRTL ? "لا توجد صيدليات مسجّلة" : "Aucune pharmacie enregistrée"}
              </Text>
              <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
                {isRTL
                  ? "يمكن للصيدليات التسجيل عبر بوابة الصيدليات"
                  : "Les pharmacies peuvent s'inscrire via le portail"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right" },

  /* Header */
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.background,
    gap: 8,
  },
  headerMid: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text },
  headerSub: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#1565C0", marginTop: 2 },
  hBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },

  /* Banner */
  banner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    marginHorizontal: 14, marginTop: 10,
    backgroundColor: "#E3F2FD", borderRadius: 10,
    borderLeftWidth: 3, borderLeftColor: "#1565C0",
    paddingHorizontal: 12, paddingVertical: 10,
  },
  bannerText: {
    flex: 1, fontSize: 12.5, fontFamily: "Inter_500Medium",
    color: "#1565C0", lineHeight: 18,
  },

  /* Search */
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 14, marginTop: 10, marginBottom: 4,
    backgroundColor: Colors.light.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, fontSize: 13.5, fontFamily: "Inter_400Regular",
    color: Colors.light.text, paddingVertical: 0,
  },

  /* List */
  list: { padding: 14, gap: 10 },
  listEmpty: { flex: 1 },
  listHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 6, paddingHorizontal: 2,
  },
  listHeaderText: {
    fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: Colors.primary,
  },

  /* Card */
  card: {
    backgroundColor: Colors.light.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.light.border,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  portalStrip: {
    height: 3, backgroundColor: "#1565C0",
  },
  cardTop: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 12, padding: 14, paddingBottom: 10,
  },
  rankBubble: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary + "15",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  rankText: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.primary },

  cardInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  pharmaName: { fontSize: 14.5, fontFamily: "Inter_700Bold", color: Colors.light.text },
  portalBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#E3F2FD", borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: "#1565C033",
  },
  portalBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#1565C0" },

  addrRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 4 },
  addrText: {
    fontSize: 12.5, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, flex: 1,
  },
  regionChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    marginTop: 4, alignSelf: "flex-start",
    backgroundColor: Colors.primary + "0D", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  regionText: {
    fontSize: 10.5, fontFamily: "Inter_500Medium", color: Colors.primary,
  },

  /* Call button */
  callBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    marginHorizontal: 14, marginBottom: 12,
    backgroundColor: Colors.accent + "12",
    borderRadius: 10, borderWidth: 1, borderColor: Colors.accent + "25",
    paddingVertical: 9, paddingHorizontal: 14,
  },
  callText: {
    fontSize: 13.5, fontFamily: "Inter_600SemiBold",
    color: Colors.accent, flex: 1,
  },

  /* States */
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 12, paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14, fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary, marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15, fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary, textAlign: "center",
  },
  emptySub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary, textAlign: "center", lineHeight: 19,
  },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 20, marginTop: 4,
  },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
