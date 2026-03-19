import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  Linking, RefreshControl, Platform, TextInput, Alert, KeyboardAvoidingView,
  ScrollView, Animated, Vibration, Modal,
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

type DrugRequest = { id: string; userId: string; drugName: string; status: string; createdAt: string };
type PharmacyInfo = { id: string; name: string; nameAr: string | null; address: string; phone: string; region: string | null; b2bEnabled: boolean };
type PharmacyListItem = { id: string; name: string; nameAr: string | null; address: string; region: string | null; phone: string; b2bEnabled: boolean };
type InventoryItem = { id: string; pharmacyId: string; drugName: string; notes: string | null; createdAt: string };
type B2bMessage = { id: string; pharmacyId: string; pharmacyName: string; message: string; type: string; adminStatus: string; createdAt: string };

function formatTime(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleString(lang === "ar" ? "ar-SA" : "fr-FR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

type PortalTab = "requests" | "repeater" | "b2b";

export default function PharmacyPortalScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";

  const [step, setStep] = useState<"code" | "pick" | "dashboard">("code");
  const [pin, setPin] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [pharmacyList, setPharmacyList] = useState<PharmacyListItem[]>([]);
  const [pharmacySearch, setPharmacySearch] = useState("");
  const [pharmacy, setPharmacy] = useState<PharmacyInfo | null>(null);

  const [requests, setRequests] = useState<DrugRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<PortalTab>("requests");
  const [hasNewRequests, setHasNewRequests] = useState(false);
  const prevPendingCountRef = useRef<number>(-1);
  const vibrationActiveRef = useRef(false);
  const bellShake = useRef(new Animated.Value(0)).current;
  const bellLoop = useRef<Animated.CompositeAnimation | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bellRotate = bellShake.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-18deg", "0deg", "18deg"] });

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [showRepeaterModal, setShowRepeaterModal] = useState(false);
  const [repeaterDrug, setRepeaterDrug] = useState("");
  const [repeaterNotes, setRepeaterNotes] = useState("");
  const [repeaterSaving, setRepeaterSaving] = useState(false);

  const [b2bMessages, setB2bMessages] = useState<B2bMessage[]>([]);
  const [b2bLoading, setB2bLoading] = useState(false);
  const [showB2bModal, setShowB2bModal] = useState(false);
  const [b2bText, setB2bText] = useState("");
  const [b2bType, setB2bType] = useState<"order" | "inquiry">("order");
  const [b2bSending, setB2bSending] = useState(false);

  const stopBellAlert = useCallback(() => {
    bellLoop.current?.stop(); bellShake.setValue(0);
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
    if (!vibrationActiveRef.current) { vibrationActiveRef.current = true; Vibration.vibrate([0, 400, 200, 400, 200, 400, 1500], true); }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [bellShake]);

  useEffect(() => {
    if (!pharmacy) return;
    fetchRequests();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${API_BASE}/pharmacy-portal/requests`);
        if (!resp.ok) return;
        const data: DrugRequest[] = await resp.json();
        const cnt = data.filter(r => r.status === "pending").length;
        if (prevPendingCountRef.current >= 0 && cnt > prevPendingCountRef.current) { startBellAlert(); setRequests(data); }
        prevPendingCountRef.current = cnt;
      } catch {}
    }, 8000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); stopBellAlert(); };
  }, [pharmacy]);

  const handleCodeSubmit = async () => {
    if (!pin.trim()) return;
    setAuthLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/auth`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      if (!resp.ok) {
        Alert.alert(isRTL ? "رمز غير صحيح" : "Code incorrect", isRTL ? "تأكد من الرمز وأعد المحاولة" : "Vérifiez le code et réessayez");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      const data = await resp.json();
      if (data.pharmacyList) {
        setPharmacyList(data.pharmacyList);
        setStep("pick");
      } else {
        setPharmacy(data);
        setStep("dashboard");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally { setAuthLoading(false); }
  };

  const handlePickPharmacy = async (item: PharmacyListItem) => {
    setAuthLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/auth`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim(), pharmacyId: item.id }),
      });
      if (!resp.ok) { Alert.alert(isRTL ? "خطأ" : "Erreur"); return; }
      const data = await resp.json();
      setPharmacy(data);
      setStep("dashboard");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {} finally { setAuthLoading(false); }
  };

  const fetchRequests = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/requests`);
      if (resp.ok) {
        const data: DrugRequest[] = await resp.json();
        setRequests(data);
        if (prevPendingCountRef.current < 0) prevPendingCountRef.current = data.filter(r => r.status === "pending").length;
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  const fetchInventory = async () => {
    if (!pharmacy) return;
    setInventoryLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/inventory/${pharmacy.id}`);
      if (resp.ok) setInventory(await resp.json());
    } catch {} finally { setInventoryLoading(false); }
  };

  const fetchB2b = async () => {
    if (!pharmacy) return;
    setB2bLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/b2b/pharmacy/${pharmacy.id}`);
      if (resp.ok) setB2bMessages(await resp.json());
    } catch {} finally { setB2bLoading(false); }
  };

  useEffect(() => {
    if (activeTab === "repeater") fetchInventory();
    else if (activeTab === "b2b") fetchB2b();
  }, [activeTab]);

  const handleRespond = async (request: DrugRequest) => {
    if (!pharmacy) return;
    setRespondingId(request.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/respond`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, pharmacyId: pharmacy.id, pharmacyName: pharmacy.nameAr || pharmacy.name, pharmacyAddress: pharmacy.address, pharmacyPhone: pharmacy.phone }),
      });
      if (resp.ok) {
        setRespondedIds(prev => new Set([...prev, request.id]));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          isRTL ? "✅ تم الإرسال" : "✅ Signalé",
          isRTL ? "تم إبلاغ الإدارة. ستتواصل مع المريض بعد موافقتها." : "L'administration est notifiée. Elle contactera le patient après validation."
        );
      } else if ((await resp.json())?.error?.includes("Déjà")) {
        Alert.alert(isRTL ? "تنبيه" : "Info", isRTL ? "لقد أبلغتم عن هذا الطلب مسبقاً" : "Vous avez déjà signalé cette demande");
      }
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Erreur");
    } finally { setRespondingId(null); }
  };

  const handleRepeaterSave = async () => {
    if (!pharmacy || !repeaterDrug.trim()) return;
    setRepeaterSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/inventory`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pharmacyId: pharmacy.id, pharmacyName: pharmacy.nameAr || pharmacy.name, pharmacyAddress: pharmacy.address, pharmacyPhone: pharmacy.phone, drugName: repeaterDrug.trim(), notes: repeaterNotes.trim() || null }),
      });
      if (resp.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRepeaterDrug(""); setRepeaterNotes("");
        setShowRepeaterModal(false);
        fetchInventory();
      }
    } catch {} finally { setRepeaterSaving(false); }
  };

  const handleRemoveInventory = async (id: string) => {
    try {
      await fetch(`${API_BASE}/pharmacy-portal/inventory/${id}`, { method: "DELETE" });
      setInventory(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  const handleSendB2b = async () => {
    if (!pharmacy || !b2bText.trim()) return;
    setB2bSending(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/b2b`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pharmacyId: pharmacy.id, pharmacyName: pharmacy.nameAr || pharmacy.name, message: b2bText.trim(), type: b2bType }),
      });
      if (resp.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setB2bText(""); setShowB2bModal(false); fetchB2b();
        Alert.alert(isRTL ? "تم الإرسال" : "Envoyé", isRTL ? "طلبك في انتظار موافقة الإدارة" : "Votre demande attend la validation de l'administration");
      }
    } catch {} finally { setB2bSending(false); }
  };

  const doLogout = () => {
    setPharmacy(null); setPin(""); setRespondedIds(new Set()); stopBellAlert();
    prevPendingCountRef.current = -1; setStep("code"); setPharmacyList([]);
    setRequests([]); setInventory([]); setB2bMessages([]); setActiveTab("requests");
  };

  const filteredPharmacies = pharmacyList.filter(p =>
    !pharmacySearch.trim() ||
    p.name.toLowerCase().includes(pharmacySearch.toLowerCase()) ||
    (p.nameAr && p.nameAr.includes(pharmacySearch)) ||
    (p.region && p.region.toLowerCase().includes(pharmacySearch.toLowerCase()))
  );

  const pendingRequests = requests.filter(r => r.status === "pending" && !respondedIds.has(r.id));
  const myResponded = requests.filter(r => respondedIds.has(r.id));

  const TABS: { id: PortalTab; label: string; icon: any }[] = [
    { id: "requests", label: isRTL ? `الطلبات${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ""}` : `Demandes${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ""}`, icon: "pill" },
    { id: "repeater", label: isRTL ? "ريبتير" : "Répéteur", icon: "repeat" },
    ...(pharmacy?.b2bEnabled ? [{ id: "b2b" as PortalTab, label: "B2B", icon: "briefcase-outline" }] : []),
  ];

  if (step === "code") {
    return (
      <KeyboardAvoidingView style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, isRTL && styles.rtlRow]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isRTL ? "بوابة الصيدليات" : "Portail Pharmacies"}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.loginIconWrap}>
            <MaterialCommunityIcons name="shield-key" size={52} color={Colors.primary} />
          </View>
          <Text style={[styles.loginTitle, isRTL && styles.rtlText]}>{isRTL ? "دخول الصيدليات" : "Accès Pharmacies"}</Text>
          <Text style={[styles.loginSub, isRTL && styles.rtlText]}>
            {isRTL ? "أدخل رمز الصيدلية الموحد للوصول إلى لوحة التحكم" : "Entrez le code d'accès pharmacie pour accéder au tableau de bord"}
          </Text>

          <View style={styles.codeHintBox}>
            <Ionicons name="information-circle" size={18} color={Colors.primary} />
            <Text style={[styles.codeHintText, isRTL && styles.rtlText]}>
              {isRTL ? "رمز الصيدلية: DV2026" : "Code pharmacie: DV2026"}
            </Text>
          </View>

          <View style={[styles.pinInputRow, isRTL && styles.rtlRow]}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={Colors.light.textSecondary} style={styles.pinIcon} />
            <TextInput
              style={[styles.pinInput, isRTL && styles.rtlText]}
              placeholder={isRTL ? "رمز الصيدلية" : "Code pharmacie"}
              placeholderTextColor={Colors.light.textTertiary}
              value={pin} onChangeText={setPin}
              autoCapitalize="characters" keyboardType="default"
              textAlign={isRTL ? "right" : "left"}
              returnKeyType="go" onSubmitEditing={handleCodeSubmit}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, (!pin.trim() || authLoading) && styles.loginBtnDisabled]}
            onPress={handleCodeSubmit} disabled={!pin.trim() || authLoading} activeOpacity={0.85}
          >
            {authLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Ionicons name="enter" size={18} color="#fff" /><Text style={styles.loginBtnText}>{isRTL ? "دخول" : "Connexion"}</Text></>
            }
          </TouchableOpacity>
          <Text style={[styles.loginHint, isRTL && styles.rtlText]}>
            {isRTL ? "رمز الدخول موحد لجميع الصيدليات المسجلة في DEWAYA" : "Code unique pour toutes les pharmacies enregistrées dans DEWAYA"}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (step === "pick") {
    return (
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <View style={[styles.header, isRTL && styles.rtlRow]}>
          <TouchableOpacity onPress={() => setStep("code")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isRTL ? "اختر صيدليتك" : "Choisissez votre pharmacie"}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.light.textTertiary} />
          <TextInput
            style={[styles.searchInput, isRTL && styles.rtlText]}
            placeholder={isRTL ? "ابحث عن صيدليتك..." : "Rechercher votre pharmacie..."}
            placeholderTextColor={Colors.light.textTertiary}
            value={pharmacySearch} onChangeText={setPharmacySearch}
          />
        </View>
        <FlatList
          data={filteredPharmacies}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.pharmacyPickCard} onPress={() => handlePickPharmacy(item)} activeOpacity={0.82}>
              <View style={styles.pharmacyPickIcon}>
                <MaterialCommunityIcons name="hospital-building" size={22} color={Colors.primary} />
              </View>
              <View style={[styles.pharmacyPickInfo, isRTL && { alignItems: "flex-end" }]}>
                <Text style={[styles.pharmacyPickName, isRTL && styles.rtlText]}>
                  {isRTL && item.nameAr ? item.nameAr : item.name}
                </Text>
                <Text style={[styles.pharmacyPickAddress, isRTL && styles.rtlText]}>{item.address}</Text>
                {item.region && <View style={styles.regionBadge}><Text style={styles.regionBadgeText}>{item.region}</Text></View>}
              </View>
              <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={18} color={Colors.light.textTertiary} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <MaterialCommunityIcons name="hospital-off" size={48} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{isRTL ? "لا توجد صيدليات" : "Aucune pharmacie"}</Text>
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <View style={[styles.headerTitleWrap, isRTL && { alignItems: "flex-end" }]}>
          <Text style={styles.headerTitle}>{isRTL && pharmacy!.nameAr ? pharmacy!.nameAr : pharmacy!.name}</Text>
          <Text style={styles.headerSub}>{isRTL ? "بوابة الصيدلية" : "Portail Pharmacie"}</Text>
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
          <TouchableOpacity style={styles.logoutBtn} onPress={doLogout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="log-out-outline" size={22} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.pharmacyBanner, isRTL && styles.rtlRow]}>
        <MaterialCommunityIcons name="hospital-building" size={18} color={Colors.primary} />
        <Text style={[styles.bannerText, isRTL && styles.rtlText]}>{pharmacy!.address}</Text>
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${pharmacy!.phone}`)}>
          <Ionicons name="call-outline" size={18} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.id} style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]} onPress={() => { setActiveTab(tab.id); Haptics.selectionAsync(); }} activeOpacity={0.8}>
            <MaterialCommunityIcons name={tab.icon} size={16} color={activeTab === tab.id ? Colors.primary : Colors.light.textTertiary} />
            <Text style={[styles.tabBtnText, activeTab === tab.id && styles.tabBtnTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === "requests" && (
        loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <FlatList
            data={pendingRequests}
            keyExtractor={i => i.id}
            contentContainerStyle={[styles.list, pendingRequests.length === 0 && styles.emptyList, { paddingBottom: insets.bottom + 20 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchRequests(true)} tintColor={Colors.primary} />}
            ListHeaderComponent={myResponded.length > 0 ? (
              <View style={styles.respondedBanner}>
                <Ionicons name="time-outline" size={16} color={Colors.warning} />
                <Text style={styles.respondedBannerText}>
                  {isRTL ? `${myResponded.length} رد في انتظار موافقة الإدارة` : `${myResponded.length} réponse(s) en attente de validation`}
                </Text>
              </View>
            ) : null}
            renderItem={({ item }) => {
              const isResponding = respondingId === item.id;
              const alreadyDone = respondedIds.has(item.id);
              return (
                <View style={[styles.requestCard, alreadyDone && styles.requestCardDone]}>
                  <View style={[styles.requestCardHeader, isRTL && styles.rtlRow]}>
                    <View style={styles.pillIcon}><MaterialCommunityIcons name="pill" size={20} color={alreadyDone ? Colors.warning : Colors.accent} /></View>
                    <View style={[styles.requestInfo, isRTL && { alignItems: "flex-end" }]}>
                      <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.drugName}</Text>
                      <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{formatTime(item.createdAt, language)}</Text>
                    </View>
                    {alreadyDone && <View style={styles.pendingAdminBadge}><Ionicons name="time-outline" size={12} color={Colors.warning} /><Text style={styles.pendingAdminText}>{isRTL ? "قيد المراجعة" : "En révision"}</Text></View>}
                  </View>
                  {!alreadyDone && (
                    <TouchableOpacity style={[styles.availableBtn, isResponding && { opacity: 0.7 }]} onPress={() => handleRespond(item)} disabled={isResponding} activeOpacity={0.85}>
                      {isResponding ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.availableBtnText}>{isRTL ? "متوفر لدينا" : "Disponible chez nous"}</Text></>}
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="check-circle-outline" size={64} color={Colors.light.textTertiary} />
                <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{isRTL ? "لا توجد طلبات جديدة" : "Aucune demande pour l'instant"}</Text>
                <Text style={[styles.emptySub, isRTL && styles.rtlText]}>{isRTL ? "اسحب للأعلى للتحديث" : "Tirez pour actualiser"}</Text>
              </View>
            }
          />
        )
      )}

      {activeTab === "repeater" && (
        <View style={{ flex: 1 }}>
          <View style={styles.repeaterHeader}>
            <View style={[styles.repeaterHeaderInfo, isRTL && { alignItems: "flex-end" }]}>
              <Text style={[styles.repeaterTitle, isRTL && styles.rtlText]}>{isRTL ? "ريبتير — إعلان المخزون" : "Répéteur — Annonce de stock"}</Text>
              <Text style={[styles.repeaterSub, isRTL && styles.rtlText]}>
                {isRTL ? "أعلن عن توفر أدوية لديك تلقائياً للباحثين عنها" : "Annoncez automatiquement vos médicaments disponibles"}
              </Text>
            </View>
            <TouchableOpacity style={styles.addRepeaterBtn} onPress={() => setShowRepeaterModal(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {inventoryLoading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <FlatList
              data={inventory}
              keyExtractor={i => i.id}
              contentContainerStyle={[styles.list, inventory.length === 0 && styles.emptyList]}
              refreshControl={<RefreshControl refreshing={false} onRefresh={fetchInventory} tintColor={Colors.primary} />}
              renderItem={({ item }) => (
                <View style={styles.inventoryCard}>
                  <View style={[styles.inventoryRow, isRTL && styles.rtlRow]}>
                    <View style={styles.inventoryIcon}><MaterialCommunityIcons name="package-variant-closed" size={20} color={Colors.accent} /></View>
                    <View style={[styles.inventoryInfo, isRTL && { alignItems: "flex-end" }]}>
                      <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.drugName}</Text>
                      {item.notes && <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{item.notes}</Text>}
                      <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{formatTime(item.createdAt, language)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => Alert.alert(isRTL ? "حذف؟" : "Supprimer?", "", [{ text: isRTL ? "إلغاء" : "Annuler" }, { text: isRTL ? "حذف" : "Supprimer", style: "destructive", onPress: () => handleRemoveInventory(item.id) }])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="package-variant" size={64} color={Colors.light.textTertiary} />
                  <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{isRTL ? "لم تعلن عن أي دواء بعد" : "Aucun médicament annoncé"}</Text>
                  <Text style={[styles.emptySub, isRTL && styles.rtlText]}>{isRTL ? "اضغط + لإضافة دواء متوفر لديك" : "Appuyez sur + pour ajouter un médicament"}</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {activeTab === "b2b" && (
        <View style={{ flex: 1 }}>
          <View style={styles.repeaterHeader}>
            <View style={[styles.repeaterHeaderInfo, isRTL && { alignItems: "flex-end" }]}>
              <Text style={[styles.repeaterTitle, isRTL && styles.rtlText]}>{isRTL ? "قناة B2B — التواصل مع الشركات" : "Canal B2B — Contact fournisseurs"}</Text>
              <Text style={[styles.repeaterSub, isRTL && styles.rtlText]}>
                {isRTL ? "أرسل طلبات أو استفسارات للشركات عبر الإدارة" : "Envoyez commandes ou demandes via l'administration"}
              </Text>
            </View>
            <TouchableOpacity style={[styles.addRepeaterBtn, { backgroundColor: "#7C3AED" }]} onPress={() => setShowB2bModal(true)} activeOpacity={0.85}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {b2bLoading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color="#7C3AED" /></View>
          ) : (
            <FlatList
              data={b2bMessages}
              keyExtractor={i => i.id}
              contentContainerStyle={[styles.list, b2bMessages.length === 0 && styles.emptyList]}
              refreshControl={<RefreshControl refreshing={false} onRefresh={fetchB2b} tintColor="#7C3AED" />}
              renderItem={({ item }) => (
                <View style={styles.b2bCard}>
                  <View style={[styles.inventoryRow, isRTL && styles.rtlRow]}>
                    <View style={[styles.inventoryIcon, { backgroundColor: "#7C3AED18" }]}>
                      <MaterialCommunityIcons name={item.type === "order" ? "cart-outline" : "help-circle-outline"} size={20} color="#7C3AED" />
                    </View>
                    <View style={[styles.inventoryInfo, isRTL && { alignItems: "flex-end" }]}>
                      <View style={[{ flexDirection: "row", gap: 6, alignItems: "center" }, isRTL && { flexDirection: "row-reverse" }]}>
                        <Text style={[styles.b2bTypeBadge, { backgroundColor: item.type === "order" ? "#7C3AED18" : "#F59E0B18", color: item.type === "order" ? "#7C3AED" : "#B45309" }]}>
                          {item.type === "order" ? (isRTL ? "طلبية" : "Commande") : (isRTL ? "استفسار" : "Demande")}
                        </Text>
                        <Text style={[styles.b2bStatusBadge, { backgroundColor: item.adminStatus === "approved" ? Colors.accent + "18" : item.adminStatus === "rejected" ? Colors.danger + "18" : Colors.warning + "18", color: item.adminStatus === "approved" ? Colors.accent : item.adminStatus === "rejected" ? Colors.danger : Colors.warning }]}>
                          {item.adminStatus === "approved" ? (isRTL ? "موافق" : "Approuvé") : item.adminStatus === "rejected" ? (isRTL ? "مرفوض" : "Rejeté") : (isRTL ? "قيد المراجعة" : "En attente")}
                        </Text>
                      </View>
                      <Text style={[styles.drugName, { fontSize: 13 }, isRTL && styles.rtlText]}>{item.message}</Text>
                      <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{formatTime(item.createdAt, language)}</Text>
                    </View>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="briefcase-outline" size={64} color={Colors.light.textTertiary} />
                  <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{isRTL ? "لا توجد رسائل B2B بعد" : "Aucun message B2B"}</Text>
                  <Text style={[styles.emptySub, isRTL && styles.rtlText]}>{isRTL ? "أرسل طلبية أو استفساراً للبدء" : "Envoyez une commande ou une demande pour commencer"}</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      <Modal visible={showRepeaterModal} transparent animationType="slide" onRequestClose={() => setShowRepeaterModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>{isRTL ? "إضافة دواء للريبتير" : "Ajouter un médicament"}</Text>
              <TextInput style={[styles.modalInput, isRTL && styles.rtlInput, { marginBottom: 10 }]} placeholder={isRTL ? "اسم الدواء *" : "Nom du médicament *"} placeholderTextColor={Colors.light.textTertiary} value={repeaterDrug} onChangeText={setRepeaterDrug} />
              <TextInput style={[styles.modalInput, styles.textArea, isRTL && styles.rtlInput, { marginBottom: 16 }]} placeholder={isRTL ? "ملاحظات (اختياري)" : "Notes (optionnel)"} placeholderTextColor={Colors.light.textTertiary} value={repeaterNotes} onChangeText={setRepeaterNotes} multiline numberOfLines={3} />
              <TouchableOpacity style={[styles.loginBtn, (!repeaterDrug.trim() || repeaterSaving) && styles.loginBtnDisabled]} onPress={handleRepeaterSave} disabled={!repeaterDrug.trim() || repeaterSaving} activeOpacity={0.85}>
                {repeaterSaving ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.loginBtnText}>{isRTL ? "حفظ" : "Enregistrer"}</Text></>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRepeaterModal(false)}>
                <Text style={styles.cancelText}>{isRTL ? "إلغاء" : "Annuler"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showB2bModal} transparent animationType="slide" onRequestClose={() => setShowB2bModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>{isRTL ? "إرسال رسالة B2B" : "Envoyer un message B2B"}</Text>
              <View style={[styles.typeRow, isRTL && styles.rtlRow]}>
                {(["order", "inquiry"] as const).map(t => (
                  <TouchableOpacity key={t} style={[styles.typeBtn, b2bType === t && styles.typeBtnActive]} onPress={() => setB2bType(t)}>
                    <Text style={[styles.typeBtnText, b2bType === t && styles.typeBtnTextActive]}>
                      {t === "order" ? (isRTL ? "طلبية" : "Commande") : (isRTL ? "استفسار" : "Demande")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[styles.modalInput, styles.textArea, isRTL && styles.rtlInput, { marginBottom: 16 }]} placeholder={isRTL ? "اكتب طلبيتك أو استفسارك..." : "Rédigez votre commande ou demande..."} placeholderTextColor={Colors.light.textTertiary} value={b2bText} onChangeText={setB2bText} multiline numberOfLines={5} />
              <TouchableOpacity style={[styles.loginBtn, { backgroundColor: "#7C3AED" }, (!b2bText.trim() || b2bSending) && styles.loginBtnDisabled]} onPress={handleSendB2b} disabled={!b2bText.trim() || b2bSending} activeOpacity={0.85}>
                {b2bSending ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="send" size={18} color="#fff" /><Text style={styles.loginBtnText}>{isRTL ? "إرسال" : "Envoyer"}</Text></>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowB2bModal(false)}>
                <Text style={styles.cancelText}>{isRTL ? "إلغاء" : "Annuler"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right" },
  rtlInput: { textAlign: "right" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  headerTitleWrap: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  logoutBtn: { padding: 4 },

  loginContainer: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  loginIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.primary + "12", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  loginTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.light.text },
  loginSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 21 },
  codeHintBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primary + "10", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, width: "100%" },
  codeHintText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.primary },
  pinInputRow: { flexDirection: "row", alignItems: "center", width: "100%", backgroundColor: Colors.light.inputBackground, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 2, borderWidth: 1.5, borderColor: Colors.light.border },
  pinIcon: { marginRight: 8 },
  pinInput: { flex: 1, height: 52, fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.light.text, letterSpacing: 3 },
  loginBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  loginBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  loginBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  loginHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center" },

  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.light.inputBackground, borderRadius: 12, margin: 16, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.light.border },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text },
  pharmacyPickCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.light.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.light.border },
  pharmacyPickIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + "12", alignItems: "center", justifyContent: "center" },
  pharmacyPickInfo: { flex: 1 },
  pharmacyPickName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text, marginBottom: 2 },
  pharmacyPickAddress: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  regionBadge: { marginTop: 4, backgroundColor: Colors.primary + "12", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  regionBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.primary },

  pharmacyBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primary + "0D", marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 12 },
  bannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.text },

  tabBar: { flexGrow: 0, marginTop: 12 },
  tabBarContent: { paddingHorizontal: 16, gap: 8 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.light.inputBackground, borderWidth: 1, borderColor: Colors.light.border },
  tabBtnActive: { backgroundColor: Colors.primary + "14", borderColor: Colors.primary + "40" },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textTertiary },
  tabBtnTextActive: { color: Colors.primary, fontFamily: "Inter_600SemiBold" },

  respondedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.warning + "14", borderRadius: 12, padding: 12, marginBottom: 12 },
  respondedBannerText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.warning },

  list: { padding: 16, gap: 10, paddingTop: 12 },
  emptyList: { flex: 1 },
  requestCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: Colors.light.border },
  requestCardDone: { borderColor: Colors.warning + "40", backgroundColor: Colors.warning + "06" },
  requestCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  pillIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent + "18", alignItems: "center", justifyContent: "center" },
  requestInfo: { flex: 1 },
  drugName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  requestTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  pendingAdminBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: Colors.warning + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pendingAdminText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.warning },

  availableBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.accent, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  availableBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center", lineHeight: 19 },

  bellAlertBtn: { position: "relative", padding: 4 },
  bellAlertDot: { position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning, borderWidth: 1, borderColor: "#fff" },

  repeaterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  repeaterHeaderInfo: { flex: 1 },
  repeaterTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text },
  repeaterSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  addRepeaterBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", shadowColor: Colors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },

  inventoryCard: { backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.light.border },
  inventoryRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  inventoryIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accent + "18", alignItems: "center", justifyContent: "center" },
  inventoryInfo: { flex: 1 },

  b2bCard: { backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#7C3AED20" },
  b2bTypeBadge: { fontSize: 10, fontFamily: "Inter_600SemiBold", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  b2bStatusBadge: { fontSize: 10, fontFamily: "Inter_600SemiBold", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },

  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalCard: { backgroundColor: Colors.light.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text, marginBottom: 16 },
  modalInput: { backgroundColor: Colors.light.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text, borderWidth: 1, borderColor: Colors.light.border },
  textArea: { height: 100, textAlignVertical: "top" },
  cancelBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },

  typeRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  typeBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.light.inputBackground, borderWidth: 1, borderColor: Colors.light.border },
  typeBtnActive: { backgroundColor: "#7C3AED14", borderColor: "#7C3AED60" },
  typeBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  typeBtnTextActive: { color: "#7C3AED", fontFamily: "Inter_700Bold" },
});
