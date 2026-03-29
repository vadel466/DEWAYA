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
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { REGIONS, getNearestRegion } from "@/constants/regions";
import { useApp } from "@/context/AppContext";
import { router } from "expo-router";

const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage, userId, lockedCount, region, setRegion, isAdmin, setIsAdmin } = useApp();
  const isRTL = language === "ar";
  const inputRef = useRef<TextInput>(null);

  const [drugName, setDrugName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [regionQuery, setRegionQuery] = useState("");
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
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "إذن الكاميرا مرفوض" : "Permission caméra refusée",
        isRTL ? "يُرجى الذهاب إلى الإعدادات والسماح باستخدام الكاميرا" : "Veuillez autoriser la caméra dans les paramètres"
      );
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: true, aspect: [4, 3], exif: false });
    if (!r.canceled && r.assets[0]) {
      setCapturedImage(r.assets[0].uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const openGallery = async () => {
    setShowImgMenu(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") {
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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "إذن المعرض مرفوض" : "Permission galerie refusée",
        isRTL ? "يُرجى الذهاب إلى الإعدادات والسماح بالوصول للمعرض" : "Veuillez autoriser la galerie dans les paramètres"
      );
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: true, exif: false });
    if (!r.canceled && r.assets[0]) {
      setCapturedImage(r.assets[0].uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleSearch = async () => {
    if (!drugName.trim() && !capturedImage) return;
    if (!userPhone.trim()) {
      setError(isRTL ? "يرجى إدخال رقم هاتفك أولاً" : "Veuillez entrer votre numéro de téléphone");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, drugName: drugName.trim() || t("imageDrug"), userPhone: userPhone.trim() }),
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
    setUserPhone("");
    setCapturedImage(null);
    setError(null);
  };

  const goToNearest = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/nearest-pharmacy");
  };

  const goToDutyDirect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/duty-pharmacies");
  };

  const goToDrugPrice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/drug-price");
  };

  const goToFindDoctor = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/find-doctor");
  };

  const filteredRegions = regionQuery.trim()
    ? REGIONS.filter((r) => r.ar.includes(regionQuery) || r.fr.toLowerCase().includes(regionQuery.toLowerCase()))
    : REGIONS;

  const canSubmit = drugName.trim().length > 0 || capturedImage !== null;
  const topPad   = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 80 : insets.bottom + 80;

  const ch = isRTL ? ("chevron-back-outline" as const) : ("chevron-forward-outline" as const);

  /* ── CARD DATA ── */
  const cards = [
    {
      id: "nursing",
      label: isRTL ? "التمريض المنزلي\nوالرعاية الصحية" : "Soins infirmiers\nà domicile",
      strip: "#00796B", iconBg: "#E0F2F1",
      mainIcon: "medical-bag" as const, mainColor: "#00796B",
      textColor: "#004D40", barBg: "#00796B14",
      onPress: goToFindDoctor,
    },
    {
      id: "drug",
      label: isRTL ? "سعر الدواء" : "Prix médicament",
      strip: "#E65100", iconBg: "#FFF3E0",
      mainIcon: "tag" as const, mainColor: "#E65100",
      textColor: "#BF360C", barBg: "#E6510014",
      onPress: goToDrugPrice,
    },
    {
      id: "duty",
      label: isRTL ? "صيدليات المداومة" : "Pharmacies de Garde",
      strip: "#283593", iconBg: "#E8EAF6",
      mainIcon: "weather-night" as const, mainColor: "#283593",
      textColor: "#1A237E", barBg: "#28359314",
      onPress: goToDutyDirect,
    },
    {
      id: "nearest",
      label: isRTL ? "أقرب صيدلية" : "Pharmacie la plus proche",
      strip: "#1565C0", iconBg: "#E3F2FD",
      mainIcon: "map-marker" as const, mainColor: "#1565C0",
      textColor: "#0D47A1", barBg: "#1565C014",
      onPress: goToNearest,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F4F8" }}>
      {/* ── SAFE-AREA TOP PAD ── */}
      <View style={{ height: topPad }} />

      {/* ── MAIN CONTENT (no scroll, fixed flex) ── */}
      <View style={[styles.screen, { paddingBottom: bottomPad }]}>

        {/* ════ HEADER ════ */}
        <View style={styles.header}>

          {/* Logo — centered absolutely in parent */}
          <TouchableOpacity
            style={styles.appIdentity}
            onPressIn={handleLogoPressIn}
            onPressOut={handleLogoPressOut}
            onLongPress={handleLogoLongPress}
            delayLongPress={5000}
            activeOpacity={0.9}
          >
            {/* Bubble + animated ring */}
            <View style={styles.logoGroup}>
              <Animated.View style={[styles.logoRing, {
                borderColor: logoProgress.interpolate({ inputRange: [0, 1], outputRange: [Colors.primary + "00", Colors.primary] }),
              }]} />
              <View style={styles.logoBubble}>
                <MaterialCommunityIcons name="stethoscope" size={20} color="#fff" />
              </View>
              {isAdmin && <View style={styles.adminDot} />}
            </View>

            {/* App name + tagline */}
            <View style={styles.appNameGroup}>
              <Text style={styles.appNameAr}>أدوايـا</Text>
              <Text style={styles.logoSubText}>D E W A Y A</Text>
              <Text style={styles.sloganText}>خدمة صحية متكاملة</Text>
            </View>
          </TouchableOpacity>

          {/* Bell — absolute, top-right corner, independent of logo */}
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/notifications"); }}
            activeOpacity={0.75}
          >
            <Ionicons name={lockedCount > 0 ? "notifications" : "notifications-outline"} size={20} color="#1A237E" />
            {lockedCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{lockedCount > 9 ? "9+" : String(lockedCount)}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Language toggle — compact, inside header */}
          <TouchableOpacity
            style={styles.langLineCompact}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLanguage(language === "ar" ? "fr" : "ar"); }}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={11} color="#90A4AE" />
            <Text style={styles.langLineCompactText}>العربية / Français</Text>
          </TouchableOpacity>

        </View>

        {/* ════ SEARCH CARD ════ */}
        <View style={styles.searchCard}>
          {/* Row 1 */}
          <View style={[styles.searchRow1, isRTL && styles.rowReverse]}>
            <TouchableOpacity onPress={() => setShowImgMenu(true)} activeOpacity={0.8}>
              {capturedImage ? (
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: capturedImage }} style={styles.thumb} />
                  <TouchableOpacity style={styles.thumbRemove} onPress={() => setCapturedImage(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cameraBtn}>
                  <Ionicons name="camera-outline" size={19} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>
            <Text style={[styles.searchRow1Label, isRTL && styles.textRight]} numberOfLines={1}>
              {isRTL ? "البحث عن دواء" : "Rechercher un médicament"}
            </Text>
            {/* Blue search button — opposite camera */}
            <TouchableOpacity
              style={[styles.searchQuickBtn, (!canSubmit || loading) && styles.searchQuickBtnDisabled]}
              onPress={handleSearch}
              activeOpacity={0.82}
              disabled={loading || !canSubmit}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="search" size={13} color="#fff" />
                  <Text style={styles.searchQuickText}>{isRTL ? "بحث" : "Chercher"}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.searchHDivider} />

          {/* Row 2 */}
          <View style={[styles.searchRow2, isRTL && styles.rowReverse]}>
            <TouchableOpacity
              style={[styles.regionChip, isRTL && styles.rowReverse]}
              onPress={() => setShowRegionPicker(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="location" size={12} color={Colors.primary} />
              <Text style={styles.regionChipText} numberOfLines={1}>
                {region ? (language === "ar" ? region.ar : region.fr) : (isRTL ? "المنطقة" : "Région")}
              </Text>
              <Ionicons name="chevron-down" size={11} color={Colors.primary + "99"} />
            </TouchableOpacity>
            <View style={styles.inputVDivider} />
            <TextInput
              ref={inputRef}
              style={[styles.drugInput, isRTL && styles.textRight]}
              placeholder={isRTL ? "أكتب اسم الدواء..." : "Nom du médicament..."}
              placeholderTextColor="#B0BEC5"
              value={drugName}
              onChangeText={setDrugName}
              textAlign={isRTL ? "right" : "left"}
              returnKeyType="send"
              onSubmitEditing={handleSearch}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />
            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginHorizontal: 10 }} />
            ) : drugName.length > 0 ? (
              <TouchableOpacity onPress={() => setDrugName("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginHorizontal: 10 }}>
                <Ionicons name="close-circle" size={16} color="#B0BEC5" />
              </TouchableOpacity>
            ) : canSubmit ? (
              <TouchableOpacity onPress={handleSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginHorizontal: 10 }}>
                <Ionicons name="paper-plane-outline" size={17} color={Colors.primary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {(drugName.length > 0 || capturedImage !== null) && (
            <>
              <View style={styles.searchHDivider} />
              {/* Row 3 — رقم الهاتف */}
              <View style={[styles.searchRow2, isRTL && styles.rowReverse]}>
                <Ionicons name="call-outline" size={15} color={Colors.primary} style={{ marginHorizontal: 10 }} />
                <TextInput
                  style={[styles.drugInput, isRTL && styles.textRight, { flex: 1 }]}
                  placeholder={isRTL ? "رقم هاتفك للدفع *" : "Votre numéro pour paiement *"}
                  placeholderTextColor="#B0BEC5"
                  value={userPhone}
                  onChangeText={setUserPhone}
                  keyboardType="phone-pad"
                  textAlign={isRTL ? "right" : "left"}
                />
                {userPhone.length > 0 && (
                  <TouchableOpacity onPress={() => setUserPhone("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginHorizontal: 10 }}>
                    <Ionicons name="close-circle" size={16} color="#B0BEC5" />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.phoneHint, isRTL && styles.textRight]}>
                {isRTL ? "⚠️ أدخل الرقم الذي ستُرسل منه الدفع" : "⚠️ Entrez le numéro depuis lequel vous enverrez le paiement"}
              </Text>
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {/* ════ PORTAL ROW ════ */}
        <View style={styles.portalRow}>
          <TouchableOpacity
            style={[styles.portalPharmacy, isRTL && styles.rowReverse]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/pharmacy-portal"); }}
            activeOpacity={0.82}
          >
            <Ionicons name={ch} size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.portalPharmacyText} numberOfLines={1}>
              {isRTL ? "بوابة الصيدليات" : "Portail Pharmacies"}
            </Text>
            <MaterialCommunityIcons name="store-plus-outline" size={15} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.portalPartner, isRTL && styles.rowReverse]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/company-portal"); }}
            activeOpacity={0.82}
          >
            <Ionicons name={ch} size={12} color="#7C3AED99" />
            <Text style={styles.portalPartnerText} numberOfLines={1}>
              {isRTL ? "بوابة الشركاء" : "Portail Partenaires"}
            </Text>
            <MaterialCommunityIcons name="domain" size={15} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        {/* ════ CARDS GRID — flex:1 fills remaining space ════ */}
        <View style={styles.cardsGrid}>
          {[cards.slice(0, 2), cards.slice(2, 4)].map((row, ri) => (
            <View key={ri} style={styles.cardsRow}>
              {row.map((c) => (
                <TouchableOpacity key={c.id} style={styles.card} onPress={c.onPress} activeOpacity={0.82}>
                  <View style={[styles.cardTopStrip, { backgroundColor: c.strip }]} />
                  {/* Single centered icon */}
                  <View style={styles.cardIconsArea}>
                    <View style={[styles.cardMainIconBox, { backgroundColor: c.iconBg }]}>
                      <MaterialCommunityIcons name={c.mainIcon} size={30} color={c.mainColor} />
                    </View>
                  </View>
                  {/* Label bar — no extra icons */}
                  <View style={[styles.cardBottomBar, { backgroundColor: c.barBg }]}>
                    <Text
                      style={[styles.cardBottomText, { color: c.textColor }]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {c.label}
                    </Text>
                    <Ionicons name={ch} size={13} color={c.strip} style={{ flexShrink: 0 }} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {/* ════ FOOTER ════ */}
        <TouchableOpacity
          style={styles.aboutLink}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/about"); }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="information-outline" size={12} color="#90A4AE" />
          <Text style={styles.aboutLinkText}>
            {isRTL ? "عن دواية • سياسة الخصوصية" : "À propos de Dewaya • Confidentialité"}
          </Text>
        </TouchableOpacity>
        <View style={styles.sourceRow}>
          <Text style={styles.sourceFlag}>🇲🇷</Text>
          <Text style={styles.sourceText}>
            {isRTL ? "جميع البيانات في دوايا مستمدة من المصادر الصحية الرسمية في موريتانيا" : "Toutes les données de Dewaya proviennent des sources sanitaires officielles en Mauritanie"}
          </Text>
        </View>

      </View>

      {/* ════ MODALS ════ */}

      {/* Region picker */}
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

      {/* Image source menu */}
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

      {/* Admin PIN */}
      <Modal visible={showAdminPinModal} transparent animationType="fade" onRequestClose={() => { setShowAdminPinModal(false); setAdminPinInput(""); }}>
        <View style={styles.adminPinOverlay}>
          <View style={styles.adminPinSheet}>
            {adminPinSuccess ? (
              <>
                <View style={[styles.adminPinIconWrap, { backgroundColor: Colors.accent + "18" }]}>
                  <Ionicons name="shield-checkmark" size={40} color={Colors.accent} />
                </View>
                <Text style={[styles.adminPinTitle, isRTL && styles.textRight]}>{isRTL ? "تم التحقق بنجاح" : "Accès accordé"}</Text>
                <Text style={[styles.adminPinSub, isRTL && styles.textRight]}>{isRTL ? "جارٍ الفتح..." : "Ouverture en cours..."}</Text>
              </>
            ) : (
              <>
                <View style={styles.adminPinIconWrap}>
                  <Ionicons name="shield" size={40} color={Colors.primary} />
                </View>
                <Text style={[styles.adminPinTitle, isRTL && styles.textRight]}>{isRTL ? "رمز الدخول" : "Code d'accès"}</Text>
                <Text style={[styles.adminPinSub, isRTL && styles.textRight]}>{isRTL ? "أدخل رمز الإدارة للمتابعة" : "Entrez le code administrateur"}</Text>
                <View style={[styles.adminPinRow, adminPinError && styles.adminPinRowError, isRTL && styles.rowReverse]}>
                  <Ionicons name="key-outline" size={20} color={adminPinError ? Colors.danger : Colors.light.textSecondary} />
                  <TextInput
                    ref={adminPinRef}
                    style={[styles.adminPinField, isRTL && styles.textRight]}
                    placeholder="••••"
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
                {adminPinError && <Text style={styles.adminPinErrorText}>{isRTL ? "رمز غير صحيح" : "Code incorrect"}</Text>}
                <TouchableOpacity style={[styles.adminPinBtn, !adminPinInput.trim() && styles.adminPinBtnDisabled]} onPress={handleAdminPinSubmit} disabled={!adminPinInput.trim()} activeOpacity={0.85}>
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

      {/* Success modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={handleNewSearch} statusBarTranslucent>
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconWrap}>
              <Image source={require("@/assets/images/icon.png")} style={styles.successAppIcon} resizeMode="cover" />
              <View style={styles.successCheckBadge}>
                <Text style={styles.successCheckText}>✓</Text>
              </View>
            </View>
            <Text style={[styles.successModalTitle, isRTL && styles.textRight]}>{t("requestSent")}</Text>
            <Text style={[styles.successModalSub, isRTL && styles.textRight]}>{t("requestSentSubtitle")}</Text>
            <TouchableOpacity style={styles.successConfirmBtn} onPress={handleNewSearch} activeOpacity={0.85}>
              <Text style={styles.successConfirmText}>{isRTL ? "تأكيد" : "Confirmer"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

/* ══════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  rowReverse: { flexDirection: "row-reverse" },
  textRight: { textAlign: "right", writingDirection: "rtl" },

  screen: {
    flex: 1,
    paddingHorizontal: 14,
  },

  /* HEADER — logo centered, bell absolute top-right */
  header: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    marginBottom: 4,
    minHeight: 56,
  },
  bellBtn: {
    position: "absolute",
    right: 0,
    top: 6,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#E8EDF3",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3,
    elevation: 2,
  },
  bellBadge: {
    position: "absolute", top: -2, right: -2,
    minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 2,
    borderWidth: 1.5, borderColor: "#F0F4F8",
  },
  bellBadgeText: { color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold", lineHeight: 10 },

  /* Logo identity row — icon + text, centered */
  appIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoGroup: {
    width: 44, height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  logoRing: {
    position: "absolute", top: -3, left: -3,
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 2, borderColor: "transparent",
  },
  logoBubble: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 6,
    elevation: 4,
  },
  adminDot: {
    position: "absolute", bottom: 1, right: 0,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: Colors.accent, borderWidth: 2, borderColor: "#F0F4F8",
  },
  appNameGroup: { alignItems: "flex-start", gap: 0 },
  appNameAr: { fontFamily: "Inter_700Bold", fontSize: 21, color: "#0D1B6E", letterSpacing: 0.3 },
  logoSubText: { fontFamily: "Inter_600SemiBold", fontSize: 8.5, color: "#546E7A", letterSpacing: 3.5 },
  sloganText: { fontFamily: "Inter_400Regular", fontSize: 9, color: "#90A4AE", letterSpacing: 0.2, marginTop: 1 },

  /* LANGUAGE LINE — compact, inside header */
  langLineCompact: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingTop: 3,
  },
  langLineCompactText: { fontFamily: "Inter_400Regular", fontSize: 11, color: "#90A4AE" },

  /* SEARCH CARD */
  searchCard: {
    backgroundColor: "#fff",
    borderRadius: 14, marginBottom: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 10,
    elevation: 4, overflow: "hidden",
    borderWidth: 1.5, borderColor: "#CFD8DC",
  },
  searchRow1: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  cameraBtn: {
    width: 44, height: 44, borderRadius: 11,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  searchRow1Label: {
    flex: 1, fontFamily: "Inter_500Medium", fontSize: 13.5, color: "#90A4AE", textAlign: "left",
  },
  searchHDivider: { height: 1, backgroundColor: "#CFD8DC" },
  searchRow2: { flexDirection: "row", alignItems: "center", minHeight: 42 },
  regionChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 10, paddingVertical: 12, minWidth: 95,
  },
  regionChipText: { fontFamily: "Inter_600SemiBold", fontSize: 11.5, color: Colors.primary, flexShrink: 1 },
  inputVDivider: { width: 1, height: 26, backgroundColor: "#CFD8DC" },
  drugInput: {
    flex: 1, fontFamily: "Inter_400Regular", fontSize: 13.5, color: "#37474F",
    paddingHorizontal: 10, paddingVertical: 12, textAlign: "left",
  },
  errorText: {
    color: Colors.danger, fontFamily: "Inter_400Regular", fontSize: 11.5,
    paddingHorizontal: 12, paddingBottom: 8, textAlign: "center",
  },
  phoneHint: {
    color: "#F59E0B", fontFamily: "Inter_400Regular", fontSize: 10.5,
    paddingHorizontal: 14, paddingBottom: 6, textAlign: "center",
  },

  /* QUICK SEARCH BUTTON (Row 1, opposite camera) */
  searchQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1565C0",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  searchQuickBtnDisabled: {
    backgroundColor: "#90CAF9",
  },
  searchQuickText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  thumbWrap: { width: 33, height: 33, borderRadius: 7, position: "relative", overflow: "visible" },
  thumb: { width: 33, height: 33, borderRadius: 7 },
  thumbRemove: { position: "absolute", top: -5, right: -5, backgroundColor: "#fff", borderRadius: 8 },

  /* PORTAL ROW */
  portalRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  portalPharmacy: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, backgroundColor: "#1B5E20", borderRadius: 12,
    paddingVertical: 7, paddingHorizontal: 8,
    shadowColor: "#1B5E20", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 2,
  },
  portalPharmacyText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff", textAlign: "center" },
  portalPartner: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, backgroundColor: "#F5F3FF", borderRadius: 12,
    paddingVertical: 7, paddingHorizontal: 8,
    borderWidth: 1.5, borderColor: "#7C3AED40",
    shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 4,
    elevation: 2,
  },
  portalPartnerText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#7C3AED", textAlign: "center" },

  /* CARDS GRID — flex layout fills remaining space */
  cardsGrid: {
    flex: 1,
    gap: 7,
    marginBottom: 4,
  },
  cardsRow: {
    flex: 1,
    flexDirection: "row",
    gap: 7,
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10,
    elevation: 5,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
  },
  cardTopStrip: { height: 4, width: "100%" },
  cardIconsArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  cardMainIconBox: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  cardBottomBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 9, gap: 4,
  },
  cardBottomText: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 12.5,
    lineHeight: 17,
    letterSpacing: 0.1,
    textAlign: "center",
  },

  /* FOOTER */
  aboutLink: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 5,
  },
  aboutLinkText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#90A4AE" },
  sourceRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, marginBottom: 2,
  },
  sourceFlag: { fontSize: 14, lineHeight: 17 },
  sourceText: { fontFamily: "Inter_400Regular", fontSize: 11, color: "#78909C" },

  /* REGION PICKER */
  pickerContainer: { flex: 1, backgroundColor: Colors.light.background },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  pickerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  pickerSearch: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.light.inputBackground, borderRadius: 12, marginHorizontal: 20, marginVertical: 12, paddingHorizontal: 14, paddingVertical: 10 },
  pickerSearchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.light.text },
  regionItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13 },
  regionItemIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primary + "12", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  regionItemAr: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  regionItemFr: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary },
  regionSep: { height: 1, backgroundColor: Colors.light.border },

  /* IMAGE MENU */
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  menuSheet: { backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12 },
  menuHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.light.border, alignSelf: "center", marginBottom: 14 },
  menuTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text, marginBottom: 14 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 14, marginBottom: 10, backgroundColor: Colors.light.card },
  menuItemIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  menuItemText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  menuCancel: { paddingVertical: 14, alignItems: "center", borderRadius: 14, backgroundColor: Colors.light.inputBackground, marginTop: 4 },
  menuCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary },

  /* ADMIN PIN */
  adminPinOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  adminPinSheet: { backgroundColor: Colors.light.background, borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, alignItems: "center", gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 20 },
  adminPinIconWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: Colors.primary + "14", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  adminPinTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.light.text, textAlign: "center" },
  adminPinSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20 },
  adminPinRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.card, borderWidth: 1.5, borderColor: Colors.light.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10, width: "100%" },
  adminPinRowError: { borderColor: Colors.danger, backgroundColor: Colors.danger + "08" },
  adminPinField: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 20, color: Colors.light.text, letterSpacing: 8, textAlign: "center" },
  adminPinErrorText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.danger, textAlign: "center" },
  adminPinBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, width: "100%", marginTop: 4 },
  adminPinBtnDisabled: { backgroundColor: Colors.light.textTertiary },
  adminPinBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  adminPinCancel: { paddingVertical: 10 },
  adminPinCancelText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.textSecondary },

  /* SUCCESS MODAL */
  successOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  successModal: { backgroundColor: "#fff", borderRadius: 24, paddingVertical: 36, paddingHorizontal: 28, alignItems: "center", width: "100%", maxWidth: 340, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 16 },
  successIconWrap: { width: 88, height: 88, marginBottom: 20, position: "relative" },
  successAppIcon: { width: 88, height: 88, borderRadius: 20 },
  successCheckBadge: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.30)", borderRadius: 20 },
  successCheckText: { fontSize: 38, color: "#fff", fontFamily: "Inter_700Bold", lineHeight: 44 },
  successModalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.light.text, textAlign: "center", marginBottom: 10 },
  successModalSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  successConfirmBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 48, alignItems: "center", justifyContent: "center", width: "100%" },
  successConfirmText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
});
