import React, { useState, useEffect, useCallback } from "react";
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
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { PharmacyMap } from "@/components/PharmacyMap";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

type NearestPharmacy = {
  id: string;
  name: string;
  nameAr: string | null;
  address: string;
  addressAr: string | null;
  phone: string;
  lat: number | null;
  lon: number | null;
  region: string | null;
  distance: number | null;
};

function formatDistance(km: number | null, lang: string): string {
  if (km === null || km === undefined) return "";
  if (km < 1) return `${Math.round(km * 1000)} ${lang === "ar" ? "م" : "m"}`;
  return `${km.toFixed(1)} ${lang === "ar" ? "كم" : "km"}`;
}

export default function NearestPharmacyScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, region } = useApp();
  const isRTL = language === "ar";

  const [pharmacies, setPharmacies] = useState<NearestPharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const fetchPharmacies = useCallback(async (lat?: number, lon?: number, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lat !== undefined && lon !== undefined) {
        params.set("lat", String(lat));
        params.set("lon", String(lon));
      }
      if (region?.id) params.set("region", region.id);
      const resp = await fetch(`${API_BASE}/pharmacies/nearest?${params}`);
      if (resp.ok) {
        setPharmacies(await resp.json());
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [region]);

  const detectLocation = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        isRTL ? "المتصفح" : "Navigateur",
        isRTL
          ? "تحديد الموقع التلقائي غير متاح على الويب"
          : "Géolocalisation automatique non disponible sur web"
      );
      fetchPharmacies();
      return;
    }
    setLocating(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          isRTL ? "إذن الموقع مرفوض" : "Permission refusée",
          isRTL ? "يُرجى السماح بالوصول إلى الموقع" : "Veuillez autoriser la localisation"
        );
        fetchPharmacies();
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLat(loc.coords.latitude);
      setUserLon(loc.coords.longitude);
      await fetchPharmacies(loc.coords.latitude, loc.coords.longitude);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      fetchPharmacies();
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const callPharmacy = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${phone}`);
  };

  const openMaps = (item: NearestPharmacy) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let url: string;
    if (item.lat && item.lon) {
      url = Platform.OS === "ios"
        ? `maps:?ll=${item.lat},${item.lon}&q=${encodeURIComponent(item.name)}`
        : `https://maps.google.com/?q=${item.lat},${item.lon}`;
    } else {
      const query = encodeURIComponent((item.addressAr || item.address) + ", Mauritanie");
      url = Platform.OS === "ios"
        ? `maps:?q=${query}`
        : `https://maps.google.com/?q=${query}`;
    }
    Linking.openURL(url);
  };

  const renderItem = ({ item, index }: { item: NearestPharmacy; index: number }) => (
    <View style={styles.card}>
      <View style={[styles.cardHeader, isRTL && styles.rtlRow]}>
        <View style={[styles.rankBadge, index === 0 && styles.rankBadgeFirst]}>
          <Text style={[styles.rankText, index === 0 && styles.rankTextFirst]}>{index + 1}</Text>
        </View>
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
        {item.distance !== null && item.distance !== undefined && item.distance < 9999 && (
          <View style={styles.distanceBadge}>
            <Ionicons name="navigate" size={11} color={Colors.primary} />
            <Text style={styles.distanceText}>{formatDistance(item.distance, language)}</Text>
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
          <Text style={[styles.actionBtnText, { color: Colors.primary }]}>
            {t("directionsLabel")}
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
          <Text style={styles.headerTitle}>{t("nearestPharmacy")}</Text>
          {region && (
            <Text style={styles.headerSub}>{language === "ar" ? region.ar : region.fr}</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.gpsBtn, showMap && { backgroundColor: Colors.primary + "20" }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowMap((v) => !v); }}
            activeOpacity={0.8}
          >
            <Ionicons name={showMap ? "list" : "map"} size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gpsBtn, locating && { opacity: 0.7 }]}
            onPress={detectLocation}
            disabled={locating}
            activeOpacity={0.8}
          >
            {locating
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Ionicons name="locate" size={20} color={Colors.primary} />
            }
          </TouchableOpacity>
        </View>
      </View>

      {(userLat || locating) && (
        <View style={[styles.locationBanner, isRTL && styles.rtlRow]}>
          <Ionicons name="location" size={14} color={Colors.primary} />
          <Text style={styles.locationText}>
            {locating ? t("locatingLabel") : t("locationDetectedLabel")}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      ) : showMap ? (
        <View style={styles.mapContainer}>
          <PharmacyMap
            pharmacies={pharmacies}
            userLat={userLat}
            userLon={userLon}
            language={language}
          />
          <Text style={[styles.mapHint, isRTL && styles.rtlText]}>
            {isRTL
              ? `${pharmacies.filter((p) => p.lat && p.lon).length} صيدلية على الخريطة`
              : `${pharmacies.filter((p) => p.lat && p.lon).length} pharmacies sur la carte`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={pharmacies}
          keyExtractor={(item) => item.id}
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
              onRefresh={() => fetchPharmacies(userLat ?? undefined, userLon ?? undefined, true)}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="map-marker-off" size={64} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                {t("noPharmaciesRegion")}
              </Text>
              <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
                {t("contactToAdd")}
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
    backgroundColor: Colors.light.card, fontSize: 13,
    fontFamily: "Inter_500Medium", color: Colors.light.textSecondary,
    textAlign: "center", borderTopWidth: 1, borderTopColor: Colors.light.border,
  },

  locationBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary + "0D",
    marginHorizontal: 16, marginTop: 10,
    borderRadius: 10, padding: 10,
  },
  locationText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary },

  list: { padding: 16, gap: 12 },
  emptyList: { flex: 1 },

  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  rankBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + "18",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
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
    backgroundColor: Colors.primary + "10", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0,
  },
  distanceText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },

  cardActions: { flexDirection: "row", gap: 8 },
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
