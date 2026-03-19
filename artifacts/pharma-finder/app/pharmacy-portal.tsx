import React, { useState, useEffect, useRef, useCallback } from "react";
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
  TextInput,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Animated,
  Vibration,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

type DrugRequest = {
  id: string;
  userId: string;
  drugName: string;
  status: string;
  createdAt: string;
};

type PharmacyInfo = {
  id: string;
  name: string;
  nameAr: string | null;
  address: string;
  phone: string;
  region: string | null;
};

function formatTime(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleString(lang === "ar" ? "ar-SA" : "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export default function PharmacyPortalScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";

  const [pin, setPin] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [pharmacy, setPharmacy] = useState<PharmacyInfo | null>(null);
  const [requests, setRequests] = useState<DrugRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [hasNewRequests, setHasNewRequests] = useState(false);
  const prevPendingCountRef = useRef<number>(-1);
  const vibrationActiveRef = useRef(false);
  const bellShake = useRef(new Animated.Value(0)).current;
  const bellLoop = useRef<Animated.CompositeAnimation | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bellRotate = bellShake.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-18deg", "0deg", "18deg"] });

  const stopBellAlert = useCallback(() => {
    bellLoop.current?.stop();
    bellShake.setValue(0);
    if (vibrationActiveRef.current) { Vibration.cancel(); vibrationActiveRef.current = false; }
    setHasNewRequests(false);
  }, [bellShake]);

  const startBellAlert = useCallback(() => {
    setHasNewRequests(true);
    bellLoop.current?.stop();
    bellLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(bellShake, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(bellShake, { toValue: -1, duration: 80, useNativeDriver: true }),
        Animated.timing(bellShake, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(bellShake, { toValue: -1, duration: 80, useNativeDriver: true }),
        Animated.timing(bellShake, { toValue: 0, duration: 80, useNativeDriver: true }),
        Animated.delay(800),
      ])
    );
    bellLoop.current.start();
    if (!vibrationActiveRef.current) {
      vibrationActiveRef.current = true;
      Vibration.vibrate([0, 400, 200, 400, 200, 400, 1500], true);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [bellShake]);

  useEffect(() => {
    if (!pharmacy) return;
    pollIntervalRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${API_BASE}/pharmacy-portal/requests`);
        if (!resp.ok) return;
        const data: DrugRequest[] = await resp.json();
        const pendingCount = data.filter((r) => r.status === "pending").length;
        if (prevPendingCountRef.current >= 0 && pendingCount > prevPendingCountRef.current) {
          startBellAlert();
          setRequests(data);
        }
        prevPendingCountRef.current = pendingCount;
      } catch {}
    }, 8000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      stopBellAlert();
    };
  }, [pharmacy]);

  const handleAuth = async () => {
    if (!pin.trim()) return;
    setAuthLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      if (!resp.ok) {
        Alert.alert(
          isRTL ? "خطأ في الرمز" : "Code incorrect",
          isRTL ? "رمز الدخول غير صحيح" : "Code d'accès incorrect"
        );
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      const data = await resp.json();
      setPharmacy(data);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchRequests();
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "حدث خطأ في الاتصال" : "Erreur de connexion");
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchRequests = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/requests`);
      if (resp.ok) {
        const data: DrugRequest[] = await resp.json();
        setRequests(data);
        if (prevPendingCountRef.current < 0) {
          prevPendingCountRef.current = data.filter((r) => r.status === "pending").length;
        }
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRespond = async (request: DrugRequest) => {
    if (!pharmacy) return;
    setRespondingId(request.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          pharmacyName: pharmacy.nameAr || pharmacy.name,
          pharmacyAddress: pharmacy.address,
          pharmacyPhone: pharmacy.phone,
        }),
      });
      if (resp.ok) {
        setRespondedIds((prev) => new Set([...prev, request.id]));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          isRTL ? "تم الإبلاغ" : "Signalé",
          isRTL
            ? "تم إبلاغ الإدارة بتوفر الدواء لديكم. سيتواصل معكم المدير قريباً."
            : "L'administration a été notifiée. Le gestionnaire vous contactera bientôt."
        );
      }
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "حدث خطأ" : "Une erreur s'est produite");
    } finally {
      setRespondingId(null);
    }
  };

  if (!pharmacy) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, isRTL && styles.rtlRow]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isRTL ? "بوابة الصيدليات" : "Portail Pharmacies"}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.loginIconWrap}>
            <MaterialCommunityIcons name="shield-key" size={52} color={Colors.primary} />
          </View>
          <Text style={[styles.loginTitle, isRTL && styles.rtlText]}>
            {isRTL ? "دخول الصيدليات" : "Accès Pharmacies"}
          </Text>
          <Text style={[styles.loginSub, isRTL && styles.rtlText]}>
            {isRTL
              ? "أدخل رمز الدخول الخاص بصيدليتك للوصول إلى الطلبات"
              : "Entrez le code d'accès de votre pharmacie pour voir les demandes"}
          </Text>

          <View style={[styles.pinInputRow, isRTL && styles.rtlRow]}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={Colors.light.textSecondary} style={styles.pinIcon} />
            <TextInput
              style={[styles.pinInput, isRTL && styles.rtlText]}
              placeholder={isRTL ? "رمز الدخول" : "Code d'accès"}
              placeholderTextColor={Colors.light.textTertiary}
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              autoCapitalize="none"
              keyboardType="default"
              textAlign={isRTL ? "right" : "left"}
              returnKeyType="go"
              onSubmitEditing={handleAuth}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, (!pin.trim() || authLoading) && styles.loginBtnDisabled]}
            onPress={handleAuth}
            disabled={!pin.trim() || authLoading}
            activeOpacity={0.85}
          >
            {authLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="enter" size={18} color="#fff" />
                  <Text style={styles.loginBtnText}>{isRTL ? "دخول" : "Connexion"}</Text>
                </>
            }
          </TouchableOpacity>

          <Text style={[styles.loginHint, isRTL && styles.rtlText]}>
            {isRTL
              ? "رمز الدخول يُوفَّر من قِبَل إدارة أدواي"
              : "Le code est fourni par l'administration DEWAYA"}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === "pending" && !respondedIds.has(r.id));
  const myResponded = requests.filter((r) => respondedIds.has(r.id));

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <View style={[styles.headerTitleWrap, isRTL && { alignItems: "flex-end" }]}>
          <Text style={styles.headerTitle}>
            {isRTL && pharmacy.nameAr ? pharmacy.nameAr : pharmacy.name}
          </Text>
          <Text style={styles.headerSub}>
            {isRTL ? "بوابة الصيدلية" : "Portail Pharmacie"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {hasNewRequests && (
            <TouchableOpacity onPress={stopBellAlert} style={styles.bellAlertBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Animated.View style={{ transform: [{ rotate: bellRotate }] }}>
                <Ionicons name="notifications" size={22} color={Colors.warning} />
              </Animated.View>
              <View style={styles.bellAlertDot} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => { setPharmacy(null); setPin(""); setRespondedIds(new Set()); stopBellAlert(); prevPendingCountRef.current = -1; }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="log-out-outline" size={22} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.pharmacyBanner, isRTL && styles.rtlRow]}>
        <MaterialCommunityIcons name="hospital-building" size={18} color={Colors.primary} />
        <Text style={[styles.bannerText, isRTL && styles.rtlText]}>
          {pharmacy.address}
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${pharmacy.phone}`)}>
          <Ionicons name="call-outline" size={18} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{isRTL ? "جارٍ التحميل..." : "Chargement..."}</Text>
        </View>
      ) : (
        <FlatList
          data={pendingRequests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            pendingRequests.length === 0 && styles.emptyList,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchRequests(true)}
              tintColor={Colors.primary}
            />
          }
          ListHeaderComponent={
            myResponded.length > 0 ? (
              <View style={styles.respondedBanner}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
                <Text style={styles.respondedBannerText}>
                  {isRTL
                    ? `أبلغتم عن توفر ${myResponded.length} دواء`
                    : `${myResponded.length} médicament(s) signalé(s) disponible`}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isResponding = respondingId === item.id;
            return (
              <View style={styles.requestCard}>
                <View style={[styles.requestCardHeader, isRTL && styles.rtlRow]}>
                  <View style={styles.pillIcon}>
                    <MaterialCommunityIcons name="pill" size={20} color={Colors.accent} />
                  </View>
                  <View style={[styles.requestInfo, isRTL && { alignItems: "flex-end" }]}>
                    <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.drugName}</Text>
                    <Text style={[styles.requestTime, isRTL && styles.rtlText]}>
                      {formatTime(item.createdAt, language)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.availableBtn, isResponding && { opacity: 0.7 }]}
                  onPress={() => handleRespond(item)}
                  disabled={isResponding}
                  activeOpacity={0.85}
                >
                  {isResponding
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <Text style={styles.availableBtnText}>
                          {isRTL ? "متوفر لدينا" : "Disponible chez nous"}
                        </Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="check-circle-outline" size={64} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                {isRTL ? "لا توجد طلبات جديدة" : "Aucune demande pour l'instant"}
              </Text>
              <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
                {isRTL ? "ارسحب للأعلى للتحديث" : "Tirez pour actualiser"}
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
  logoutBtn: { padding: 4 },

  loginContainer: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  loginIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  loginTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.light.text },
  loginSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 21 },
  pinInputRow: {
    flexDirection: "row", alignItems: "center",
    width: "100%", backgroundColor: Colors.light.inputBackground,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 2,
    borderWidth: 1.5, borderColor: Colors.light.border,
  },
  pinIcon: { marginRight: 8 },
  pinInput: {
    flex: 1, height: 52, fontSize: 16, fontFamily: "Inter_500Medium",
    color: Colors.light.text, letterSpacing: 2,
  },
  loginBtn: {
    width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  loginBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  loginHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center" },

  pharmacyBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primary + "0D",
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, padding: 12,
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.text },

  respondedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.accent + "12", borderRadius: 12, padding: 12, marginBottom: 12,
  },
  respondedBannerText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.accent },

  list: { padding: 16, gap: 10 },
  emptyList: { flex: 1 },

  requestCard: {
    backgroundColor: Colors.light.card, borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  requestCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  pillIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.accent + "18", alignItems: "center", justifyContent: "center",
  },
  requestInfo: { flex: 1 },
  drugName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  requestTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },

  availableBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  availableBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center", lineHeight: 19 },

  bellAlertBtn: { position: "relative", padding: 4 },
  bellAlertDot: {
    position: "absolute", top: 2, right: 2,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.warning, borderWidth: 1, borderColor: "#fff",
  },
});
