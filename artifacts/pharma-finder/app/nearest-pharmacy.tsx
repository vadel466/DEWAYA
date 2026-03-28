/**
 * NearestPharmacyScreen
 * ──────────────────────
 * Flow: mount → request location → fetch sorted pharmacies from API → show list
 * Fallback: AsyncStorage cached list (sorted client-side with Haversine)
 * No heavy hooks, no stale closures, no react-native-maps.
 */
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking,
  RefreshControl, Platform, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";

const PHARM_CACHE_KEY = "@dewaya_pharmacies_v2";

type Phase = "locating" | "fetching" | "done" | "denied" | "error";

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
  distance?: number | null;
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dO = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dL / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180)
    * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number | null | undefined, lang: string): string {
  if (km == null || km >= 9999) return "";
  if (km < 1) return `${Math.round(km * 1000)} ${lang === "ar" ? "م" : "m"}`;
  return `${km.toFixed(1)} ${lang === "ar" ? "كم" : "km"}`;
}

function sortByDist(list: Pharmacy[], lat: number | null, lon: number | null): Pharmacy[] {
  return list
    .map(p => ({
      ...p,
      distance: (lat && lon && p.lat && p.lon)
        ? haversine(lat, lon, p.lat, p.lon)
        : null,
    }))
    .sort((a, b) => {
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
}

export default function NearestPharmacyScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, region } = useApp();
  const isRTL = language === "ar";

  const [phase, setPhase]           = useState<Phase>("locating");
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userLat, setUserLat]       = useState<number | null>(null);
  const [userLon, setUserLon]       = useState<number | null>(null);
  const [fromCache, setFromCache]   = useState(false);

  const mountedRef = useRef(true);
  const abortRef   = useRef<AbortController | null>(null);
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const pulseRef   = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      pulseRef.current?.stop();
    };
  }, []);

  /* ── Pulse animation for loading ── */
  useEffect(() => {
    pulseRef.current?.stop();
    if (phase === "locating" || phase === "fetching") {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ]),
      );
      pulseRef.current.start();
    } else {
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [phase]);

  /* ── Core: fetch pharmacies ── */
  const loadPharmacies = async (lat: number | null, lon: number | null, isRefresh = false) => {
    if (!mountedRef.current) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (isRefresh) setRefreshing(true);
    else setPhase("fetching");

    try {
      const params = new URLSearchParams();
      if (lat != null) params.set("lat", String(lat));
      if (lon != null) params.set("lon", String(lon));
      if (region?.id) params.set("region", region.id);

      const resp = await fetch(`${API_BASE}/pharmacies/nearest?${params}`, {
        signal: ctrl.signal,
        cache: "no-store",
      });

      if (ctrl.signal.aborted || !mountedRef.current) return;

      if (resp.ok) {
        const data: Pharmacy[] = await resp.json();
        if (!ctrl.signal.aborted && mountedRef.current) {
          setPharmacies(data);
          setFromCache(false);
          if (mountedRef.current) setPhase("done");
        }
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || !mountedRef.current) return;
    }

    /* API failed — load from AsyncStorage cache */
    try {
      const raw = await AsyncStorage.getItem(PHARM_CACHE_KEY);
      if (!mountedRef.current) return;
      if (raw) {
        const cached: Pharmacy[] = JSON.parse(raw);
        const sorted = sortByDist(
          region?.id ? cached.filter(p => !p.region || p.region === region.id) : cached,
          lat, lon,
        );
        if (mountedRef.current) {
          setPharmacies(sorted);
          setFromCache(true);
        }
      }
    } catch { /* silent */ }

    if (mountedRef.current) {
      setPhase("done");
      if (isRefresh) setRefreshing(false);
    }
  };

  /* ── Geolocation flow ── */
  const detectAndLoad = async (isRefresh = false) => {
    if (!mountedRef.current) return;
    if (!isRefresh) setPhase("locating");

    if (Platform.OS === "web") {
      if (!("geolocation" in navigator)) {
        await loadPharmacies(null, null, isRefresh);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          if (mountedRef.current) { setUserLat(lat); setUserLon(lon); }
          await loadPharmacies(lat, lon, isRefresh);
        },
        async () => { await loadPharmacies(null, null, isRefresh); },
        { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false },
      );
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { /* haptics optional */ }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mountedRef.current) return;

      if (status !== "granted") {
        if (mountedRef.current) setPhase("denied");
        await loadPharmacies(null, null, isRefresh);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!mountedRef.current) return;

      const { latitude, longitude } = loc.coords;
      setUserLat(latitude);
      setUserLon(longitude);

      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      await loadPharmacies(latitude, longitude, isRefresh);

    } catch {
      if (!mountedRef.current) return;
      await loadPharmacies(null, null, isRefresh);
    }
  };

  /* ── Mount: start the full flow ── */
  useEffect(() => {
    detectAndLoad();
  }, []);

  /* ── Actions ── */
  const handleRefresh = () => detectAndLoad(true);

  const openGoogleMaps = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const url = userLat && userLon
      ? `https://www.google.com/maps/search/pharmacies/@${userLat},${userLon},14z`
      : "https://www.google.com/maps/search/pharmacies+nouakchott/";
    Linking.openURL(url).catch(() => {});
  };

  const callPharmacy = (phone: string) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const openMaps = (item: Pharmacy) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    const nameEnc = encodeURIComponent(item.nameAr || item.name);
    let url: string;

    if (item.lat && item.lon) {
      url = Platform.OS === "ios"
        ? `maps:?ll=${item.lat},${item.lon}&q=${nameEnc}`
        : `geo:${item.lat},${item.lon}?q=${item.lat},${item.lon}(${nameEnc})`;
    } else {
      const addrEnc = encodeURIComponent((item.addressAr || item.address) + ", Mauritanie");
      url = Platform.OS === "ios"
        ? `maps:?q=${addrEnc}`
        : `geo:0,0?q=${addrEnc}`;
    }

    Linking.canOpenURL(url)
      .then(can => {
        if (can) return Linking.openURL(url);
        const fallback = item.lat && item.lon
          ? `https://www.google.com/maps?q=${item.lat},${item.lon}`
          : `https://www.google.com/maps/search/${encodeURIComponent(item.address)}`;
        return Linking.openURL(fallback);
      })
      .catch(() => {});
  };

  /* ── Card ── */
  const renderCard = ({ item, index }: { item: Pharmacy; index: number }) => {
    const isFirst = index === 0;
    const hasDist = item.distance != null && item.distance < 9999;
    return (
      <View style={[styles.card, isFirst && styles.cardFirst]}>
        <View style={[styles.cardTop, isRTL && styles.rtlRow]}>
          <View style={[styles.rankBadge, isFirst && styles.rankFirst]}>
            <Text style={[styles.rankText, isFirst && styles.rankTextFirst]}>{index + 1}</Text>
          </View>

          <View style={[styles.cardInfo, isRTL && { alignItems: "flex-end" }]}>
            <Text style={[styles.pharmaName, isRTL && styles.rtlText]} numberOfLines={2}>
              {isRTL && item.nameAr ? item.nameAr : item.name}
            </Text>
            <View style={[styles.addrRow, isRTL && styles.rtlRow]}>
              <Ionicons name="location-outline" size={13} color={Colors.light.textSecondary} />
              <Text style={[styles.addrText, isRTL && styles.rtlText]} numberOfLines={2}>
                {isRTL && item.addressAr ? item.addressAr : item.address}
              </Text>
            </View>
          </View>

          {hasDist && (
            <View style={[styles.distBadge, isFirst && styles.distBadgeFirst]}>
              <Ionicons name="navigate" size={11} color={isFirst ? "#fff" : Colors.primary} />
              <Text style={[styles.distText, isFirst && styles.distTextFirst]}>
                {formatDist(item.distance, language)}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.actions, isRTL && styles.rtlRow]}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: Colors.accent + "15", borderColor: Colors.accent + "30" }]}
            onPress={() => callPharmacy(item.phone)}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={16} color={Colors.accent} />
            <Text style={[styles.btnText, { color: Colors.accent }]}>{item.phone}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: Colors.primary + "10", borderColor: Colors.primary + "25" }]}
            onPress={() => openMaps(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={16} color={Colors.primary} />
            <Text style={[styles.btnText, { color: Colors.primary }]}>{t("directionsLabel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const isLoading = phase === "locating" || phase === "fetching";

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
          <Text style={styles.headerTitle}>{t("nearestPharmacy")}</Text>
          {region && (
            <Text style={styles.headerSub}>
              {language === "ar" ? region.ar : region.fr}
            </Text>
          )}
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.hBtn} onPress={openGoogleMaps} activeOpacity={0.8}>
            <MaterialCommunityIcons name="google-maps" size={20} color="#34A853" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.hBtn, isLoading && styles.hBtnDisabled]}
            onPress={() => detectAndLoad()}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Ionicons name="locate" size={20} color={Colors.primary} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Location found banner ── */}
      {userLat && phase === "done" && (
        <View style={[styles.banner, styles.bannerGreen, isRTL && styles.rtlRow]}>
          <Ionicons name="checkmark-circle" size={15} color={Colors.primary} />
          <Text style={[styles.bannerText, { color: Colors.primary }]}>
            {t("locationDetectedLabel")}
          </Text>
        </View>
      )}

      {/* ── Permission denied banner ── */}
      {phase === "denied" && (
        <View style={[styles.banner, styles.bannerRed, isRTL && styles.rtlRow]}>
          <Ionicons name="warning" size={15} color="#DC2626" />
          <Text style={[styles.bannerText, { color: "#991B1B", flex: 1 }, isRTL && styles.rtlText]}>
            {isRTL
              ? "لم يُمنح إذن الموقع — القائمة بدون ترتيب بالقرب"
              : "Localisation refusée — liste non triée"}
          </Text>
          <TouchableOpacity onPress={() => Linking.openSettings().catch(() => {})}>
            <Text style={styles.settingsLink}>
              {isRTL ? "الإعدادات" : "Paramètres"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Offline cache banner ── */}
      {fromCache && phase === "done" && (
        <View style={[styles.banner, styles.bannerPurple, isRTL && styles.rtlRow]}>
          <MaterialCommunityIcons name="cloud-off-outline" size={13} color="#7C3AED" />
          <Text style={[styles.bannerText, { color: "#4C1D95" }, isRTL && styles.rtlText]}>
            {isRTL ? "بيانات محلية • وزارة الصحة" : "Données locales • Ministère de la Santé"}
          </Text>
        </View>
      )}

      {/* ── Loading ── */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <Animated.View
            style={[styles.loadingCircle, { transform: [{ scale: pulseAnim }] }]}
          >
            <MaterialCommunityIcons
              name={phase === "locating" ? "crosshairs-gps" : "map-marker-multiple"}
              size={48}
              color={Colors.primary}
            />
          </Animated.View>
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
          <Text style={styles.loadingTitle}>
            {phase === "locating"
              ? (isRTL ? "جارٍ تحديد موقعك..." : "Localisation en cours...")
              : (isRTL ? "جارٍ البحث عن أقرب صيدلية..." : "Recherche des pharmacies...")}
          </Text>
          <Text style={styles.loadingSub}>
            {isRTL ? "يرجى الانتظار لحظة..." : "Veuillez patienter..."}
          </Text>
        </View>
      ) : (
        /* ── Pharmacy list ── */
        <FlatList
          data={pharmacies}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={[
            styles.list,
            pharmacies.length === 0 && styles.listEmpty,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListHeaderComponent={
            pharmacies.length > 0 ? (
              <View style={[styles.listHeader, isRTL && styles.rtlRow]}>
                <MaterialCommunityIcons name="map-marker-multiple" size={15} color={Colors.primary} />
                <Text style={[styles.listHeaderText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? `${pharmacies.length} صيدلية${userLat ? " — مرتّبة من الأقرب" : ""}`
                    : `${pharmacies.length} pharmacies${userLat ? " — triées par distance" : ""}`}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons
                name="map-marker-remove"
                size={64}
                color={Colors.light.textTertiary}
              />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                {t("noPharmaciesRegion")}
              </Text>
              <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
                {t("contactToAdd")}
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => detectAndLoad()}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={styles.retryText}>
                  {isRTL ? "إعادة المحاولة" : "Réessayer"}
                </Text>
              </TouchableOpacity>
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
  },
  headerMid: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.light.text },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  hBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  hBtnDisabled: { opacity: 0.5 },

  /* Banners */
  banner: {
    flexDirection: "row", alignItems: "center", gap: 7,
    marginHorizontal: 16, marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    borderLeftWidth: 3,
  },
  bannerGreen: { backgroundColor: Colors.primary + "0D", borderLeftColor: Colors.primary },
  bannerRed:   { backgroundColor: "#FEF2F2", borderLeftColor: "#DC2626" },
  bannerPurple:{ backgroundColor: "#F5F3FF", borderLeftColor: "#7C3AED" },
  bannerText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  settingsLink: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#DC2626", textDecorationLine: "underline" },

  /* Loading */
  loadingBox: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 4,
  },
  loadingCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  loadingTitle: {
    marginTop: 12, fontSize: 16, fontFamily: "Inter_600SemiBold",
    color: Colors.light.text, textAlign: "center",
  },
  loadingSub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, textAlign: "center", marginTop: 4,
  },

  /* List */
  list: { padding: 16, gap: 12 },
  listEmpty: { flex: 1 },
  listHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 8, paddingHorizontal: 2,
  },
  listHeaderText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary },

  /* Cards */
  card: {
    backgroundColor: Colors.light.card, borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  cardFirst: {
    borderColor: Colors.primary + "45",
    shadowColor: Colors.primary, shadowOpacity: 0.12, elevation: 5,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },

  rankBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + "18",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  rankFirst: { backgroundColor: Colors.primary },
  rankText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.primary },
  rankTextFirst: { color: "#fff" },

  cardInfo: { flex: 1 },
  pharmaName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text },
  addrRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 4 },
  addrText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, flex: 1 },

  distBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.primary + "10",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0,
  },
  distBadgeFirst: { backgroundColor: Colors.primary },
  distText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  distTextFirst: { color: "#fff" },

  actions: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  btnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  /* Empty */
  emptyBox: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 60, gap: 12, paddingHorizontal: 32,
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
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 8,
  },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
