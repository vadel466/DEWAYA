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
  Animated,
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
const DOCTOR_BLUE = "#1A6FA8";
const DOCTOR_LIGHT = "#EFF6FF";
const SERVICES_PURPLE = "#7C3AED";
const SERVICES_LIGHT = "#F5F3FF";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage, userId, lockedCount, region, setRegion, isAdmin, setIsAdmin } = useApp();
  const isRTL = language === "ar";
  const inputRef = useRef<TextInput>(null);

  const [drugName, setDrugName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [regionQuery, setRegionQuery] = useState("");
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showImgMenu, setShowImgMenu] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState("");
  const [adminPinError, setAdminPinError] = useState(false);
  const [adminPinSuccess, setAdminPinSuccess] = useState(false);
  const logoProgress = useRef(new Animated.Value(0)).current;
  const logoAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const adminPinRef = useRef<TextInput>(null);

  const ADMIN_PIN = "2026";

  const handleLogoLongPress = () => {
    logoAnimation.current?.stop();
    Animated.timing(logoProgress, { toValue: 0, duration: 0, useNativeDriver: false }).start();
    setShowAdminPinModal(true);
    setAdminPinInput("");
    setAdminPinError(false);
    setAdminPinSuccess(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => adminPinRef.current?.focus(), 200);
  };

  const handleLogoPressIn = () => {
    logoAnimation.current?.stop();
    Animated.timing(logoProgress, { toValue: 0, duration: 0, useNativeDriver: false }).start(() => {
      logoAnimation.current = Animated.timing(logoProgress, { toValue: 1, duration: 5000, useNativeDriver: false });
      logoAnimation.current.start();
    });
  };

  const handleLogoPressOut = () => {
    logoAnimation.current?.stop();
    Animated.timing(logoProgress, { toValue: 0, duration: 300, useNativeDriver: false }).start();
  };

  const handleAdminPinSubmit = async () => {
    if (adminPinInput.trim() === ADMIN_PIN) {
      setAdminPinSuccess(true);
      setAdminPinError(false);
      await setIsAdmin(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setShowAdminPinModal(false);
        setAdminPinInput("");
        setAdminPinSuccess(false);
        router.push("/(tabs)/admin");
      }, 800);
    } else {
      setAdminPinError(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setAdminPinError(false), 2500);
    }
  };

  const openCamera = async () => {
    setShowImgMenu(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === "web") {
      // Web: use <input capture="environment"> to open device camera directly
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      (input as any).capture = "environment";
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setCapturedImage(reader.result as string);
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }

    // Native: request permission then launch camera app
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "إذن الكاميرا مرفوض" : "Permission caméra refusée",
        isRTL
          ? "يُرجى الذهاب إلى الإعدادات والسماح للتطبيق باستخدام الكاميرا"
          : "Veuillez aller dans les paramètres et autoriser la caméra"
      );
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
      exif: false,
    });
    if (!r.canceled && r.assets[0]) {
      setCapturedImage(r.assets[0].uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const openGallery = async () => {
    setShowImgMenu(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === "web") {
      // Web: standard file picker — no capture attribute so it opens gallery/files
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setCapturedImage(reader.result as string);
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }

    // Native: request media library permission then open gallery
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "إذن المعرض مرفوض" : "Permission galerie refusée",
        isRTL
          ? "يُرجى الذهاب إلى الإعدادات والسماح بالوصول إلى معرض الصور"
          : "Veuillez aller dans les paramètres et autoriser la galerie"
      );
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      exif: false,
    });
    if (!r.canceled && r.assets[0]) {
      setCapturedImage(r.assets[0].uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
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
          drugName: drugName.trim() || t("imageDrug"),
        }),
      });
      if (!resp.ok) throw new Error("Failed");
      await resp.json();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      setShowSuccessModal(true);
    } catch {
      setError(t("error"));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewSearch = () => {
    setSubmitted(false);
    setShowSuccessModal(false);
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

  const goToNearest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/nearest-pharmacy");
  };

  const goToDutyAndPrice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/duty-and-price");
  };

  const goToFindDoctor = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/find-doctor");
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

        <TouchableOpacity
          style={[styles.identityRow, isRTL && styles.rowReverse]}
          onPressIn={handleLogoPressIn}
          onPressOut={handleLogoPressOut}
          onLongPress={handleLogoLongPress}
          delayLongPress={5000}
          activeOpacity={0.85}
        >
          {/* ── Pharmacy badge logo with press progress ring ── */}
          <View style={styles.miniLogoWrap}>
            <Animated.View style={[
              styles.miniLogoRing,
              {
                borderColor: logoProgress.interpolate({ inputRange: [0, 1], outputRange: [Colors.primary + "00", Colors.primary] }),
                transform: [{ scale: logoProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
              }
            ]} />
            <View style={styles.miniLogo}>
              <MaterialCommunityIcons name="stethoscope" size={20} color="#fff" />
              <View style={styles.miniLogoIcons}>
                <MaterialCommunityIcons name="pill" size={9} color="rgba(255,255,255,0.88)" />
                <MaterialCommunityIcons name="hospital-box" size={9} color="rgba(255,255,255,0.88)" />
              </View>
            </View>
            {isAdmin && (
              <View style={styles.adminBadgeDot} />
            )}
          </View>

          {/* ── Bilingual name ── */}
          <View style={[styles.nameStack, isRTL && { alignItems: "flex-end" }]}>
            <Text style={styles.headerTitle}>{t("appName")}</Text>
            <View style={[styles.frNameRow, isRTL && styles.rowReverse]}>
              <View style={styles.frDivider} />
              <Text style={styles.headerFrName}>DEWAYA</Text>
            </View>
          </View>
        </TouchableOpacity>

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

      {/* ─── APP DESCRIPTION ─── */}
      <View style={[styles.appDescRow, isRTL && styles.rowReverse]}>
        <MaterialCommunityIcons name="pill" size={11} color={Colors.primary + "70"} />
        <Text style={[styles.appDescText, isRTL && styles.textRight]} numberOfLines={2}>
          {t("appDescription")}
        </Text>
        <MaterialCommunityIcons name="map-marker-outline" size={11} color={Colors.primary + "70"} />
      </View>

      {/* ─── UNIFIED SMART SEARCH BAR ─── */}
      {submitted ? (
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
        <View style={styles.searchCard}>
          <Text style={[styles.searchCardLabel, isRTL && styles.textRight]}>{t("searchTitle")}</Text>

          {/* ── Camera + Search bar row ── */}
          <View style={[styles.searchBarRow, isRTL && styles.rowReverse]}>

            {/* 📷 Camera square button — standalone, left of the bar */}
            <TouchableOpacity
              style={styles.cameraSqBtn}
              onPress={() => setShowImgMenu(true)}
              activeOpacity={0.80}
            >
              <Ionicons name="camera" size={22} color={Colors.primary} />
            </TouchableOpacity>

            {/* Unified input bar: [📍 Region] | [Drug input] */}
            <View style={[styles.unifiedBar, { flex: 1, marginBottom: 0 }, isRTL && styles.rowReverse, inputFocused && styles.unifiedBarFocused]}>
              {/* Region chip */}
              <TouchableOpacity
                style={[styles.regionChip, isRTL && styles.rowReverse]}
                onPress={() => setShowRegionPicker(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="location" size={13} color={Colors.primary} />
                <Text style={[styles.regionChipText, !region && styles.regionChipPlaceholder]} numberOfLines={1}>
                  {region ? (language === "ar" ? region.ar : region.fr) : (isRTL ? "المنطقة" : "Région")}
                </Text>
                <Ionicons name="chevron-down" size={11} color={Colors.primary + "80"} />
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.barDivider} />

              {/* Drug name input or captured image thumb */}
              {capturedImage ? (
                <View style={[styles.thumbWrap, { marginLeft: 4, marginRight: 4 }]}>
                  <Image source={{ uri: capturedImage }} style={styles.thumb} />
                  <TouchableOpacity style={styles.thumbRemove} onPress={() => setCapturedImage(null)}>
                    <Ionicons name="close-circle" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TextInput
                  ref={inputRef}
                  style={[styles.textField, isRTL && styles.textRight]}
                  placeholder={isRTL ? "اكتب اسم الدواء..." : "Nom du médicament..."}
                  placeholderTextColor={Colors.light.textTertiary}
                  value={drugName}
                  onChangeText={setDrugName}
                  textAlign={isRTL ? "right" : "left"}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                />
              )}

              {drugName.length > 0 && !capturedImage && (
                <TouchableOpacity onPress={() => setDrugName("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={Colors.light.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Submit row */}
          <View style={styles.searchActions}>
            <TouchableOpacity
              style={[styles.submitBtn, { flex: 1 }, (!canSubmit || loading) && styles.submitBtnDisabled]}
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

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      )}

      {/* ─── ACTION GRID ─── */}
      <View style={styles.grid}>
        {/* Row 1: أقرب صيدلية | التمريض المنزلي */}
        <View style={styles.gridRow}>
          <TouchableOpacity style={[styles.card, { backgroundColor: "#E8F4FB" }]} onPress={goToNearest} activeOpacity={0.82}>
            <View style={[styles.cardAccent, { backgroundColor: Colors.primary }]} />
            <View style={[styles.cardIconCircle, { backgroundColor: Colors.primary + "1E" }]}>
              <MaterialCommunityIcons name="map-marker-radius" size={22} color={Colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: Colors.primary }, isRTL && styles.textRight]} numberOfLines={2}>
              {t("nearestPharmacy")}
            </Text>
            <Text style={[styles.cardDesc, isRTL && styles.textRight]} numberOfLines={2}>
              {t("nearestPharmacyDesc")}
            </Text>
            <View style={[styles.cardChevron, { backgroundColor: Colors.primary + "14" }]}>
              <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={12} color={Colors.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.card, styles.nurseCard]} onPress={goToFindDoctor} activeOpacity={0.82}>
            <View style={[styles.cardAccent, { backgroundColor: "#0D9488" }]} />

            {/* Title — elegant, on top of images */}
            <Text style={[styles.nurseCardTitle, isRTL && styles.textRight]} numberOfLines={2}>
              {isRTL ? "التمريض المنزلي\nوالرعاية الصحية" : "Soins à domicile\net infirmiers"}
            </Text>

            {/* Nurse images — female + male in medical uniform with stethoscope */}
            <Image
              source={require("@/assets/images/nurse-female.png")}
              style={styles.nurseImgFemale}
              resizeMode="contain"
            />
            <Image
              source={require("@/assets/images/nurse-male.png")}
              style={styles.nurseImgMale}
              resizeMode="contain"
            />

            <View style={[styles.cardChevron, { backgroundColor: "#0D948814" }]}>
              <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={12} color="#0D9488" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Row 2: صيدليات المداومة — full-width banner */}
        <TouchableOpacity style={styles.dutyCard} onPress={goToDutyAndPrice} activeOpacity={0.82}>
          <View style={[styles.cardAccent, { backgroundColor: "#3B5BDB" }]} />
          <View style={[styles.dutyCardInner, isRTL && styles.rowReverse]}>
            <View style={[styles.dutyIconCircle, { backgroundColor: "#3B5BDB15" }]}>
              <MaterialCommunityIcons name="moon-waning-crescent" size={28} color="#3B5BDB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dutyCardTitle, { color: "#3B5BDB" }, isRTL && styles.textRight]} numberOfLines={1}>
                {isRTL ? "صيدليات المداومة" : "Pharmacies de Garde"}
              </Text>
              <Text style={[styles.dutyCardDesc, isRTL && styles.textRight]} numberOfLines={1}>
                {isRTL ? "صيدليات مفتوحة الليل وأيام العطل" : "Ouvertes la nuit et les jours fériés"}
              </Text>
            </View>
            <View style={[styles.cardChevron, { backgroundColor: "#3B5BDB14", marginTop: 0 }]}>
              <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={12} color="#3B5BDB" />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* ─── PORTAL LINKS ─── */}
      <View style={[styles.portalRow, isRTL && styles.rowReverse]}>
        <TouchableOpacity
          style={[styles.portalLink, { flex: 1 }, isRTL && styles.rowReverse]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/pharmacy-portal"); }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="shield-key-outline" size={14} color={Colors.light.textTertiary} />
          <Text style={styles.portalLinkText}>
            {isRTL ? "بوابة الصيدليات" : "Portail Pharmacies"}
          </Text>
          <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={12} color={Colors.light.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.portalLink, styles.portalLinkCompany, { flex: 1 }, isRTL && styles.rowReverse]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/company-portal"); }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="domain" size={14} color="#7C3AED" />
          <Text style={[styles.portalLinkText, { color: "#7C3AED" }]}>
            {isRTL ? "بوابة الشركاء" : "Portail Partenaires"}
          </Text>
          <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={12} color="#7C3AED" />
        </TouchableOpacity>
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

      {/* ─── ADMIN PIN MODAL ─── */}
      <Modal visible={showAdminPinModal} transparent animationType="fade" onRequestClose={() => { setShowAdminPinModal(false); setAdminPinInput(""); }}>
        <View style={styles.adminPinOverlay}>
          <View style={styles.adminPinSheet}>
            {adminPinSuccess ? (
              <>
                <View style={[styles.adminPinIconWrap, { backgroundColor: Colors.accent + "18" }]}>
                  <Ionicons name="shield-checkmark" size={40} color={Colors.accent} />
                </View>
                <Text style={[styles.adminPinTitle, isRTL && styles.textRight]}>
                  {isRTL ? "تم التحقق بنجاح" : "Accès accordé"}
                </Text>
                <Text style={[styles.adminPinSub, isRTL && styles.textRight]}>
                  {isRTL ? "جارٍ الفتح..." : "Ouverture en cours..."}
                </Text>
              </>
            ) : (
              <>
                <View style={styles.adminPinIconWrap}>
                  <Ionicons name="shield" size={40} color={Colors.primary} />
                </View>
                <Text style={[styles.adminPinTitle, isRTL && styles.textRight]}>
                  {isRTL ? "رمز الدخول" : "Code d'accès"}
                </Text>
                <Text style={[styles.adminPinSub, isRTL && styles.textRight]}>
                  {isRTL ? "أدخل رمز الإدارة للمتابعة" : "Entrez le code administrateur"}
                </Text>
                <View style={[styles.adminPinRow, adminPinError && styles.adminPinRowError, isRTL && styles.rowReverse]}>
                  <Ionicons name="key-outline" size={20} color={adminPinError ? Colors.danger : Colors.light.textSecondary} />
                  <TextInput
                    ref={adminPinRef}
                    style={[styles.adminPinField, isRTL && styles.textRight]}
                    placeholder={isRTL ? "••••" : "••••"}
                    placeholderTextColor={Colors.light.textTertiary}
                    value={adminPinInput}
                    onChangeText={setAdminPinInput}
                    secureTextEntry
                    keyboardType="number-pad"
                    textAlign="center"
                    returnKeyType="go"
                    onSubmitEditing={handleAdminPinSubmit}
                    maxLength={10}
                  />
                </View>
                {adminPinError && (
                  <Text style={styles.adminPinErrorText}>
                    {isRTL ? "رمز غير صحيح" : "Code incorrect"}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.adminPinBtn, !adminPinInput.trim() && styles.adminPinBtnDisabled]}
                  onPress={handleAdminPinSubmit}
                  disabled={!adminPinInput.trim()}
                  activeOpacity={0.85}
                >
                  <Ionicons name="enter" size={18} color="#fff" />
                  <Text style={styles.adminPinBtnText}>{isRTL ? "دخول" : "Connexion"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adminPinCancel} onPress={() => { setShowAdminPinModal(false); setAdminPinInput(""); }} activeOpacity={0.7}>
                  <Text style={styles.adminPinCancelText}>{t("cancel")}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── SUCCESS MODAL ─── */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleNewSearch}
        statusBarTranslucent
      >
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            {/* Icon with ✓ badge */}
            <View style={styles.successIconWrap}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.successAppIcon}
                resizeMode="cover"
              />
              <View style={styles.successCheckBadge}>
                <Text style={styles.successCheckText}>✓</Text>
              </View>
            </View>

            <Text style={[styles.successModalTitle, isRTL && styles.textRight]}>
              {t("requestSent")}
            </Text>
            <Text style={[styles.successModalSub, isRTL && styles.textRight]}>
              {t("requestSentSubtitle")}
            </Text>

            <TouchableOpacity
              style={styles.successConfirmBtn}
              onPress={handleNewSearch}
              activeOpacity={0.85}
            >
              <Text style={styles.successConfirmText}>
                {isRTL ? "تأكيد" : "Confirmer"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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

  /* APP DESCRIPTION */
  appDescRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 5,
    paddingHorizontal: 4,
  },
  appDescText: {
    textAlign: "center",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.primary + "90",
    letterSpacing: 2.5,
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginBottom: 2,
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
  identityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  miniLogo: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    paddingBottom: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.32,
    shadowRadius: 7,
    elevation: 5,
  },
  miniLogoIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  miniLogoWrap: {
    position: "relative",
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  miniLogoRing: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    borderColor: "transparent",
  },
  adminBadgeDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.light.background,
  },
  adminPinOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  adminPinSheet: {
    backgroundColor: Colors.light.background,
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  adminPinIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  adminPinTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.light.text,
    textAlign: "center",
  },
  adminPinSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  adminPinRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.cardBackground,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    width: "100%",
  },
  adminPinRowError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.danger + "08",
  },
  adminPinField: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: Colors.light.text,
    letterSpacing: 8,
    textAlign: "center",
  },
  adminPinErrorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.danger,
    textAlign: "center",
  },
  adminPinBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    width: "100%",
    marginTop: 4,
  },
  adminPinBtnDisabled: { backgroundColor: Colors.light.textTertiary },
  adminPinBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#fff",
  },
  adminPinCancel: {
    paddingVertical: 10,
  },
  adminPinCancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  nameStack: {
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    lineHeight: 22,
  },
  frNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 1,
  },
  frDivider: {
    width: 18,
    height: 1.5,
    backgroundColor: Colors.primary,
    borderRadius: 1,
    opacity: 0.6,
  },
  headerFrName: {
    fontSize: 9.5,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
    letterSpacing: 3.5,
    opacity: 0.85,
  },
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

  /* SEARCH CARD */
  searchCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  searchCardLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },

  /* UNIFIED SMART BAR */
  unifiedBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.inputBackground,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    marginBottom: 8,
    minHeight: 52,
    overflow: "hidden",
  },
  unifiedBarFocused: {
    borderColor: Colors.primary + "60",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  regionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 110,
  },
  regionChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.primary,
    flexShrink: 1,
  },
  regionChipPlaceholder: { color: Colors.light.textTertiary, fontFamily: "Inter_400Regular" },
  barDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.light.border,
    marginHorizontal: 2,
  },
  cameraChip: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
  },
  cameraActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary + "12",
    borderWidth: 1.5,
    borderColor: Colors.primary + "30",
  },
  barCameraBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cameraSqBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary + "14",
    borderWidth: 1.5,
    borderColor: Colors.primary + "30",
    flexShrink: 0,
  },
  searchActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },

  textField: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.primary + "10",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.primary + "22",
  },
  gpsBtnText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11 },
  gpsIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary + "10",
    borderWidth: 1,
    borderColor: Colors.primary + "28",
  },
  drugPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    backgroundColor: "#FFF8E6",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: "#F0A500" + "55",
  },
  drugPhotoBtnEmoji: {
    fontSize: 15,
    lineHeight: 20,
  },
  drugPhotoBtnText: {
    color: "#B87000",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0.2,
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
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.13, shadowRadius: 8, elevation: 5,
    borderWidth: 1.2, borderColor: "rgba(0,0,0,0.08)",
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
  nurseCard: {
    backgroundColor: "#E0F5F1",
    overflow: "hidden",
    justifyContent: "flex-start",
    minHeight: 130,
  },
  nurseCardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 12.5,
    color: "#0A6B62",
    lineHeight: 18,
    paddingLeft: 8,
    paddingRight: 8,
    marginTop: 8,
    marginBottom: 0,
  },
  nurseImgFemale: {
    position: "absolute",
    right: 16,
    bottom: 0,
    width: 72,
    height: 90,
    opacity: 1,
  },
  nurseImgMale: {
    position: "absolute",
    right: -4,
    bottom: 0,
    width: 60,
    height: 76,
    opacity: 0.9,
  },
  nurseCardImg: {
    position: "absolute",
    right: -6,
    bottom: -4,
    width: 80,
    height: 80,
    opacity: 0.88,
  },
  doctorFemaleImg: {
    position: "absolute",
    right: 38,
    top: -4,
    width: 68,
    height: 68,
    opacity: 0.82,
  },
  doctorMaleImg: {
    position: "absolute",
    right: -4,
    top: -6,
    width: 78,
    height: 78,
    opacity: 0.95,
  },
  cardChevron: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  /* DUTY+PRICE FULL-WIDTH BANNER CARD */
  dutyCard: {
    backgroundColor: "#EEF4FD",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#1565C022",
    overflow: "hidden",
    shadowColor: "#1565C0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginTop: 4,
  },
  dutyCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dutyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dutyCardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    marginBottom: 3,
  },
  dutyCardDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },

  /* SEARCH HINT */
  searchHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: Colors.primary + "0D",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary + "22",
  },
  searchHintItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  searchHintText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  searchHintOr: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
  },

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

  portalRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  portalLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    marginTop: 2,
  },
  portalLinkCompany: {
    backgroundColor: "#7C3AED08",
    borderRadius: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#7C3AED18",
  },
  portalLinkText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
  },

  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  successModal: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  successIconWrap: {
    width: 88,
    height: 88,
    marginBottom: 20,
    position: "relative",
  },
  successAppIcon: {
    width: 88,
    height: 88,
    borderRadius: 20,
  },
  successCheckBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.30)",
    borderRadius: 20,
  },
  successCheckText: {
    fontSize: 38,
    color: "#fff",
    fontFamily: "Inter_700Bold",
    lineHeight: 44,
  },
  successModalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 10,
  },
  successModalSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  successConfirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  successConfirmText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
});
