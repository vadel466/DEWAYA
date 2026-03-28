import React, { useState, useEffect, useCallback, useRef } from "react";
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
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineCache, haversineKm, type CachedPharmacy } from "@/hooks/useOfflineCache";

const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";

const MAURITANIA_LAT_MIN = 14, MAURITANIA_LAT_MAX = 26;
const MAURITANIA_LON_MIN = -21, MAURITANIA_LON_MAX = -4;

type Phase = "locating" | "fetching" | "done" | "denied";
type NearestPharmacy = CachedPharmacy & { distance: number | null };

function formatDistance(km: number | null, lang: string): string {
  if (km === null || km === undefined || km >= 9999) return "";
  if (km < 1) return `${Math.round(km * 1000)} ${lang === "ar" ? "م" : "m"}`;
  return `${km.toFixed(1)} ${lang === "ar" ? "كم" : "km"}`;
}

function isValidCoord(lat: number | null, lon: number | null) {
  if (!lat || !lon) return false;
  return lat >= MAURITANIA_LAT_MIN && lat <= MAURITANIA_LAT_MAX
    && lon >= MAURITANIA_LON_MIN && lon <= MAURITANIA_LON_MAX;
}

function sortByDistance(
  list: CachedPharmacy[],
  userLat: number | null,
  userLon: number | null,
  regionId: string | null,
): NearestPharmacy[] {
  const filtered = regionId
    ? list.filter(p => !p.region || p.region === regionId)
    : list;

  return filtered
    .map(p => ({
      ...p,
      distance:
        userLat && userLon && p.lat && p.lon
          ? haversineKm(userLat, userLon, p.lat, p.lon)
          : null,
    }))
    .sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
}

export default function NearestPharmacyScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, region } = useApp();
  const isRTL = language === "ar";
  const { isOnline } = useNetworkStatus();
  const { pharmacies: cachedPharmacies, syncPharmacies } = useOfflineCache();

  const [pharmacies, setPharmacies] = useState<NearestPharmacy[]>([]);
  const [phase, setPhase]           = useState<Phase>("locating");
  const [refreshing, setRefreshing] = useState(false);
  const [userLat, setUserLat]       = useState<number | null>(null);
  const [userLon, setUserLon]       = useState<number | null>(null);
  const [fromCache, setFromCache]   = useState(false);

  const mountedRef    = useRef(true);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const pulseAnim     = useRef(new Animated.Value(1)).current;

  /* ── Pulsing animation for loading icon ── */
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ]),
    );
    if (phase === "locating" || phase === "fetching") loop.start();
    else loop.stop();
    return () => loop.stop();
  }, [phase]);

  /* ── Fetch from API ── */
  const fetchOnline = useCallback(async (lat?: number, lon?: number, isRefresh = false) => {
    if (!mountedRef.current) return;
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    if (isRefresh) setRefreshing(true);
    else setPhase("fetching");

    try {
      const params = new URLSearchParams();
      if (lat !== undefined && lon !== undefined) {
        params.set("lat", String(lat));
        params.set("lon", String(lon));
      }
      if (region?.id) params.set("region", region.id);

      const resp = await fetch(`${API_BASE}/pharmacies/nearest?${params}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || !mountedRef.current) return;

      if (resp.ok) {
        const data: NearestPharmacy[] = await resp.json();
        if (!controller.signal.aborted && mountedRef.current) {
          setPharmacies(data);
          setFromCache(false);
        }
      } else {
        throw new Error("API error");
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || !mountedRef.current) return;
      if (cachedPharmacies.length > 0) {
        setPharmacies(sortByDistance(cachedPharmacies, lat ?? null, lon ?? null, region?.id ?? null));
        setFromCache(true);
      }
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setPhase("done");
        setRefreshing(false);
      }
    }
  }, [region, cachedPharmacies]);

  /* ── Fetch from local cache ── */
  const fetchOffline = useCallback((lat?: number, lon?: number) => {
    setPhase("fetching");
    const sorted = sortByDistance(cachedPharmacies, lat ?? null, lon ?? null, region?.id ?? null);
    setPharmacies(sorted);
    setFromCache(true);
    setPhase("done");
  }, [cachedPharmacies, region]);

  /* ── Re-sort in memory when location changes ── */
  const applyLocalSort = useCallback((lat: number, lon: number) => {
    setPharmacies(prev =>
      prev
        .map(p => ({
          ...p,
          distance: p.lat && p.lon ? haversineKm(lat, lon, p.lat, p.lon) : null,
        }))
        .sort((a, b) => {
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        }),
    );
  }, []);

  /* ── Detect location ── */
  const detectLocation = useCallback(async () => {
    if (!mountedRef.current) return;
    setPhase("locating");

    if (Platform.OS === "web") {
      if (!("geolocation" in navigator)) {
        if (isOnline) fetchOnline(); else fetchOffline();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude: lat, longitude: lon } = pos.coords;
          if (mountedRef.current) { setUserLat(lat); setUserLon(lon); }
          if (isOnline) await fetchOnline(lat, lon);
          else fetchOffline(lat, lon);
        },
        () => { if (isOnline) fetchOnline(); else fetchOffline(); },
        { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false },
      );
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mountedRef.current) return;

      if (status !== "granted") {
        setPhase("denied");
        /* Still show pharmacies (unsorted) */
        if (isOnline) await fetchOnline();
        else fetchOffline();
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!mountedRef.current) return;

      const { latitude: lat, longitude: lon } = loc.coords;
      setUserLat(lat);
      setUserLon(lon);

      if (isOnline) await fetchOnline(lat, lon);
      else fetchOffline(lat, lon);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      if (mountedRef.current) {
        if (isOnline) fetchOnline(); else fetchOffline();
      }
    }
  }, [isOnline, fetchOnline, fetchOffline]);

  /* ── Mount ── */
  useEffect(() => {
    mountedRef.current = true;
    if (isOnline) syncPharmacies().catch(() => {});
    detectLocation();
    return () => {
      mountedRef.current = false;
      fetchAbortRef.current?.abort();
    };
  }, []);

  /* ── Re-sort when location arrives ── */
  useEffect(() => {
    if (userLat && userLon && pharmacies.length > 0) {
      applyLocalSort(userLat, userLon);
    }
  }, [userLat, userLon]);

  /* ── Open Google Maps for all pharmacies ── */
  const openGoogleMaps = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = userLat && userLon
      ? `https://www.google.com/maps/search/pharmacies/@${userLat},${userLon},14z`
      : `https://www.google.com/maps/search/pharmacies+nouakchott/`;
    Linking.openURL(url);
  };

  /* ── Call pharmacy ── */
  const callPharmacy = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${phone}`);
  };

  /* ── Open navigation for a single pharmacy ── */
  const openMaps = (item: NearestPharmacy) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nameEnc = encodeURIComponent(item.nameAr || item.name);
    const addrEnc = encodeURIComponent((item.addressAr || item.address) + ", Mauritanie");
    let primary: string;
    let fallback: string;

    if (item.lat && item.lon) {
      if (Platform.OS === "ios") {
        primary  = `maps:?ll=${item.lat},${item.lon}&q=${nameEnc}`;
        fallback = `https://maps.apple.com/?ll=${item.lat},${item.lon}&q=${nameEnc}`;
      } else if (Platform.OS === "android") {
        primary  = `geo:${item.lat},${item.lon}?q=${item.lat},${item.lon}(${nameEnc})`;
        fallback = `https://maps.google.com/maps?q=${item.lat},${item.lon}`;
      } else {
        primary  = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`;
        fallback = primary;
      }
    } else {
      if (Platform.OS === "ios") {
        primary  = `maps:?q=${addrEnc}`;
        fallback = `https://maps.apple.com/?q=${addrEnc}`;
      } else if (Platform.OS === "android") {
        primary  = `geo:0,0?q=${addrEnc}`;
        fallback = `https://maps.google.com/maps?q=${addrEnc}`;
      } else {
        primary  = `https://www.google.com/maps/search/?api=1&query=${addrEnc}`;
        fallback = primary;
      }
    }

    Linking.canOpenURL(primary)
      .then(can => Linking.openURL(can ? primary : fallback))
      .catch(() => Linking.openURL(fallback));
  };

  /* ── Pharmacy card ── */
  const renderItem = ({ item, index }: { item: NearestPharmacy; index: number }) => {
    const isFirst = index === 0;
    const hasDistance = item.distance !== null && item.distance !== undefined && item.distance < 9999;
    return (
      <View style={[styles.card, isFirst && styles.cardFirst]}>
        <View style={[styles.cardHeader, isRTL && styles.rtlRow]}>
          <View style={[styles.rankBadge, isFirst && styles.rankBadgeFirst]}>
            <Text style={[styles.rankText, isFirst && styles.rankTextFirst]}>{index + 1}</Text>
          </View>

          <View style={[styles.cardInfo, isRTL && { alignItems: "flex-end" }]}>
            <Text style={[styles.pharmaName, isRTL && styles.rtlText]} numberOfLines={2}>
              {isRTL && item.nameAr ? item.nameAr : item.name}
            </Text>
            <View style={[styles.addressRow, isRTL && styles.rtlRow]}>
              <Ionicons name="location-outline" size={13} color={Colors.light.textSecondary} />
              <Text style={[styles.addressText, isRTL && styles.rtlText]} numberOfLines={2}>
                {isRTL && item.addressAr ? item.addressAr : item.address}
              </Text>
            </View>
          </View>

          {hasDistance && (
            <View style={[styles.distanceBadge, isFirst && styles.distanceBadgeFirst]}>
              <Ionicons name="navigate" size={11} color={isFirst ? "#fff" : Colors.primary} />
              <Text style={[styles.distanceText, isFirst && styles.distanceTextFirst]}>
                {formatDistance(item.distance, language)}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.cardActions, isRTL && styles.rtlRow]}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.accent + "15", borderColor: Colors.accent + "35" }]}
            onPress={() => callPharmacy(item.phone)}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={16} color={Colors.accent} />
            <Text style={[styles.actionBtnText, { color: Colors.accent }]}>{item.phone}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.primary + "10", borderColor: Colors.primary + "30" }]}
            onPress={() => openMaps(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={16} color={Colors.primary} />
            <Text style={[styles.actionBtnText, { color: Colors.primary }]}>{t("directionsLabel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /* ── Loading screen (locating / fetching) ── */
  const isLoading = phase === "locating" || phase === "fetching";
  const loadingMsg = {
    locating: isRTL ? "جارٍ تحديد موقعك..." : "Localisation en cours...",
    fetching: isRTL ? "جارٍ البحث عن أقرب صيدلية..." : "Recherche des pharmacies...",
    done: "",
    denied: "",
  }[phase];

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>

      {/* ── Header ── */}
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.light.text} />
        </TouchableOpacity>

        <View style={[styles.headerTitleWrap, isRTL && { alignItems: "flex-end" }]}>
          <Text style={styles.headerTitle}>{t("nearestPharmacy")}</Text>
          {region && (
            <Text style={styles.headerSub}>
              {language === "ar" ? region.ar : region.fr}
            </Text>
          )}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={openGoogleMaps} activeOpacity={0.8}>
            <MaterialCommunityIcons name="google-maps" size={20} color="#34A853" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, isLoading && { opacity: 0.5 }]}
            onPress={detectLocation}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Ionicons name="locate" size={20} color={Colors.primary} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Location detected banner ── */}
      {userLat && phase === "done" && (
        <View style={[styles.detectedBanner, isRTL && styles.rtlRow]}>
          <Ionicons name="checkmark-circle" size={15} color={Colors.primary} />
          <Text style={styles.detectedText}>
            {t("locationDetectedLabel")}
          </Text>
        </View>
      )}

      {/* ── Permission denied banner ── */}
      {phase === "denied" && (
        <View style={[styles.deniedBanner, isRTL && { borderLeftWidth: 0, borderRightWidth: 3, borderRightColor: "#DC2626", flexDirection: "row-reverse" }]}>
          <Ionicons name="warning" size={15} color="#DC2626" />
          <Text style={[styles.deniedText, isRTL && styles.rtlText]} numberOfLines={2}>
            {isRTL
              ? "لم يتم منح إذن الموقع — ستظهر الصيدليات بدون ترتيب بالقرب"
              : "Localisation refusée — liste non triée par distance"}
          </Text>
          <TouchableOpacity onPress={() => Linking.openSettings()} activeOpacity={0.7}>
            <Text style={styles.deniedBtn}>
              {isRTL ? "الإعدادات" : "Paramètres"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Offline cache banner ── */}
      {!isOnline && fromCache && cachedPharmacies.length > 0 && (
        <View style={[
          styles.cacheBanner,
          isRTL && { borderLeftWidth: 0, borderRightWidth: 3, borderRightColor: "#7C3AED", flexDirection: "row-reverse" },
        ]}>
          <MaterialCommunityIcons name="cloud-off-outline" size={13} color="#7C3AED" />
          <Text style={[styles.cacheText, isRTL && styles.rtlText]}>
            {isRTL
              ? "بيانات محلية • وزارة الصحة الموريتانية"
              : "Données locales • Ministère de la Santé"}
          </Text>
        </View>
      )}

      {/* ── Loading screen ── */}
      {isLoading ? (
        <View style={styles.loadingScreen}>
          <Animated.View style={[styles.loadingIconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <MaterialCommunityIcons
              name={phase === "locating" ? "crosshairs-gps" : "map-marker-plus"}
              size={52}
              color={Colors.primary}
            />
          </Animated.View>
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 16 }} />
          <Text style={styles.loadingTitle}>{loadingMsg}</Text>
          <Text style={styles.loadingSub}>
            {isRTL
              ? "يرجى الانتظار لحظة..."
              : "Veuillez patienter..."}
          </Text>
        </View>
      ) : (
        /* ── Pharmacy list ── */
        <FlatList
          data={pharmacies}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            pharmacies.length === 0 && styles.emptyList,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOnline(userLat ?? undefined, userLon ?? undefined, true)}
              tintColor={Colors.primary}
            />
          }
          ListHeaderComponent={
            pharmacies.length > 0 ? (
              <View style={[styles.listHeader, isRTL && styles.rtlRow]}>
                <MaterialCommunityIcons name="map-marker-multiple" size={16} color={Colors.primary} />
                <Text style={[styles.listHeaderText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? `${pharmacies.length} صيدلية مرتّبة من الأقرب`
                    : `${pharmacies.length} pharmacies triées par distance`}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="map-marker-remove" size={64} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{t("noPharmaciesRegion")}</Text>
              <Text style={[styles.emptySub, isRTL && styles.rtlText]}>{t("contactToAdd")}</Text>
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

  /* ── Header ── */
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  headerTitleWrap: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },

  /* ── Banners ── */
  detectedBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary + "0D",
    marginHorizontal: 16, marginTop: 10, borderRadius: 10, padding: 10,
  },
  detectedText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary, flex: 1 },

  deniedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2",
    borderLeftWidth: 3, borderLeftColor: "#DC2626",
    marginHorizontal: 16, marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  deniedText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: "#991B1B" },
  deniedBtn: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#DC2626",
    textDecorationLine: "underline",
  },

  cacheBanner: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "#F5F3FF",
    borderLeftWidth: 3, borderLeftColor: "#7C3AED",
    marginHorizontal: 16, marginTop: 8,
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
  },
  cacheText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 11, color: "#4C1D95" },

  /* ── Loading screen ── */
  loadingScreen: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 4,
  },
  loadingIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  loadingTitle: {
    marginTop: 12, fontSize: 17, fontFamily: "Inter_600SemiBold",
    color: Colors.light.text, textAlign: "center",
  },
  loadingSub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, textAlign: "center",
  },

  /* ── List ── */
  list: { padding: 16, gap: 12 },
  emptyList: { flex: 1 },

  listHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  listHeaderText: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },

  /* ── Cards ── */
  card: {
    backgroundColor: Colors.light.card, borderRadius: 18, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  cardFirst: {
    borderColor: Colors.primary + "40",
    shadowColor: Colors.primary,
    shadowOpacity: 0.12, elevation: 5,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },

  rankBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + "18",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  rankBadgeFirst: { backgroundColor: Colors.primary },
  rankText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.primary },
  rankTextFirst: { color: "#fff" },

  cardInfo: { flex: 1 },
  pharmaName: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 4 },
  addressText: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, flex: 1,
  },

  distanceBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.primary + "10",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0,
  },
  distanceBadgeFirst: { backgroundColor: Colors.primary },
  distanceText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  distanceTextFirst: { color: "#fff" },

  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  /* ── Empty state ── */
  emptyState: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 60, gap: 12, paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16, fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary, textAlign: "center",
  },
  emptySub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary, textAlign: "center", lineHeight: 19,
  },
});
