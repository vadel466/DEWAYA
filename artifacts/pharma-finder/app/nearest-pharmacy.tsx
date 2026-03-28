import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking,
  RefreshControl, Platform, Alert,
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
  regionId: string | null
): NearestPharmacy[] {
  let filtered = regionId
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
  const { pharmacies: cachedPharmacies, pharmStatus, syncPharmacies } = useOfflineCache();

  const [pharmacies, setPharmacies]   = useState<NearestPharmacy[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [userLat, setUserLat]         = useState<number | null>(null);
  const [userLon, setUserLon]         = useState<number | null>(null);
  const [locating, setLocating]       = useState(false);
  const [fromCache, setFromCache]     = useState(false);

  /* Prevent setState after unmount */
  const mountedRef   = useRef(true);
  const fetchAbortRef = useRef<AbortController | null>(null);

  /* ── build list from online API ── */
  const fetchOnline = useCallback(async (lat?: number, lon?: number, isRefresh = false) => {
    if (!mountedRef.current) return;
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
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
      /* fallback to local cache */
      if (cachedPharmacies.length > 0) {
        setPharmacies(sortByDistance(cachedPharmacies, lat ?? null, lon ?? null, region?.id ?? null));
        setFromCache(true);
      }
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [region, cachedPharmacies]);

  /* ── build list from local cache ── */
  const fetchOffline = useCallback((lat?: number, lon?: number) => {
    setLoading(true);
    const sorted = sortByDistance(
      cachedPharmacies,
      lat ?? null,
      lon ?? null,
      region?.id ?? null
    );
    setPharmacies(sorted);
    setFromCache(true);
    setLoading(false);
  }, [cachedPharmacies, region]);

  /* ── re-sort in memory when user location changes ── */
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
        })
    );
  }, []);

  const detectLocation = async () => {
    if (Platform.OS === "web") {
      if (!("geolocation" in navigator)) {
        if (isOnline) fetchOnline(); else fetchOffline();
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setUserLat(lat); setUserLon(lon);
          if (isOnline) await fetchOnline(lat, lon);
          else fetchOffline(lat, lon);
          setLocating(false);
        },
        () => {
          if (isOnline) fetchOnline(); else fetchOffline();
          setLocating(false);
        },
        { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false },
      );
      return;
    }

    setLocating(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          isRTL ? "إذن الموقع مرفوض" : "Permission refusée",
          isRTL ? "يُرجى السماح بالوصول إلى الموقع" : "Veuillez autoriser la localisation",
        );
        if (isOnline) fetchOnline(); else fetchOffline();
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;
      setUserLat(lat); setUserLon(lon);
      if (isOnline) await fetchOnline(lat, lon);
      else fetchOffline(lat, lon);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      if (isOnline) fetchOnline(); else fetchOffline();
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    /* sync cache in background, then fetch */
    if (isOnline) syncPharmacies().catch(() => {});
    detectLocation();
    return () => {
      mountedRef.current = false;
      fetchAbortRef.current?.abort();
    };
  }, []);

  /* when location becomes known but list is already loaded, re-sort in place */
  useEffect(() => {
    if (userLat && userLon && pharmacies.length > 0) {
      applyLocalSort(userLat, userLon);
    }
  }, [userLat, userLon]);

  const openAllGoogleMaps = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = userLat && userLon
      ? `https://www.google.com/maps/search/pharmacies/@${userLat},${userLon},14z`
      : `https://www.google.com/maps/search/pharmacies+nouakchott/`;
    Linking.openURL(url);
  };

  const callPharmacy = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${phone}`);
  };

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

  const renderItem = ({ item, index }: { item: NearestPharmacy; index: number }) => (
    <View style={styles.card}>
      <View style={[styles.cardHeader, isRTL && styles.rtlRow]}>
        {/* rank */}
        <View style={[styles.rankBadge, index === 0 && styles.rankBadgeFirst]}>
          <Text style={[styles.rankText, index === 0 && styles.rankTextFirst]}>{index + 1}</Text>
        </View>
        {/* info */}
        <View style={[styles.cardInfo, isRTL && { alignItems: "flex-end" }]}>
          <Text style={[styles.pharmaName, isRTL && styles.rtlText]}>
            {isRTL && item.nameAr ? item.nameAr : item.name}
          </Text>
          <View style={[styles.addressRow, isRTL && styles.rtlRow]}>
            <Ionicons name="location-outline" size={13} color={Colors.light.textSecondary} />
            <Text style={[styles.addressText, isRTL && styles.rtlText]} numberOfLines={2}>
              {isRTL && item.addressAr ? item.addressAr : item.address}
            </Text>
          </View>
        </View>
        {/* distance badge */}
        {item.distance !== null && item.distance !== undefined && item.distance < 9999 && (
          <View style={[styles.distanceBadge, index === 0 && styles.distanceBadgeFirst]}>
            <Ionicons name="navigate" size={11} color={index === 0 ? "#fff" : Colors.primary} />
            <Text style={[styles.distanceText, index === 0 && styles.distanceTextFirst]}>
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

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
          <TouchableOpacity style={styles.gpsBtn} onPress={openAllGoogleMaps} activeOpacity={0.8}>
            <MaterialCommunityIcons name="google-maps" size={20} color="#34A853" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gpsBtn, locating && { opacity: 0.7 }]}
            onPress={detectLocation}
            disabled={locating}
            activeOpacity={0.8}
          >
            {locating
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Ionicons name="locate" size={20} color={Colors.primary} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* location detected banner */}
      {(userLat || locating) && (
        <View style={[styles.locationBanner, isRTL && styles.rtlRow]}>
          <Ionicons name="location" size={14} color={Colors.primary} />
          <Text style={styles.locationText}>
            {locating ? t("locatingLabel") : t("locationDetectedLabel")}
          </Text>
        </View>
      )}

      {/* offline cache banner */}
      {!isOnline && fromCache && cachedPharmacies.length > 0 && (
        <View style={[styles.cacheBanner, isRTL && { borderLeftWidth: 0, borderRightWidth: 3, borderRightColor: "#7C3AED", flexDirection: "row-reverse" }]}>
          <MaterialCommunityIcons name="cloud-off-outline" size={13} color="#7C3AED" />
          <Text style={[styles.cacheText, isRTL && styles.rtlText]}>
            {isRTL
              ? "أنت تصفح قاعدة البيانات المخزنة • بيانات رسمية من وزارة الصحة"
              : "Données locales — Ministère de la Santé mauritanien"}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      ) : (
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="map-marker-off" size={64} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{t("noPharmaciesRegion")}</Text>
              <Text style={[styles.emptySub,  isRTL && styles.rtlText]}>{t("contactToAdd")}</Text>
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  headerTitleWrap: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  gpsBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },

  mapContainer: {
    flex: 1, margin: 16, borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  mapHint: {
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: Colors.light.card,
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary, textAlign: "center",
    borderTopWidth: 1, borderTopColor: Colors.light.border,
  },

  locationBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary + "0D",
    marginHorizontal: 16, marginTop: 10,
    borderRadius: 10, padding: 10,
  },
  locationText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary },

  cacheBanner: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "#F5F3FF",
    borderLeftWidth: 3, borderLeftColor: "#7C3AED",
    marginHorizontal: 16, marginTop: 8,
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
  },
  cacheText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 11, color: "#4C1D95" },

  list: { padding: 16, gap: 12 },
  emptyList: { flex: 1 },

  card: {
    backgroundColor: Colors.light.card, borderRadius: 18, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: Colors.light.border,
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
  addressText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, flex: 1 },

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

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  emptyState: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 60, gap: 12, paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, textAlign: "center" },
  emptySub:  { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center", lineHeight: 19 },
});
