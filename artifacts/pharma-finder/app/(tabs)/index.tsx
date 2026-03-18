import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import Colors from "@/constants/colors";
import { REGIONS, getNearestRegion } from "@/constants/regions";
import { useApp } from "@/context/AppContext";
import { router } from "expo-router";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DUTY_RED = "#DC3545";
const DUTY_RED_LIGHT = "#FEF0F0";
const AMBER = "#F59E0B";
const AMBER_LIGHT = "#FEF9EE";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage, userId, lockedCount, region, setRegion } = useApp();
  const isRTL = language === "ar";
  const inputRef = useRef<TextInput>(null);

  const [drugName, setDrugName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [regionQuery, setRegionQuery] = useState("");
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showImgMenu, setShowImgMenu] = useState(false);

  const openCamera = async () => {
    setShowImgMenu(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (!r.canceled && r.assets[0]) setCapturedImage(r.assets[0].uri);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "إذن الكاميرا مرفوض" : "Permission caméra refusée",
        isRTL ? "يُرجى السماح للتطبيق باستخدام الكاميرا" : "Veuillez autoriser la caméra"
      );
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [4, 3] });
    if (!r.canceled && r.assets[0]) {
      setCapturedImage(r.assets[0].uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const openGallery = async () => {
    setShowImgMenu(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "إذن المعرض مرفوض" : "Permission galerie refusée",
        isRTL ? "يُرجى السماح بالوصول إلى معرض الصور" : "Veuillez autoriser la galerie"
      );
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!r.canceled && r.assets[0]) setCapturedImage(r.assets[0].uri);
  };

  const handleSearch = async () => {
    if (!drugName.trim() && !capturedImage) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          drugName: drugName.trim() || (isRTL ? "صورة علبة دواء" : "Image de médicament"),
        }),
      });
      if (!resp.ok) throw new Error("Failed");
      await resp.json();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
    } catch {
      setError(t("error"));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewSearch = () => {
    setSubmitted(false);
    setDrugName("");
    setCapturedImage(null);
    setError(null);
  };

  const detectLocation = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        isRTL ? "غير مدعوم" : "Non supporté",
        isRTL ? "تحديد الموقع غير مدعوم في المتصفح" : "Géolocalisation non supportée sur web"
      );
      return;
    }
    setDetectingLocation(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          isRTL ? "إذن الموقع مرفوض" : "Permission refusée",
          isRTL ? "يُرجى السماح بالوصول إلى الموقع" : "Veuillez autoriser la localisation"
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nearest = getNearestRegion(loc.coords.latitude, loc.coords.longitude);
      setRegion(nearest);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t("locationError"));
    } finally {
      setDetectingLocation(false);
    }
  };

  const showComingSoon = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(t("comingSoon"), t("comingSoonMsg"));
  };

  const filteredRegions = regionQuery.trim()
    ? REGIONS.filter((r) => r.ar.includes(regionQuery) || r.fr.toLowerCase().includes(regionQuery.toLowerCase()))
    : REGIONS;

  const canSubmit = drugName.trim().length > 0 || capturedImage !== null;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 90 : insets.bottom + 70;

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>

      {/* ─── HEADER ─── */}
      <View style={[styles.header, isRTL && styles.rowReverse]}>
        <TouchableOpacity
          style={styles.langPill}
          onPress={() => setLanguage(language === "ar" ? "fr" : "ar")}
          activeOpacity={0.75}
        >
          <Ionicons name="language" size={13} color={Colors.primary} />
          <Text style={styles.langPillText}>{t("changeLanguage")}</Text>
        </TouchableOpacity>

        <View style={[styles.identityRow, isRTL && styles.rowReverse]}>
          <View style={styles.miniLogo}>
            <MaterialCommunityIcons name="pill" size={16} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>{t("appName")}</Text>
        </View>

        <TouchableOpacity
          style={[styles.bellBtn, lockedCount > 0 && styles.bellBtnActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/notifications"); }}
          activeOpacity={0.75}
        >
          <Ionicons name={lockedCount > 0 ? "notifications" : "notifications-outline"} size={19} color={lockedCount > 0 ? Colors.warning : Colors.primary} />
          {lockedCount > 0 && (
            <View style={styles.bellDot}>
              <Text style={styles.bellDotTxt}>{lockedCount > 9 ? "9+" : lockedCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── REGION SELECTOR ─── */}
      <View style={[styles.regionRow, isRTL && styles.rowReverse]}>
        <Ionicons name="location-outline" size={16} color={Colors.primary} />
        <TouchableOpacity style={styles.regionInput} onPress={() => setShowRegionPicker(true)} activeOpacity={0.8}>
          <Text style={[styles.regionInputText, !region && styles.regionPlaceholder]} numberOfLines={1}>
            {region ? (language === "ar" ? region.ar : region.fr) : t("regionPlaceholder")}
          </Text>
          <Ionicons name="chevron-down" size={14} color={Colors.light.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.gpsBtn} onPress={detectLocation} activeOpacity={0.8} disabled={detectingLocation}>
          {detectingLocation
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <>
                <Ionicons name="navigate" size={13} color={Colors.primary} />
                <Text style={styles.gpsBtnText}>{t("detectLocation")}</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* ─── SEARCH SECTION ─── */}
      {submitted ? (
        /* Success card */
        <View style={styles.successCard}>
          <View style={styles.successIconRow}>
            <Ionicons name="checkmark-circle" size={36} color={Colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.successTitle, isRTL && styles.textRight]}>{t("requestSent")}</Text>
              <Text style={[styles.successSub, isRTL && styles.textRight]} numberOfLines={2}>{t("requestSentSubtitle")}</Text>
            </View>
          </View>
          <View style={styles.successActions}>
            <TouchableOpacity style={styles.successBtnOutline} onPress={handleNewSearch} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={15} color={Colors.primary} />
              <Text style={styles.successBtnOutlineText}>{t("newSearch")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.successBtnFill} onPress={() => router.push("/(tabs)/notifications")} activeOpacity={0.8}>
              <Ionicons name="notifications-outline" size={15} color="#fff" />
              <Text style={styles.successBtnFillText}>{t("notifications")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Search card */
        <View style={styles.searchCard}>
          <Text style={[styles.searchCardLabel, isRTL && styles.textRight]}>{t("searchTitle")}</Text>

          {/* Input row + camera icons */}
          <View style={[styles.inputOuterRow, isRTL && styles.rowReverse]}>
            <View style={[styles.inputInner, isRTL && styles.rowReverse]}>
              <Ionicons name="search-outline" size={18} color={Colors.light.textSecondary} />
              <TextInput
                ref={inputRef}
                style={[styles.textField, isRTL && styles.textRight]}
                placeholder={t("searchPlaceholder")}
                placeholderTextColor={Colors.light.textTertiary}
                value={drugName}
                onChangeText={setDrugName}
                textAlign={isRTL ? "right" : "left"}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                editable={!capturedImage}
              />
              {drugName.length > 0 && !capturedImage && (
                <TouchableOpacity onPress={() => setDrugName("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={Colors.light.textTertiary} />
                </TouchableOpacity>
              )}
              {/* Captured image thumbnail */}
              {capturedImage && (
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: capturedImage }} style={styles.thumb} />
                  <TouchableOpacity style={styles.thumbRemove} onPress={() => setCapturedImage(null)}>
                    <Ionicons name="close-circle" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Camera icon button */}
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: Colors.primary + "14", borderColor: Colors.primary + "30" }]}
              onPress={() => setShowImgMenu(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || loading) && styles.submitBtnDisabled]}
            onPress={handleSearch}
            activeOpacity={0.85}
            disabled={!canSubmit || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="paper-plane" size={16} color="#fff" />
                  <Text style={styles.submitBtnText}>{t("searchButton")}</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* ─── ACTION GRID ─── */}
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          {/* أقرب صيدلية */}
          <TouchableOpacity style={[styles.card, { backgroundColor: "#EBF6FB" }]} onPress={showComingSoon} activeOpacity={0.82}>
            <View style={[styles.cardAccent, { backgroundColor: Colors.primary }]} />
            <View style={[styles.cardIconCircle, { backgroundColor: Colors.primary + "20" }]}>
              <MaterialCommunityIcons name="map-marker-radius" size={22} color={Colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: Colors.primary }, isRTL && styles.textRight]} numberOfLines={2}>
              {t("nearestPharmacy")}
            </Text>
            <Text style={[styles.cardDesc, isRTL && styles.textRight]} numberOfLines={2}>
              {t("nearestPharmacyDesc")}
            </Text>
          </TouchableOpacity>

          {/* أبحث عن دواء */}
          <TouchableOpacity
            style={[styles.card, { backgroundColor: Colors.accentLight }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); inputRef.current?.focus(); }}
            activeOpacity={0.82}
          >
            <View style={[styles.cardAccent, { backgroundColor: Colors.accent }]} />
            <View style={[styles.cardIconCircle, { backgroundColor: Colors.accent + "20" }]}>
              <MaterialCommunityIcons name="pill" size={22} color={Colors.accent} />
            </View>
            <Text style={[styles.cardTitle, { color: Colors.accent }, isRTL && styles.textRight]} numberOfLines={2}>
              {t("searchDrug")}
            </Text>
            <Text style={[styles.cardDesc, isRTL && styles.textRight]} numberOfLines={2}>
              {t("searchDrugDesc")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridRow}>
          {/* سعر الدواء */}
          <TouchableOpacity style={[styles.card, { backgroundColor: AMBER_LIGHT }]} onPress={showComingSoon} activeOpacity={0.82}>
            <View style={[styles.cardAccent, { backgroundColor: AMBER }]} />
            <View style={[styles.cardIconCircle, { backgroundColor: AMBER + "22" }]}>
              <MaterialCommunityIcons name="tag-outline" size={22} color={AMBER} />
            </View>
            <Text style={[styles.cardTitle, { color: AMBER }, isRTL && styles.textRight]} numberOfLines={2}>
              {t("drugPrice")}
            </Text>
            <Text style={[styles.cardDesc, isRTL && styles.textRight]} numberOfLines={2}>
              {t("drugPriceDesc")}
            </Text>
          </TouchableOpacity>

          {/* صيدليات المداومة */}
          <TouchableOpacity style={[styles.card, { backgroundColor: DUTY_RED_LIGHT }]} onPress={showComingSoon} activeOpacity={0.82}>
            <View style={[styles.cardAccent, { backgroundColor: DUTY_RED }]} />
            <View style={[styles.cardIconCircle, { backgroundColor: DUTY_RED + "18" }]}>
              <MaterialCommunityIcons name="hospital-building" size={22} color={DUTY_RED} />
            </View>
            <Text style={[styles.cardTitle, { color: DUTY_RED }, isRTL && styles.textRight]} numberOfLines={2}>
              {t("dutyPharmacies")}
            </Text>
            <Text style={[styles.cardDesc, isRTL && styles.textRight]} numberOfLines={2}>
              {t("dutyPharmaciesDesc")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── REGION PICKER MODAL ─── */}
      <Modal visible={showRegionPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRegionPicker(false)}>
        <View style={styles.pickerContainer}>
          <View style={[styles.pickerHeader, isRTL && styles.rowReverse]}>
            <Text style={styles.pickerTitle}>{t("selectRegion")}</Text>
            <TouchableOpacity onPress={() => { setShowRegionPicker(false); setRegionQuery(""); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </TouchableOpacity>
          </View>
          <View style={[styles.pickerSearch, isRTL && styles.rowReverse]}>
            <Ionicons name="search-outline" size={18} color={Colors.light.textTertiary} />
            <TextInput
              style={[styles.pickerSearchInput, isRTL && styles.textRight]}
              placeholder={isRTL ? "ابحث عن منطقة..." : "Rechercher une région..."}
              placeholderTextColor={Colors.light.textTertiary}
              value={regionQuery}
              onChangeText={setRegionQuery}
              textAlign={isRTL ? "right" : "left"}
            />
          </View>
          <FlatList
            data={filteredRegions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.regionItem, isRTL && styles.rowReverse]}
                onPress={() => { setRegion(item); setRegionQuery(""); setShowRegionPicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                activeOpacity={0.75}
              >
                <View style={[styles.regionItemIcon, region?.id === item.id && { backgroundColor: Colors.primary }]}>
                  <Ionicons name="location" size={14} color={region?.id === item.id ? "#fff" : Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.regionItemAr, isRTL && styles.textRight]}>{item.ar}</Text>
                  <Text style={[styles.regionItemFr, isRTL && styles.textRight]}>{item.fr}</Text>
                </View>
                {region?.id === item.id && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.regionSep} />}
          />
        </View>
      </Modal>

      {/* ─── IMAGE SOURCE MENU ─── */}
      <Modal visible={showImgMenu} transparent animationType="fade" onRequestClose={() => setShowImgMenu(false)}>
        <TouchableOpacity style={styles.menuBackdrop} onPress={() => setShowImgMenu(false)} activeOpacity={1}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <Text style={[styles.menuTitle, isRTL && styles.textRight]}>
              {isRTL ? "اختر مصدر الصورة" : "Choisir la source"}
            </Text>
            <TouchableOpacity style={[styles.menuItem, isRTL && styles.rowReverse]} onPress={openCamera} activeOpacity={0.8}>
              <View style={[styles.menuItemIcon, { backgroundColor: Colors.primary + "14" }]}>
                <Ionicons name="camera" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.menuItemText}>{isRTL ? "تصوير الآن" : "Prendre une photo"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, isRTL && styles.rowReverse]} onPress={openGallery} activeOpacity={0.8}>
              <View style={[styles.menuItemIcon, { backgroundColor: Colors.accent + "14" }]}>
                <Ionicons name="images" size={22} color={Colors.accent} />
              </View>
              <Text style={styles.menuItemText}>{isRTL ? "من معرض الصور" : "Depuis la galerie"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCancel} onPress={() => setShowImgMenu(false)} activeOpacity={0.8}>
              <Text style={styles.menuCancelText}>{t("cancel")}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 14,
  },
  rowReverse: { flexDirection: "row-reverse" },
  textRight: { textAlign: "right", writingDirection: "rtl" },

  /* HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginBottom: 6,
  },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary + "10",
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.primary + "20",
  },
  langPillText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniLogo: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.light.text },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.light.card,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.light.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  bellBtnActive: { backgroundColor: Colors.warning + "12", borderColor: Colors.warning + "40" },
  bellDot: {
    position: "absolute", top: -2, right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 7, minWidth: 14, height: 14,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 2,
    borderWidth: 1.5, borderColor: Colors.light.background,
  },
  bellDotTxt: { color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold", lineHeight: 10 },

  /* REGION ROW */
  regionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  regionInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  regionInputText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.text },
  regionPlaceholder: { color: Colors.light.textTertiary },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.primary + "10",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary + "22",
  },
  gpsBtnText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11 },

  /* SEARCH CARD */
  searchCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  searchCardLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  inputOuterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  inputInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.inputBackground,
    borderRadius: 11,
    paddingHorizontal: 11,
    gap: 6,
    minHeight: 44,
  },
  textField: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  thumbWrap: { position: "relative", width: 36, height: 36, borderRadius: 8, overflow: "visible" },
  thumb: { width: 36, height: 36, borderRadius: 8 },
  thumbRemove: { position: "absolute", top: -6, right: -6, backgroundColor: "#fff", borderRadius: 9 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  errorText: { color: Colors.danger, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", marginBottom: 6 },
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 11,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: Colors.light.textTertiary, shadowOpacity: 0, elevation: 0 },
  submitBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },

  /* SUCCESS CARD */
  successCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.accent + "30",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  successIconRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  successTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text, marginBottom: 2 },
  successSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, lineHeight: 17 },
  successActions: { flexDirection: "row", gap: 8 },
  successBtnOutline: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary,
  },
  successBtnOutlineText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  successBtnFill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.primary,
  },
  successBtnFillText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },

  /* GRID */
  grid: { flex: 1, gap: 10 },
  gridRow: { flex: 1, flexDirection: "row", gap: 10 },
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    overflow: "hidden",
    justifyContent: "flex-end",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.04)",
  },
  cardAccent: {
    position: "absolute", top: 0, left: 0, width: 4,
    bottom: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
  },
  cardIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8, marginLeft: 6,
  },
  cardTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 3, paddingLeft: 6 },
  cardDesc: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, lineHeight: 14, paddingLeft: 6 },

  /* REGION PICKER */
  pickerContainer: { flex: 1, backgroundColor: Colors.light.background },
  pickerHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  pickerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  pickerSearch: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.light.inputBackground, borderRadius: 12,
    marginHorizontal: 20, marginVertical: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  pickerSearchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.light.text },
  regionItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13 },
  regionItemIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  regionItemAr: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  regionItemFr: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary },
  regionSep: { height: 1, backgroundColor: Colors.light.border },

  /* IMAGE SOURCE MENU */
  menuBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12,
  },
  menuHandle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: Colors.light.border,
    alignSelf: "center", marginBottom: 14,
  },
  menuTitle: {
    fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text,
    marginBottom: 14,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 14, marginBottom: 10,
    backgroundColor: Colors.light.card,
  },
  menuItemIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  menuItemText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  menuCancel: {
    paddingVertical: 14, alignItems: "center", borderRadius: 14,
    backgroundColor: Colors.light.inputBackground, marginTop: 4,
  },
  menuCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary },
});
