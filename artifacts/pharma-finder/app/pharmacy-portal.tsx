import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  Linking, RefreshControl, Platform, TextInput, Alert, KeyboardAvoidingView,
  ScrollView, Animated, Vibration, Modal, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useBell } from "@/hooks/useBell";
import { DewyaBrand, DewyaFooter } from "@/components/DewyaBrand";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const PARTNER_COLOR = "#7C3AED";

type DrugRequest = { id: string; userId: string; drugName: string; status: string; createdAt: string };
type PharmacyInfo = { id: string; name: string; nameAr: string | null; address: string; addressAr: string | null; phone: string; region: string | null; b2bEnabled: boolean; subscriptionActive?: boolean };
type InventoryItem = { id: string; pharmacyId: string; drugName: string; notes: string | null; createdAt: string };
type Company = { id: string; name: string; nameAr: string | null; contact: string | null; subscriptionActive: boolean };
type CompanyOrder = { id: string; pharmacyId: string; pharmacyName: string; companyId: string | null; companyName: string | null; drugName: string; quantity: string | null; message: string | null; type: string; status: string; companyResponse: string | null; respondedAt: string | null; createdAt: string };
type CompanyAnnouncement = { id: string; companyId: string; companyName: string; drugName: string; price: number | null; unit: string | null; notes: string | null; isAd: boolean; createdAt: string };
type MyResponseStatus = { id: string; requestId: string; adminStatus: string; createdAt: string; drugName: string | null };

function formatTime(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleString(lang === "ar" ? "ar-SA" : "fr-FR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

type PortalTab = "requests" | "repeater" | "partners" | "ads";

export default function PharmacyPortalScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";
  const { playAlertBell } = useBell("alert");

  const [step, setStep] = useState<"code" | "dashboard">("code");
  const [pin, setPin] = useState("");
  const pinRef = useRef<string>("");
  const [authLoading, setAuthLoading] = useState(false);
  const [pharmacy, setPharmacy] = useState<PharmacyInfo | null>(null);

  const [requests, setRequests] = useState<DrugRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [myResponsesStatus, setMyResponsesStatus] = useState<MyResponseStatus[]>([]);
  const myResponsesPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevMyResponsesRef = useRef<Map<string, string>>(new Map());

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

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companyOrders, setCompanyOrders] = useState<CompanyOrder[]>([]);
  const [companyOrdersLoading, setCompanyOrdersLoading] = useState(false);
  const [companyOrdersRefreshing, setCompanyOrdersRefreshing] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [orderDrug, setOrderDrug] = useState("");
  const [orderQty, setOrderQty] = useState("");
  const [orderMsg, setOrderMsg] = useState("");
  const [orderType, setOrderType] = useState<"order" | "inquiry" | "promotion">("order");
  const [orderSending, setOrderSending] = useState(false);
  const [attachment, setAttachment] = useState<{ data: string; type: string; name: string } | null>(null);

  const [announcements, setAnnouncements] = useState<CompanyAnnouncement[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);

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
    playAlertBell();
  }, [bellShake, playAlertBell]);

  useEffect(() => {
    if (!pharmacy) return;
    fetchRequests();
    fetchMyResponsesStatus();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${API_BASE}/pharmacy-portal/requests`, {
          headers: pinRef.current ? { "x-pharmacy-pin": pinRef.current } : {},
        });
        if (!resp.ok) return;
        const data: DrugRequest[] = await resp.json();
        const cnt = data.filter(r => r.status === "pending").length;
        if (prevPendingCountRef.current >= 0 && cnt > prevPendingCountRef.current) { startBellAlert(); setRequests(data); }
        prevPendingCountRef.current = cnt;
      } catch {}
    }, 8000);
    myResponsesPollRef.current = setInterval(() => fetchMyResponsesStatus(), 12000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (myResponsesPollRef.current) clearInterval(myResponsesPollRef.current);
      stopBellAlert();
    };
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
        const errData = await resp.json().catch(() => ({}));
        if (errData?.error === "Compte inactif") {
          Alert.alert(
            isRTL ? "الحساب غير نشط" : "Compte inactif",
            isRTL ? "صيدليتكم غير مفعّلة. تواصلوا مع الإدارة." : "Votre pharmacie est désactivée. Contactez l'administration."
          );
        } else {
          Alert.alert(
            isRTL ? "رمز غير صحيح" : "Code incorrect",
            isRTL ? "تأكد من الرمز الخاص بصيدليتكم وأعد المحاولة" : "Vérifiez le code propre à votre pharmacie et réessayez"
          );
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      const data = await resp.json();
      pinRef.current = pin.trim();
      setPharmacy(data);
      setStep("dashboard");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally { setAuthLoading(false); }
  };

  const fetchRequests = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/requests`, {
        headers: pinRef.current ? { "x-pharmacy-pin": pinRef.current } : {},
      });
      if (resp.ok) {
        const data: DrugRequest[] = await resp.json();
        setRequests(data);
        if (prevPendingCountRef.current < 0) prevPendingCountRef.current = data.filter(r => r.status === "pending").length;
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  const fetchMyResponsesStatus = useCallback(async () => {
    if (!pharmacy) return;
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/my-responses/${pharmacy.id}`);
      if (resp.ok) {
        const data: MyResponseStatus[] = await resp.json();
        setMyResponsesStatus(data);

        // Detect status changes and notify pharmacy in real time
        const prevMap = prevMyResponsesRef.current;
        const newlyConfirmed: MyResponseStatus[] = [];
        const newlyIgnored: MyResponseStatus[] = [];
        data.forEach(r => {
          const prev = prevMap.get(r.id);
          if (prev === "pending_admin" && r.adminStatus === "confirmed") newlyConfirmed.push(r);
          if (prev === "pending_admin" && r.adminStatus === "ignored") newlyIgnored.push(r);
        });
        // Update previous map
        data.forEach(r => prevMap.set(r.id, r.adminStatus));

        if (newlyConfirmed.length > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const drugList = newlyConfirmed.map(r => r.drugName || "—").join("، ");
          Alert.alert(
            isRTL ? "✅ رد مقبول!" : "✅ Réponse acceptée!",
            isRTL
              ? `تم تأكيد ردّكم على طلب: ${drugList}\nأُبلغ المريض بتفاصيل صيدليتكم.`
              : `Votre réponse pour: ${drugList}\nLe patient a été notifié.`,
          );
        } else if (newlyIgnored.length > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const drugList = newlyIgnored.map(r => r.drugName || "—").join("، ");
          Alert.alert(
            isRTL ? "ℹ️ لم يُختر ردّكم" : "ℹ️ Réponse non retenue",
            isRTL
              ? `طلب: ${drugList}\nتم اختيار صيدلية أخرى. يمكنكم الرد على طلبات جديدة.`
              : `Demande: ${drugList}\nUne autre pharmacie a été choisie. Vous pouvez répondre aux nouvelles demandes.`,
          );
        }

        // Sync confirmed/ignored IDs into local responded set so requests stay hidden
        const confirmedOrIgnored = new Set(
          data.filter(r => r.adminStatus === "confirmed" || r.adminStatus === "ignored").map(r => r.requestId)
        );
        setRespondedIds(prev => {
          const next = new Set(prev);
          confirmedOrIgnored.forEach(id => next.add(id));
          return next;
        });
      }
    } catch {}
  }, [pharmacy, isRTL]);

  const fetchInventory = async () => {
    if (!pharmacy) return;
    setInventoryLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/inventory/${pharmacy.id}`);
      if (resp.ok) setInventory(await resp.json());
    } catch {} finally { setInventoryLoading(false); }
  };

  const fetchCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/companies-list`);
      if (resp.ok) setCompanies(await resp.json());
    } catch {} finally { setCompaniesLoading(false); }
  }, []);

  const fetchCompanyOrders = useCallback(async (isRefresh = false) => {
    if (!pharmacy) return;
    if (isRefresh) setCompanyOrdersRefreshing(true); else setCompanyOrdersLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/company-orders/${pharmacy.id}`);
      if (resp.ok) setCompanyOrders(await resp.json());
    } catch {} finally { setCompanyOrdersLoading(false); setCompanyOrdersRefreshing(false); }
  }, [pharmacy]);

  const fetchAnnouncements = useCallback(async () => {
    setAdsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/company-portal/announcements`);
      if (resp.ok) setAnnouncements(await resp.json());
    } catch {} finally { setAdsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "repeater") fetchInventory();
    else if (activeTab === "partners") { fetchCompanies(); fetchCompanyOrders(); }
    else if (activeTab === "ads") fetchAnnouncements();
  }, [activeTab]);

  const handleRespond = async (request: DrugRequest) => {
    if (!pharmacy) return;
    setRespondingId(request.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pharmacy-pin": pin },
        body: JSON.stringify({ requestId: request.id, pharmacyId: pharmacy.id, pharmacyName: pharmacy.nameAr || pharmacy.name, pharmacyAddress: pharmacy.address, pharmacyPhone: pharmacy.phone }),
      });
      if (resp.ok) {
        setRespondedIds(prev => new Set([...prev, request.id]));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          isRTL ? "✅ تم الإرسال" : "✅ Signalé",
          isRTL ? "أُبلغت الإدارة برد صيدليتكم. ستتواصل مع المريض بعد المراجعة." : "L'administration est notifiée de votre réponse. Elle contactera le patient après validation."
        );
      } else {
        const errData = await resp.json().catch(() => ({}));
        if (errData?.error === "already_pending") {
          // Mark as already responded locally too
          setRespondedIds(prev => new Set([...prev, request.id]));
          Alert.alert(isRTL ? "✋ في انتظار المراجعة" : "✋ En attente", isRTL ? "ردّكم على هذا الطلب في انتظار مراجعة الإدارة" : "Votre réponse est déjà en attente de validation");
        } else {
          Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل إرسال الرد، حاول مجدداً" : "Échec de l'envoi, réessayez");
        }
      }
    } catch {
      Alert.alert(isRTL ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally { setRespondingId(null); }
  };

  const handleDismiss = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const handleRepeaterSave = async () => {
    if (!pharmacy || !repeaterDrug.trim()) return;
    setRepeaterSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pharmacy-pin": pin },
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
    if (!pharmacy) return;
    try {
      await fetch(`${API_BASE}/pharmacy-portal/inventory/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-pharmacy-pin": pin },
        body: JSON.stringify({ pharmacyId: pharmacy.id }),
      });
      setInventory(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(isRTL ? "الصلاحية مرفوضة" : "Permission refusée", isRTL ? "يجب السماح بالوصول للصور" : "Accès à la galerie requis");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0].base64) {
        const asset = result.assets[0];
        const ext = asset.uri.split(".").pop()?.toLowerCase() || "jpg";
        const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        setAttachment({ data: asset.base64, type: mimeType, name: `photo.${ext}` });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل اختيار الصورة" : "Impossible de sélectionner l'image");
    }
  };

  const pickCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(isRTL ? "الصلاحية مرفوضة" : "Permission refusée", isRTL ? "يجب السماح بالوصول للكاميرا" : "Accès à la caméra requis");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false, quality: 0.7, base64: true,
      });
      if (!result.canceled && result.assets[0].base64) {
        const asset = result.assets[0];
        setAttachment({ data: asset.base64, type: "image/jpeg", name: "photo.jpg" });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل التصوير" : "Impossible de prendre la photo");
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          setAttachment({ data: base64, type: asset.mimeType || "application/octet-stream", name: asset.name });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        };
        reader.readAsDataURL(blob);
      }
    } catch (e) {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل اختيار الملف" : "Impossible de sélectionner le fichier");
    }
  };

  const handleSendOrder = async () => {
    if (!pharmacy || !orderDrug.trim()) return;
    setOrderSending(true);
    try {
      const resp = await fetch(`${API_BASE}/pharmacy-portal/company-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pharmacy-pin": pin },
        body: JSON.stringify({
          pharmacyId: pharmacy.id,
          pharmacyName: pharmacy.nameAr || pharmacy.name,
          pharmacyPhone: pharmacy.phone,
          pharmacyAddress: pharmacy.address,
          pharmacyRegion: pharmacy.region,
          companyId: selectedCompany?.id || null,
          companyName: selectedCompany ? (selectedCompany.nameAr || selectedCompany.name) : null,
          drugName: orderDrug.trim(),
          quantity: orderQty.trim() || null,
          message: orderMsg.trim() || null,
          type: orderType,
          attachmentData: attachment?.data || null,
          attachmentType: attachment?.type || null,
          attachmentName: attachment?.name || null,
        }),
      });
      if (resp.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setOrderDrug(""); setOrderQty(""); setOrderMsg(""); setSelectedCompany(null);
        setOrderType("order"); setAttachment(null);
        setShowOrderModal(false);
        fetchCompanyOrders();
        Alert.alert(
          isRTL ? "✅ تم الإرسال" : "✅ Envoyé",
          isRTL ? "تم إرسال طلبك للشركة مباشرةً" : "Votre commande a été envoyée directement à la société"
        );
      }
    } catch {} finally { setOrderSending(false); }
  };

  const doLogout = () => {
    setPharmacy(null); setPin(""); setRespondedIds(new Set()); setDismissedIds(new Set()); setMyResponsesStatus([]); stopBellAlert();
    prevPendingCountRef.current = -1; setStep("code");
    setRequests([]); setInventory([]); setCompanyOrders([]); setAnnouncements([]); setActiveTab("requests");
  };

  const pendingRequests = requests.filter(r => r.status === "pending" && !respondedIds.has(r.id) && !dismissedIds.has(r.id));
  const pendingOrders = companyOrders.filter(o => o.status === "pending");

  const TABS: { id: PortalTab; label: string; icon: any }[] = [
    { id: "requests", label: isRTL ? `الطلبات${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ""}` : `Demandes${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ""}`, icon: "pill" },
    { id: "repeater", label: isRTL ? "مخزوني" : "Mon stock", icon: "pill" },
    { id: "partners", label: isRTL ? `الشركاء${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ""}` : `Partenaires${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ""}`, icon: "domain" },
    { id: "ads", label: isRTL ? "إعلانات" : "Annonces", icon: "bullhorn" },
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
          <DewyaBrand isRTL={isRTL} size="md" variant="badge" />
          <Text style={[styles.loginTitle, isRTL && styles.rtlText]}>{isRTL ? "دخول الصيدليات" : "Accès Pharmacies"}</Text>
          <Text style={[styles.loginSub, isRTL && styles.rtlText]}>
            {isRTL
              ? "أدخل الرمز السري الخاص بصيدليتكم للوصول إلى لوحة التحكم"
              : "Entrez le code secret propre à votre pharmacie pour accéder au tableau de bord"}
          </Text>

          <View style={[styles.codeHintBox, { borderColor: Colors.accent + "40", backgroundColor: Colors.accent + "08" }]}>
            <Ionicons name="lock-closed" size={16} color={Colors.accent} />
            <Text style={[styles.codeHintText, isRTL && styles.rtlText, { color: Colors.accent }]}>
              {isRTL
                ? "كل صيدلية لها رمز خاص بها — لا يمكن الدخول بحساب صيدلية أخرى"
                : "Chaque pharmacie a son propre code — aucun accès croisé n'est possible"}
            </Text>
          </View>

          <View style={[styles.pinInputRow, isRTL && styles.rtlRow]}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={Colors.light.textSecondary} style={styles.pinIcon} />
            <TextInput
              style={[styles.pinInput, isRTL && styles.rtlText]}
              placeholder={isRTL ? "الرمز السري لصيدليتكم" : "Code secret de votre pharmacie"}
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
            {isRTL ? "الرمز السري يُحدَّد لكل صيدلية من قِبَل الإدارة" : "Le code est défini individuellement pour chaque pharmacie par l'administration"}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
            ListHeaderComponent={myResponsesStatus.length > 0 ? (
              <View style={{ marginBottom: 10 }}>
                <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, paddingHorizontal: 2 }]}>
                  <Text style={[{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary }, isRTL && { textAlign: "right" }]}>
                    {isRTL ? "حالة ردودي الأخيرة:" : "État de mes réponses:"}
                  </Text>
                  <DewyaBrand isRTL={isRTL} size="xs" variant="badge" />
                </View>
                {myResponsesStatus.slice(0, 5).map(r => {
                  const statusColor = r.adminStatus === "confirmed" ? Colors.accent : r.adminStatus === "ignored" ? "#888" : Colors.warning;
                  const statusIcon = r.adminStatus === "confirmed" ? "checkmark-circle" : r.adminStatus === "ignored" ? "close-circle" : "time-outline";
                  const statusLabel = r.adminStatus === "confirmed"
                    ? (isRTL ? "✅ تم التأكيد — أُبلغ المريض" : "✅ Confirmé — Patient notifié")
                    : r.adminStatus === "ignored"
                    ? (isRTL ? "✖ لم يُختر ردّكم" : "✖ Non retenu")
                    : (isRTL ? "⏳ قيد مراجعة الإدارة" : "⏳ En attente de validation");
                  return (
                    <View key={r.id} style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 8, backgroundColor: statusColor + "10", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 4, borderWidth: 1, borderColor: statusColor + "25" }]}>
                      <Ionicons name={statusIcon as any} size={15} color={statusColor} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: statusColor, textAlign: isRTL ? "right" : "left" }}>{statusLabel}</Text>
                        {r.drugName && <Text style={{ fontSize: 11, color: Colors.light.textSecondary, textAlign: isRTL ? "right" : "left" }}>{r.drugName}</Text>}
                      </View>
                      <Text style={{ fontSize: 10, color: Colors.light.textTertiary }}>{formatTime(r.createdAt, language)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            renderItem={({ item }) => {
              const isResponding = respondingId === item.id;
              const alreadyDone = respondedIds.has(item.id);
              return (
                <View style={[styles.requestCard, alreadyDone && styles.requestCardDone]}>
                  <View style={[styles.requestCardHeader, isRTL && styles.rtlRow]}>
                    <View style={[styles.pillIcon, alreadyDone && { backgroundColor: Colors.warning + "18" }]}>
                      <MaterialCommunityIcons name="pill" size={22} color={alreadyDone ? Colors.warning : Colors.accent} />
                    </View>
                    <View style={[styles.requestInfo, isRTL && { alignItems: "flex-end" }, { flex: 1 }]}>
                      <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.drugName}</Text>
                      <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{formatTime(item.createdAt, language)}</Text>
                    </View>
                    {alreadyDone && (
                      <View style={styles.pendingAdminBadge}>
                        <Ionicons name="time-outline" size={12} color={Colors.warning} />
                        <Text style={styles.pendingAdminText}>{isRTL ? "قيد المراجعة" : "En révision"}</Text>
                      </View>
                    )}
                  </View>
                  {!alreadyDone && (
                    <View style={[styles.requestActionRow, isRTL && styles.rtlRow]}>
                      <TouchableOpacity
                        style={[styles.availableBtn, isResponding && { opacity: 0.7 }]}
                        onPress={() => handleRespond(item)}
                        disabled={isResponding}
                        activeOpacity={0.85}
                      >
                        {isResponding
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.availableBtnText}>{isRTL ? "✅ متوفر لدينا" : "✅ Disponible chez nous"}</Text></>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dismissBtn}
                        onPress={() => Alert.alert(
                          isRTL ? "تجاهل الطلب؟" : "Ignorer la demande?",
                          isRTL ? "سيُخفى هذا الطلب من القائمة" : "Cette demande sera masquée de votre liste",
                          [{ text: isRTL ? "إلغاء" : "Annuler", style: "cancel" }, { text: isRTL ? "تجاهل" : "Ignorer", style: "destructive", onPress: () => handleDismiss(item.id) }]
                        )}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={Colors.light.textSecondary} />
                        <Text style={styles.dismissBtnText}>{isRTL ? "تجاهل" : "Ignorer"}</Text>
                      </TouchableOpacity>
                    </View>
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

      {activeTab === "partners" && (
        <View style={{ flex: 1 }}>
          <View style={[styles.b2bExplainBanner, isRTL && { alignItems: "flex-end" }]}>
            <View style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, isRTL && styles.rtlRow]}>
              <MaterialCommunityIcons name="swap-horizontal" size={16} color={PARTNER_COLOR} />
              <Text style={[styles.b2bExplainTitle, isRTL && styles.rtlText]}>{isRTL ? "قناة B2B المباشرة" : "Canal B2B Direct"}</Text>
            </View>
            <Text style={[styles.b2bExplainText, isRTL && styles.rtlText]}>
              {isRTL
                ? "اختر شركة دواء من القائمة وأرسل طلبيتك مباشرة. سترى رد الشركة هنا فور صدوره."
                : "Choisissez une société pharmaceutique et envoyez votre commande directement. La réponse apparaît ici dès qu'elle est disponible."}
            </Text>
          </View>
          <View style={styles.repeaterHeader}>
            <View style={[styles.repeaterHeaderInfo, isRTL && { alignItems: "flex-end" }]}>
              <Text style={[styles.repeaterTitle, isRTL && styles.rtlText]}>{isRTL ? "الشركات المتاحة" : "Sociétés disponibles"}</Text>
              <Text style={[styles.repeaterSub, isRTL && styles.rtlText]}>
                {isRTL ? "اضغط على شركة لإرسال طلب مباشر" : "Appuyez sur une société pour envoyer une commande directe"}
              </Text>
            </View>
            <TouchableOpacity style={[styles.addRepeaterBtn, { backgroundColor: PARTNER_COLOR }]} onPress={() => { setSelectedCompany(null); setShowOrderModal(true); }} activeOpacity={0.85}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {companiesLoading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={PARTNER_COLOR} /></View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 20 }}>
              {companies.length > 0 && (
                <View style={styles.companiesSection}>
                  <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>{isRTL ? "الشركاء المتاحون" : "Partenaires disponibles"}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {companies.map(c => (
                      <TouchableOpacity key={c.id} style={styles.companyChip} onPress={() => { setSelectedCompany(c); setShowOrderModal(true); }} activeOpacity={0.8}>
                        <MaterialCommunityIcons name="domain" size={14} color={PARTNER_COLOR} />
                        <Text style={styles.companyChipText}>{isRTL && c.nameAr ? c.nameAr : c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>{isRTL ? "طلباتي" : "Mes commandes"}</Text>
              {companyOrdersLoading ? (
                <ActivityIndicator size="small" color={PARTNER_COLOR} style={{ marginTop: 20 }} />
              ) : companyOrders.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="domain" size={48} color={Colors.light.textTertiary} />
                  <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{isRTL ? "لا توجد طلبات بعد" : "Aucune commande"}</Text>
                  <Text style={[styles.emptySub, isRTL && styles.rtlText]}>{isRTL ? "اضغط على إرسال لبدء طلب جديد" : "Appuyez sur envoyer pour une nouvelle commande"}</Text>
                </View>
              ) : companyOrders.map(order => (
                <View key={order.id} style={styles.companyOrderCard}>
                  <View style={[styles.orderCardHeader, isRTL && styles.rtlRow]}>
                    <View style={[styles.orderCardIcon, { backgroundColor: order.status === "responded" ? Colors.accent + "15" : PARTNER_COLOR + "12" }]}>
                      <MaterialCommunityIcons name="package-variant" size={18} color={order.status === "responded" ? Colors.accent : PARTNER_COLOR} />
                    </View>
                    <View style={[{ flex: 1 }, isRTL && { alignItems: "flex-end" }]}>
                      <Text style={[styles.drugName, isRTL && styles.rtlText]}>{order.drugName}</Text>
                      {order.companyName && <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{order.companyName}</Text>}
                    </View>
                    <View style={[styles.orderStatusBadge, { backgroundColor: order.status === "responded" ? Colors.accent + "18" : Colors.warning + "18" }]}>
                      <Text style={[styles.orderStatusText, { color: order.status === "responded" ? Colors.accent : Colors.warning }]}>
                        {order.status === "responded" ? (isRTL ? "مُجاب" : "Répondu") : (isRTL ? "انتظار" : "En attente")}
                      </Text>
                    </View>
                  </View>
                  {order.companyResponse && (
                    <View style={[styles.companyResponseBox, isRTL && { alignItems: "flex-end" }]}>
                      <Text style={[styles.responseLabel, isRTL && styles.rtlText]}>{isRTL ? "رد الشركة:" : "Réponse:"}</Text>
                      <Text style={[styles.responseText, isRTL && styles.rtlText]}>{order.companyResponse}</Text>
                    </View>
                  )}
                  <Text style={styles.requestTime}>{formatTime(order.createdAt, language)}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {activeTab === "ads" && (
        adsLoading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={PARTNER_COLOR} /></View>
        ) : (
          <FlatList
            data={announcements}
            keyExtractor={i => i.id}
            contentContainerStyle={[styles.list, announcements.length === 0 && styles.emptyList, { paddingBottom: insets.bottom + 20 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={false} onRefresh={fetchAnnouncements} tintColor={PARTNER_COLOR} />}
            renderItem={({ item }) => (
              <View style={styles.adCard}>
                <View style={[styles.adCardHeader, isRTL && styles.rtlRow]}>
                  <View style={styles.adIcon}><MaterialCommunityIcons name="bullhorn" size={20} color={Colors.warning} /></View>
                  <View style={[{ flex: 1 }, isRTL && { alignItems: "flex-end" }]}>
                    <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.drugName}</Text>
                    <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{item.companyName}</Text>
                  </View>
                  {item.price != null && (
                    <Text style={styles.adPrice}>{item.price} MRU{item.unit ? `/${item.unit}` : ""}</Text>
                  )}
                </View>
                {item.notes && <Text style={[styles.adNotes, isRTL && styles.rtlText]}>{item.notes}</Text>}
                <Text style={styles.requestTime}>{formatTime(item.createdAt, language)}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="bullhorn-outline" size={64} color={Colors.light.textTertiary} />
                <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{isRTL ? "لا توجد إعلانات من الشركاء" : "Aucune annonce des partenaires"}</Text>
                <Text style={[styles.emptySub, isRTL && styles.rtlText]}>{isRTL ? "ستظهر هنا إعلانات شركات الأدوية" : "Les annonces des sociétés pharma apparaîtront ici"}</Text>
              </View>
            }
          />
        )
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

      <Modal visible={showOrderModal} transparent animationType="slide" onRequestClose={() => setShowOrderModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {selectedCompany
                  ? (isRTL ? `طلب إلى: ${selectedCompany.nameAr || selectedCompany.name}` : `Commande à: ${selectedCompany.name}`)
                  : (isRTL ? "إرسال طلب مباشر" : "Envoyer une commande directe")}
              </Text>

              <Text style={[styles.modalLabel, isRTL && styles.rtlText]}>
                {isRTL ? "اختر الشركة *" : "Choisir la société *"}
              </Text>
              {companies.length === 0 ? (
                <View style={[styles.noCompanyWarn, isRTL && { alignItems: "flex-end" }]}>
                  <Ionicons name="warning-outline" size={16} color={Colors.warning} />
                  <Text style={[styles.noCompanyWarnText, isRTL && styles.rtlText]}>
                    {isRTL ? "لا توجد شركات مشتركة حالياً" : "Aucune société partenaire disponible"}
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
                  {companies.map(c => (
                    <TouchableOpacity key={c.id} style={[styles.companyPickBtn, selectedCompany?.id === c.id && styles.companyPickBtnActive]} onPress={() => setSelectedCompany(c)} activeOpacity={0.8}>
                      <MaterialCommunityIcons name="domain" size={13} color={selectedCompany?.id === c.id ? PARTNER_COLOR : Colors.light.textTertiary} />
                      <Text style={[styles.companyPickText, selectedCompany?.id === c.id && styles.companyPickTextActive]}>{isRTL && c.nameAr ? c.nameAr : c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={[styles.modalLabel, isRTL && styles.rtlText]}>{isRTL ? "نوع الطلب" : "Type de demande"}</Text>
              <View style={[styles.typeRow, isRTL && styles.rtlRow, { marginBottom: 10 }]}>
                {(["order", "inquiry", "promotion"] as const).map(tp => (
                  <TouchableOpacity key={tp} style={[styles.typeBtn, orderType === tp && { ...styles.typeBtnActive, backgroundColor: PARTNER_COLOR + "18", borderColor: PARTNER_COLOR + "60" }]} onPress={() => setOrderType(tp)}>
                    <Text style={[styles.typeBtnText, orderType === tp && { color: PARTNER_COLOR }]}>
                      {tp === "order" ? (isRTL ? "طلبية" : "Commande") : tp === "inquiry" ? (isRTL ? "استفسار" : "Demande") : (isRTL ? "عرض" : "Offre")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={[styles.modalInput, isRTL && styles.rtlInput, { marginBottom: 8 }]} placeholder={isRTL ? "اسم الدواء / المنتج *" : "Médicament / Produit *"} placeholderTextColor={Colors.light.textTertiary} value={orderDrug} onChangeText={setOrderDrug} textAlign={isRTL ? "right" : "left"} />
              <TextInput style={[styles.modalInput, isRTL && styles.rtlInput, { marginBottom: 8 }]} placeholder={isRTL ? "الكمية المطلوبة (اختياري)" : "Quantité souhaitée (optionnel)"} placeholderTextColor={Colors.light.textTertiary} value={orderQty} onChangeText={setOrderQty} textAlign={isRTL ? "right" : "left"} keyboardType="numeric" />
              <TextInput style={[styles.modalInput, styles.textArea, isRTL && styles.rtlInput, { marginBottom: 12 }]} placeholder={isRTL ? "ملاحظات للشركة..." : "Message à la société..."} placeholderTextColor={Colors.light.textTertiary} value={orderMsg} onChangeText={setOrderMsg} multiline numberOfLines={3} textAlign={isRTL ? "right" : "left"} />

              <Text style={[styles.modalLabel, isRTL && styles.rtlText]}>{isRTL ? "إضافة مرفق (اختياري)" : "Ajouter une pièce jointe (optionnel)"}</Text>
              <View style={[styles.attachBtnRow, isRTL && styles.rtlRow]}>
                <TouchableOpacity style={styles.attachBtn} onPress={pickCamera} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={18} color={PARTNER_COLOR} />
                  <Text style={styles.attachBtnText}>{isRTL ? "كاميرا" : "Caméra"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachBtn} onPress={pickImage} activeOpacity={0.8}>
                  <Ionicons name="image-outline" size={18} color={PARTNER_COLOR} />
                  <Text style={styles.attachBtnText}>{isRTL ? "صورة" : "Image"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachBtn} onPress={pickDocument} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="file-document-outline" size={18} color={PARTNER_COLOR} />
                  <Text style={styles.attachBtnText}>{isRTL ? "ملف" : "Fichier"}</Text>
                </TouchableOpacity>
              </View>

              {attachment && (
                <View style={styles.attachPreview}>
                  {attachment.type.startsWith("image/") ? (
                    <Image source={{ uri: `data:${attachment.type};base64,${attachment.data}` }} style={styles.attachImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.attachFileInfo}>
                      <MaterialCommunityIcons name={attachment.type === "application/pdf" ? "file-pdf-box" : "file-excel"} size={32} color={attachment.type === "application/pdf" ? Colors.danger : "#1D6F42"} />
                      <Text style={styles.attachFileName} numberOfLines={1}>{attachment.name}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.attachRemoveBtn} onPress={() => setAttachment(null)}>
                    <Ionicons name="close-circle" size={22} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.loginBtn, { backgroundColor: PARTNER_COLOR, marginTop: 12 }, (!orderDrug.trim() || !selectedCompany || orderSending) && styles.loginBtnDisabled]}
                onPress={handleSendOrder}
                disabled={!orderDrug.trim() || !selectedCompany || orderSending}
                activeOpacity={0.85}
              >
                {orderSending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="send" size={18} color="#fff" /><Text style={styles.loginBtnText}>{isRTL ? "إرسال للشركة" : "Envoyer à la société"}</Text></>
                }
              </TouchableOpacity>
              {!selectedCompany && <Text style={[styles.requireCompanyHint, isRTL && styles.rtlText]}>{isRTL ? "* يجب اختيار شركة للإرسال" : "* Sélectionnez une société pour envoyer"}</Text>}
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowOrderModal(false); setSelectedCompany(null); setAttachment(null); }}>
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
  pharmacyPickIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: Colors.primary + "12", alignItems: "center", justifyContent: "center" },
  pharmacyPickInfo: { flex: 1 },
  pharmacyPickName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text, marginBottom: 2 },
  pharmacyPickAddress: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  regionBadge: { backgroundColor: Colors.primary + "15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4, alignSelf: "flex-start" },
  regionBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.primary },

  pharmacyBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primary + "08", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  bannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },

  tabBar: { maxHeight: 52, backgroundColor: Colors.light.background },
  tabBarContent: { paddingHorizontal: 16, gap: 8, alignItems: "center", paddingVertical: 8 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.light.inputBackground, borderWidth: 1, borderColor: Colors.light.border },
  tabBtnActive: { backgroundColor: Colors.primary + "10", borderColor: Colors.primary + "40" },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textTertiary },
  tabBtnTextActive: { color: Colors.primary, fontFamily: "Inter_600SemiBold" },

  list: { padding: 16, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  respondedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.warning + "15", padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.warning + "30" },
  respondedBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.warning },

  requestCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.light.border, gap: 12 },
  requestCardDone: { opacity: 0.7, borderColor: Colors.warning + "50" },
  requestCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  pillIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.accent + "12", alignItems: "center", justifyContent: "center" },
  requestInfo: { flex: 1 },
  drugName: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text, marginBottom: 3 },
  requestTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary },
  pendingAdminBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.warning + "15", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pendingAdminText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.warning },
  requestActionRow: { flexDirection: "row", gap: 10, marginTop: 12, alignItems: "stretch" },
  availableBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  availableBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  dismissBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.light.background, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: Colors.light.border },
  dismissBtnText: { color: Colors.light.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  dismissIconBtn: { padding: 2 },

  repeaterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  repeaterHeaderInfo: { flex: 1 },
  repeaterTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text, marginBottom: 2 },
  repeaterSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, lineHeight: 17 },
  addRepeaterBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginLeft: 12, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },

  inventoryCard: { backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.light.border },
  inventoryRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  inventoryIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.accent + "12", alignItems: "center", justifyContent: "center" },
  inventoryInfo: { flex: 1 },

  sectionLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.light.textSecondary, marginBottom: 8 },
  companiesSection: { marginBottom: 8 },
  companyChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: PARTNER_COLOR + "12", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: PARTNER_COLOR + "30" },
  companyChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: PARTNER_COLOR },

  companyOrderCard: { backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.light.border, gap: 8 },
  orderCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  orderCardIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  orderStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  orderStatusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  companyResponseBox: { backgroundColor: Colors.accent + "10", borderRadius: 8, padding: 10 },
  responseLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.accent, marginBottom: 2 },
  responseText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.text },

  adCard: { backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.warning + "30", gap: 6 },
  adCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  adIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.warning + "12", alignItems: "center", justifyContent: "center" },
  adPrice: { fontSize: 14, fontFamily: "Inter_700Bold", color: PARTNER_COLOR },
  adNotes: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },

  bellAlertBtn: { position: "relative", padding: 4 },
  bellAlertDot: { position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 48 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center" },

  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: Colors.light.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 4 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text, textAlign: "center", marginBottom: 12 },
  modalLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, marginBottom: 6, paddingHorizontal: 2 },
  modalInput: { backgroundColor: Colors.light.inputBackground, borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.text, borderWidth: 1, borderColor: Colors.light.border },
  textArea: { height: 90, textAlignVertical: "top", paddingVertical: 12 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: Colors.light.inputBackground, borderWidth: 1, borderColor: Colors.light.border },
  typeBtnActive: { borderColor: Colors.primary + "60", backgroundColor: Colors.primary + "12" },
  typeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary },
  companyPickBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.inputBackground },
  companyPickBtnActive: { backgroundColor: PARTNER_COLOR + "15", borderColor: PARTNER_COLOR + "50" },
  companyPickText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  companyPickTextActive: { color: PARTNER_COLOR, fontFamily: "Inter_700Bold" },
  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.light.textTertiary },

  b2bExplainBanner: { backgroundColor: PARTNER_COLOR + "0C", borderBottomWidth: 1, borderBottomColor: PARTNER_COLOR + "25", paddingHorizontal: 16, paddingVertical: 12, gap: 5 },
  b2bExplainTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: PARTNER_COLOR },
  b2bExplainText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, lineHeight: 17 },

  noCompanyWarn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.warning + "12", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.warning + "30" },
  noCompanyWarnText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.warning },

  requireCompanyHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center", marginTop: 4 },

  attachBtnRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  attachBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: PARTNER_COLOR + "40", backgroundColor: PARTNER_COLOR + "08" },
  attachBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: PARTNER_COLOR },
  attachPreview: { position: "relative", marginBottom: 8, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: Colors.light.border },
  attachImage: { width: "100%", height: 150, borderRadius: 10 },
  attachFileInfo: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: Colors.light.inputBackground },
  attachFileName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.text },
  attachRemoveBtn: { position: "absolute", top: 6, right: 6, backgroundColor: "#fff", borderRadius: 12 },
});
