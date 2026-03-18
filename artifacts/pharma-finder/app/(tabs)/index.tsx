import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Dimensions,
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

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_H * 0.72;

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DUTY_RED = "#DC3545";
const DUTY_RED_LIGHT = "#FDECEA";
const AMBER = "#F59E0B";
const AMBER_LIGHT = "#FEF9EE";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage, userId, lockedCount, region, setRegion } = useApp();
  const isRTL = language === "ar";

  const [drugName, setDrugName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [regionQuery, setRegionQuery] = useState("");
  const [detectingLocation, setDetectingLocation] = useState(false);

  const sheetAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const sheetBgAnim = useRef(new Animated.Value(0)).current;

  const openSheet = useCallback(() => {
    setShowSearch(true);
    Animated.parallel([
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 160 }),
      Animated.timing(sheetBgAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [sheetAnim, sheetBgAnim]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: SHEET_HEIGHT, duration: 280, useNativeDriver: true }),
      Animated.timing(sheetBgAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(() => setShowSearch(false));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [sheetAnim, sheetBgAnim]);

  const openCamera = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (!result.canceled && result.assets[0]) setCapturedImage(result.assets[0].uri);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "إذن الكاميرا مرفوض" : "Permission caméra refusée",
        isRTL ? "يُرجى السماح للتطبيق باستخدام الكاميرا" : "Veuillez autoriser la caméra dans les paramètres"
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const openGallery = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "إذن المعرض مرفوض" : "Permission galerie refusée",
        isRTL ? "يُرجى السماح بالوصول إلى معرض الصور" : "Veuillez autoriser l'accès à la galerie"
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setCapturedImage(result.assets[0].uri);
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
      closeSheet();
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
  };

  const detectLocation = async () => {
    if (Platform.OS === "web") {
      Alert.alert(isRTL ? "غير مدعوم" : "Non supporté", isRTL ? "تحديد الموقع غير مدعوم في المتصفح" : "Géolocalisation non supportée sur web");
      return;
    }
    setDetectingLocation(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          isRTL ? "إذن الموقع مرفوض" : "Permission refusée",
          isRTL ? "يُرجى السماح بالوصول إلى الموقع" : "Veuillez autoriser l'accès à la localisation"
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nearest = getNearestRegion(loc.coords.latitude, loc.coords.longitude);
      setRegion(nearest);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(isRTL ? t("locationError") : t("locationError"));
    } finally {
      setDetectingLocation(false);
    }
  };

  const showComingSoon = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(t("comingSoon"), t("comingSoonMsg"));
  };

  const filteredRegions = regionQuery.trim()
    ? REGIONS.filter((r) =>
        r.ar.includes(regionQuery) || r.fr.toLowerCase().includes(regionQuery.toLowerCase())
      )
    : REGIONS;

  const canSubmit = drugName.trim().length > 0 || capturedImage !== null;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 90 : insets.bottom + 70;

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      {/* ─── HEADER ─── */}
      <View style={[styles.header, isRTL && styles.rowReverse]}>
        <TouchableOpacity style={styles.langPill} onPress={() => setLanguage(language === "ar" ? "fr" : "ar")} activeOpacity={0.75}>
          <Ionicons name="language" size={14} color={Colors.primary} />
          <Text style={styles.langPillText}>{t("changeLanguage")}</Text>
        </TouchableOpacity>

        <View style={[styles.identityRow, isRTL && styles.rowReverse]}>
          <View style={styles.miniLogo}>
            <MaterialCommunityIcons name="pill" size={18} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>{t("appName")}</Text>
        </View>

        <TouchableOpacity
          style={[styles.bellBtn, lockedCount > 0 && styles.bellBtnActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/notifications"); }}
          activeOpacity={0.75}
        >
          <Ionicons name={lockedCount > 0 ? "notifications" : "notifications-outline"} size={20} color={lockedCount > 0 ? Colors.warning : Colors.primary} />
          {lockedCount > 0 && (
            <View style={styles.bellDot}>
              <Text style={styles.bellDotTxt}>{lockedCount > 9 ? "9+" : lockedCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── REGION SELECTOR ─── */}
      <View style={[styles.regionRow, isRTL && styles.rowReverse]}>
        <Ionicons name="location-outline" size={18} color={Colors.primary} style={styles.regionIcon} />
        <TouchableOpacity style={styles.regionInput} onPress={() => setShowRegionPicker(true)} activeOpacity={0.8}>
          <Text style={[styles.regionInputText, !region && styles.regionPlaceholder, isRTL && styles.textRight]} numberOfLines={1}>
            {region ? (language === "ar" ? region.ar : region.fr) : t("regionPlaceholder")}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.light.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.gpsBtn} onPress={detectLocation} activeOpacity={0.8} disabled={detectingLocation}>
          {detectingLocation ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <Ionicons name="navigate" size={15} color={Colors.primary} />
              <Text style={styles.gpsBtnText}>{t("detectLocation")}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── SUCCESS STATE ─── */}
      {submitted ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={52} color={Colors.accent} />
            </View>
            <Text style={[styles.successTitle, isRTL && styles.textRight]}>{t("requestSent")}</Text>
            <Text style={[styles.successSub, isRTL && styles.textRight]}>{t("requestSentSubtitle")}</Text>
            <View style={styles.pillChip}>
              <MaterialCommunityIcons name="pill" size={15} color={Colors.primary} />
              <Text style={styles.pillChipText}>{drugName || (isRTL ? "صورة علبة دواء" : "Image de médicament")}</Text>
            </View>
            <View style={styles.successActions}>
              <TouchableOpacity style={styles.successBtnOutline} onPress={handleNewSearch} activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.successBtnOutlineText}>{t("newSearch")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.successBtnFill} onPress={() => router.push("/(tabs)/notifications")} activeOpacity={0.8}>
                <Ionicons name="notifications-outline" size={16} color="#fff" />
                <Text style={styles.successBtnFillText}>{t("notifications")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        /* ─── ACTION GRID ─── */
        <View style={styles.grid}>
          {/* Row 1 */}
          <View style={styles.gridRow}>
            {/* أقرب صيدلية */}
            <TouchableOpacity style={[styles.card, { backgroundColor: "#EBF6FB" }]} onPress={showComingSoon} activeOpacity={0.82}>
              <View style={[styles.cardAccent, { backgroundColor: Colors.primary }]} />
              <View style={[styles.cardIconCircle, { backgroundColor: Colors.primary + "22" }]}>
                <MaterialCommunityIcons name="map-marker-radius" size={26} color={Colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: Colors.primary }, isRTL && styles.textRight]} numberOfLines={2}>
                {t("nearestPharmacy")}
              </Text>
              <Text style={[styles.cardDesc, isRTL && styles.textRight]} numberOfLines={2}>
                {t("nearestPharmacyDesc")}
              </Text>
            </TouchableOpacity>

            {/* أبحث عن دواء */}
            <TouchableOpacity style={[styles.card, { backgroundColor: Colors.accentLight }]} onPress={openSheet} activeOpacity={0.82}>
              <View style={[styles.cardAccent, { backgroundColor: Colors.accent }]} />
              <View style={[styles.cardIconCircle, { backgroundColor: Colors.accent + "22" }]}>
                <MaterialCommunityIcons name="pill" size={26} color={Colors.accent} />
              </View>
              <Text style={[styles.cardTitle, { color: Colors.accent }, isRTL && styles.textRight]} numberOfLines={2}>
                {t("searchDrug")}
              </Text>
              <Text style={[styles.cardDesc, isRTL && styles.textRight]} numberOfLines={2}>
                {t("searchDrugDesc")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Row 2 */}
          <View style={styles.gridRow}>
            {/* سعر الدواء */}
            <TouchableOpacity style={[styles.card, { backgroundColor: AMBER_LIGHT }]} onPress={showComingSoon} activeOpacity={0.82}>
              <View style={[styles.cardAccent, { backgroundColor: AMBER }]} />
              <View style={[styles.cardIconCircle, { backgroundColor: AMBER + "25" }]}>
                <MaterialCommunityIcons name="tag-outline" size={26} color={AMBER} />
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
              <View style={[styles.cardIconCircle, { backgroundColor: DUTY_RED + "20" }]}>
                <MaterialCommunityIcons name="hospital-building" size={26} color={DUTY_RED} />
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
      )}

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
                style={[styles.regionItem, region?.id === item.id && styles.regionItemSelected, isRTL && styles.rowReverse]}
                onPress={() => { setRegion(item); setRegionQuery(""); setShowRegionPicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                activeOpacity={0.75}
              >
                <View style={[styles.regionItemIcon, region?.id === item.id && { backgroundColor: Colors.primary }]}>
                  <Ionicons name="location" size={15} color={region?.id === item.id ? "#fff" : Colors.primary} />
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

      {/* ─── SEARCH BOTTOM SHEET ─── */}
      {showSearch && (
        <Modal visible transparent animationType="none" onRequestClose={closeSheet}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <Animated.View style={[styles.sheetBackdrop, { opacity: sheetBgAnim }]}>
              <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSheet} activeOpacity={1} />
            </Animated.View>

            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
              <View style={styles.sheetHandle} />

              <View style={[styles.sheetHeader, isRTL && styles.rowReverse]}>
                <Text style={styles.sheetTitle}>{t("searchTitle")}</Text>
                <TouchableOpacity onPress={closeSheet} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={26} color={Colors.light.textTertiary} />
                </TouchableOpacity>
              </View>

              {/* حقل اسم الدواء */}
              <View style={[styles.inputRow, isRTL && styles.rowReverse]}>
                <Ionicons name="search-outline" size={20} color={Colors.light.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textField, isRTL && styles.textRight]}
                  placeholder={t("searchPlaceholder")}
                  placeholderTextColor={Colors.light.textTertiary}
                  value={drugName}
                  onChangeText={setDrugName}
                  textAlign={isRTL ? "right" : "left"}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                  autoFocus
                />
                {drugName.length > 0 && (
                  <TouchableOpacity onPress={() => setDrugName("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>{t("orText")}</Text>
                <View style={styles.orLine} />
              </View>

              {capturedImage ? (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: capturedImage }} style={styles.previewImg} resizeMode="cover" />
                  <TouchableOpacity style={styles.removeImg} onPress={() => setCapturedImage(null)}>
                    <Ionicons name="close-circle" size={28} color="#EF4444" />
                  </TouchableOpacity>
                  <View style={styles.imgReadyBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={Colors.accent} />
                    <Text style={styles.imgReadyText}>{isRTL ? "الصورة جاهزة" : "Image prête"}</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.cameraRow, isRTL && styles.rowReverse]}>
                  <TouchableOpacity style={styles.cameraBtn} onPress={openCamera} activeOpacity={0.8}>
                    <View style={[styles.camIcon, { backgroundColor: Colors.primary + "18" }]}>
                      <Ionicons name="camera" size={22} color={Colors.primary} />
                    </View>
                    <Text style={[styles.camBtnText, { color: Colors.primary }, isRTL && styles.textRight]}>
                      {isRTL ? "تصوير العلبة" : "Photo de la boîte"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.galleryBtn} onPress={openGallery} activeOpacity={0.8}>
                    <View style={[styles.camIcon, { backgroundColor: Colors.accent + "18" }]}>
                      <Ionicons name="images" size={22} color={Colors.accent} />
                    </View>
                    <Text style={[styles.camBtnText, { color: Colors.accent }, isRTL && styles.textRight]}>
                      {isRTL ? "من المعرض" : "Depuis la galerie"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[styles.submitBtn, (!canSubmit || loading) && styles.submitBtnDisabled]}
                onPress={handleSearch}
                activeOpacity={0.85}
                disabled={!canSubmit || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>{t("searchButton")}</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 16,
  },

  rowReverse: { flexDirection: "row-reverse" },
  textRight: { textAlign: "right", writingDirection: "rtl" },

  /* ─── HEADER ─── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginBottom: 4,
  },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primary + "12",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.primary + "25",
  },
  langPillText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  miniLogo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  bellBtnActive: {
    backgroundColor: Colors.warning + "14",
    borderColor: Colors.warning + "45",
  },
  bellDot: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.light.background,
  },
  bellDotTxt: { color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold", lineHeight: 11 },

  /* ─── REGION ROW ─── */
  regionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  regionIcon: { flexShrink: 0 },
  regionInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  regionInputText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.light.text,
  },
  regionPlaceholder: { color: Colors.light.textTertiary },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary + "12",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.primary + "28",
    flexShrink: 0,
  },
  gpsBtnText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11 },

  /* ─── ACTION GRID ─── */
  grid: {
    flex: 1,
    gap: 12,
  },
  gridRow: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
    justifyContent: "flex-end",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 5,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  cardIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginLeft: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
    paddingLeft: 8,
  },
  cardDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 15,
    paddingLeft: 8,
  },

  /* ─── SUCCESS ─── */
  successOverlay: {
    flex: 1,
    justifyContent: "center",
  },
  successCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  successIcon: { marginBottom: 14 },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.light.text, marginBottom: 8, textAlign: "center" },
  successSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 21, marginBottom: 18 },
  pillChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accentLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 22,
  },
  pillChipText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  successActions: { flexDirection: "row", gap: 10, width: "100%" },
  successBtnOutline: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary,
  },
  successBtnOutlineText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  successBtnFill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    paddingVertical: 11, borderRadius: 12, backgroundColor: Colors.primary,
  },
  successBtnFillText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },

  /* ─── REGION PICKER ─── */
  pickerContainer: { flex: 1, backgroundColor: Colors.light.background },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  pickerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  pickerSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.inputBackground,
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pickerSearchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.light.text },
  regionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  regionItemSelected: { opacity: 1 },
  regionItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  regionItemAr: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.text },
  regionItemFr: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  regionSep: { height: 1, backgroundColor: Colors.light.border },

  /* ─── BOTTOM SHEET ─── */
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    marginTop: 8,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.inputBackground,
    borderRadius: 13,
    paddingHorizontal: 14,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputIcon: { marginRight: 8 },
  textField: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  orRow: { flexDirection: "row", alignItems: "center", marginVertical: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.light.border },
  orText: { marginHorizontal: 12, color: Colors.light.textTertiary, fontFamily: "Inter_500Medium", fontSize: 12 },
  cameraRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  cameraBtn: {
    flex: 1, alignItems: "center", borderRadius: 14, paddingVertical: 14, gap: 6,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: Colors.primary + "50",
    backgroundColor: Colors.primary + "06",
  },
  galleryBtn: {
    flex: 1, alignItems: "center", borderRadius: 14, paddingVertical: 14, gap: 6,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: Colors.accent + "50",
    backgroundColor: Colors.accent + "06",
  },
  camIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  camBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "center" },
  imagePreview: { borderRadius: 14, overflow: "hidden", marginBottom: 18, position: "relative" },
  previewImg: { width: "100%", height: 160, borderRadius: 14 },
  removeImg: { position: "absolute", top: 8, right: 8, backgroundColor: "#fff", borderRadius: 14 },
  imgReadyBadge: {
    position: "absolute", bottom: 8, left: 8,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  imgReadyText: { color: Colors.accent, fontFamily: "Inter_600SemiBold", fontSize: 11 },
  errorText: { color: Colors.danger, textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 8 },
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 6,
    marginTop: 4,
  },
  submitBtnDisabled: { backgroundColor: Colors.light.textTertiary, shadowOpacity: 0, elevation: 0 },
  submitBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
});
