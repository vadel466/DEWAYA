import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { router } from "expo-router";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage, userId } = useApp();
  const [drugName, setDrugName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const isRTL = language === "ar";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const openCamera = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === "web") {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
      }
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "إذن الكاميرا مرفوض" : "Permission caméra refusée",
        isRTL
          ? "يُرجى السماح للتطبيق باستخدام الكاميرا من إعدادات هاتفك"
          : "Veuillez autoriser l'application à utiliser la caméra dans les paramètres de votre téléphone"
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

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
        isRTL
          ? "يُرجى السماح للتطبيق بالوصول إلى معرض الصور"
          : "Veuillez autoriser l'application à accéder à la galerie"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
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
          drugName: drugName.trim() || (isRTL ? "صورة علبة دواء" : "Image de médicament"),
        }),
      });
      if (!resp.ok) throw new Error("Failed");
      await resp.json();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();
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
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
  };

  const canSubmit = drugName.trim().length > 0 || capturedImage !== null;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.langButton}
            onPress={() => setLanguage(language === "ar" ? "fr" : "ar")}
            activeOpacity={0.7}
          >
            <Text style={styles.langText}>{t("changeLanguage")}</Text>
          </TouchableOpacity>
        </View>

        {/* Logo & Title */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="medical-bag" size={48} color={Colors.primary} />
            <View style={styles.caduceusWrapper}>
              <MaterialCommunityIcons name="snake" size={26} color={Colors.accent} />
            </View>
          </View>
          <Text style={[styles.appName, isRTL && styles.rtlText]}>{t("appName")}</Text>
          <Text style={[styles.appNameSub, isRTL && styles.rtlText]}>{t("appNameSub")}</Text>
          <Text style={[styles.tagline, isRTL && styles.rtlText]}>{t("appTagline")}</Text>
        </View>

        {!submitted ? (
          <View style={styles.searchSection}>
            <View style={styles.card}>
              <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>{t("searchTitle")}</Text>

              {/* حقل اسم الدواء */}
              <View style={[styles.inputRow, isRTL && styles.rtlRow]}>
                <Ionicons name="search-outline" size={20} color={Colors.light.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, isRTL && styles.rtlInput]}
                  placeholder={t("searchPlaceholder")}
                  placeholderTextColor={Colors.light.textTertiary}
                  value={drugName}
                  onChangeText={setDrugName}
                  textAlign={isRTL ? "right" : "left"}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                {drugName.length > 0 && (
                  <TouchableOpacity onPress={() => setDrugName("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* فاصل */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t("orText")}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* صورة مُلتقطة */}
              {capturedImage ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: capturedImage }} style={styles.imagePreview} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => setCapturedImage(null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={26} color="#EF4444" />
                  </TouchableOpacity>
                  <View style={styles.imageReadyBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
                    <Text style={styles.imageReadyText}>
                      {isRTL ? "الصورة جاهزة" : "Image prête"}
                    </Text>
                  </View>
                </View>
              ) : (
                /* أزرار الكاميرا والمعرض */
                <View style={[styles.cameraRow, isRTL && styles.rtlRow]}>
                  <TouchableOpacity
                    style={styles.cameraBtn}
                    onPress={openCamera}
                    activeOpacity={0.75}
                  >
                    <View style={styles.cameraBtnIcon}>
                      <Ionicons name="camera" size={22} color={Colors.primary} />
                    </View>
                    <Text style={[styles.cameraBtnText, isRTL && styles.rtlText]}>
                      {isRTL ? "تصوير العلبة" : "Photo de la boîte"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.galleryBtn}
                    onPress={openGallery}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.cameraBtnIcon, { backgroundColor: Colors.accent + "18" }]}>
                      <Ionicons name="images" size={22} color={Colors.accent} />
                    </View>
                    <Text style={[styles.galleryBtnText, isRTL && styles.rtlText]}>
                      {isRTL ? "من المعرض" : "Depuis la galerie"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[styles.searchButton, !canSubmit && styles.searchButtonDisabled]}
                onPress={handleSearch}
                activeOpacity={0.85}
                disabled={!canSubmit || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="search" size={20} color="#fff" />
                    <Text style={styles.searchButtonText}>{t("searchButton")}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Animated.View style={[styles.successCard, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.successIconWrapper}>
              <Ionicons name="checkmark-circle" size={64} color={Colors.accent} />
            </View>
            <Text style={[styles.successTitle, isRTL && styles.rtlText]}>{t("requestSent")}</Text>
            <Text style={[styles.successSubtitle, isRTL && styles.rtlText]}>{t("requestSentSubtitle")}</Text>

            <View style={styles.pillChip}>
              <MaterialCommunityIcons name="pill" size={16} color={Colors.primary} />
              <Text style={styles.pillText}>
                {drugName || (isRTL ? "صورة علبة دواء" : "Image de médicament")}
              </Text>
            </View>

            <TouchableOpacity style={styles.newSearchButton} onPress={handleNewSearch} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.newSearchText}>{t("newSearch")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewNotifButton}
              onPress={() => router.push("/(tabs)/notifications")}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={18} color="#fff" />
              <Text style={styles.viewNotifText}>{t("notifications")}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: Platform.OS === "web" ? 34 : 20 },
  header: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 12 },
  langButton: {
    backgroundColor: Colors.light.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.light.border,
    shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 2,
  },
  langText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  logoSection: { alignItems: "center", paddingVertical: 28 },
  logoContainer: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.accentLight,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
    borderWidth: 3, borderColor: Colors.accent + "30",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  caduceusWrapper: {
    position: "absolute", bottom: 8, right: 8, backgroundColor: Colors.primary,
    borderRadius: 12, width: 26, height: 26, alignItems: "center", justifyContent: "center",
  },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.light.text, marginBottom: 2 },
  appNameSub: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary, letterSpacing: 2, marginBottom: 6 },
  tagline: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  searchSection: { flex: 1 },
  card: {
    backgroundColor: Colors.light.card, borderRadius: 20, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  cardTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.light.text, marginBottom: 18, textAlign: "center" },
  inputRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.inputBackground,
    borderRadius: 12, paddingHorizontal: 14, borderWidth: 1.5, borderColor: "transparent", marginBottom: 4,
  },
  rtlRow: { flexDirection: "row-reverse" },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.light.text },
  rtlInput: { textAlign: "right" },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.light.border },
  dividerText: { marginHorizontal: 12, color: Colors.light.textTertiary, fontFamily: "Inter_500Medium", fontSize: 12 },

  cameraRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  cameraBtn: {
    flex: 1, alignItems: "center", borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.primary + "50", borderStyle: "dashed",
    paddingVertical: 14, backgroundColor: Colors.primary + "08", gap: 6,
  },
  galleryBtn: {
    flex: 1, alignItems: "center", borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.accent + "50", borderStyle: "dashed",
    paddingVertical: 14, backgroundColor: Colors.accent + "06", gap: 6,
  },
  cameraBtnIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + "18",
    alignItems: "center", justifyContent: "center",
  },
  cameraBtnText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "center" },
  galleryBtnText: { color: Colors.accent, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "center" },

  imagePreviewWrap: { borderRadius: 14, overflow: "hidden", marginBottom: 16, position: "relative" },
  imagePreview: { width: "100%", height: 180, borderRadius: 14 },
  removeImageBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "#fff", borderRadius: 13 },
  imageReadyBadge: {
    position: "absolute", bottom: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  imageReadyText: { color: Colors.accent, fontFamily: "Inter_600SemiBold", fontSize: 12 },

  errorText: { color: Colors.danger, textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 14, marginBottom: 8 },
  searchButton: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  searchButtonDisabled: { backgroundColor: Colors.light.textTertiary, shadowOpacity: 0, elevation: 0 },
  searchButtonText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },

  successCard: {
    backgroundColor: Colors.light.card, borderRadius: 24, padding: 30, alignItems: "center", marginTop: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  successIconWrapper: { marginBottom: 16 },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.light.text, marginBottom: 10, textAlign: "center" },
  successSubtitle: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 20 },
  pillChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.accentLight, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 24 },
  pillText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  newSearchButton: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary, marginBottom: 12, width: "100%", justifyContent: "center",
  },
  newSearchText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  viewNotifButton: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 12, backgroundColor: Colors.primary, width: "100%", justifyContent: "center",
  },
  viewNotifText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
