import React, { useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { REGIONS } from "@/constants/regions";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const ADMIN_SECRET = "DEWAYA_ADMIN_2026";


type DrugRequest = {
  id: string; userId: string; drugName: string;
  status: "pending" | "responded"; createdAt: string;
  respondedAt: string | null; pharmacyName: string | null;
  pharmacyAddress: string | null; pharmacyPhone: string | null;
};
type PendingPayment = {
  id: string; userId: string; requestId: string;
  paymentRef: string | null; createdAt: string;
  pharmacyName: string; drugName: string | null;
};
type Pharmacy = {
  id: string; name: string; nameAr: string | null;
  address: string; addressAr: string | null;
  phone: string; lat: number | null; lon: number | null;
  region: string | null; portalPin: string | null; isActive: boolean;
};
type PortalResponse = {
  id: string; requestId: string; pharmacyName: string;
  pharmacyAddress: string; pharmacyPhone: string;
  status: string; createdAt: string;
};
type DrugPrice = {
  id: string; name: string; nameAr: string | null;
  price: number; unit: string | null; category: string | null;
  notes: string | null; isActive: boolean; createdAt: string;
};

function formatTime(dateStr: string, lang = "ar") {
  return new Date(dateStr).toLocaleString(lang === "ar" ? "ar-SA" : "fr-FR", {
    hour: "2-digit", minute: "2-digit", day: "numeric", month: "short",
  });
}



export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, userId, isAdmin, adminLogout } = useApp();
  const isRTL = language === "ar";
  const qc = useQueryClient();


  const [activeTab, setActiveTab] = useState<"pending" | "responded" | "payments" | "pharmacies" | "duty" | "portal" | "prices">("pending");
  const [selectedRequest, setSelectedRequest] = useState<DrugRequest | null>(null);
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [pharmacyNameR, setPharmacyNameR] = useState("");
  const [pharmacyAddressR, setPharmacyAddressR] = useState("");
  const [pharmacyPhoneR, setPharmacyPhoneR] = useState("");
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const [showPharmacyModal, setShowPharmacyModal] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState<Pharmacy | null>(null);
  const [pName, setPName] = useState(""); const [pNameAr, setPNameAr] = useState("");
  const [pAddress, setPAddress] = useState(""); const [pAddressAr, setPAddressAr] = useState("");
  const [pPhone, setPPhone] = useState(""); const [pLat, setPLat] = useState("");
  const [pLon, setPLon] = useState(""); const [pRegion, setPRegion] = useState("");
  const [pPin, setPPin] = useState("");

  const [selectedAdminDutyRegion, setSelectedAdminDutyRegion] = useState<import("@/constants/duty-regions").DutyRegion | null>(null);
  const [showDutyImagesModal, setShowDutyImagesModal] = useState(false);
  const [showDutyUploadModal, setShowDutyUploadModal] = useState(false);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadBase64, setUploadBase64] = useState("");
  const [uploadMimeType, setUploadMimeType] = useState("image/jpeg");
  const [pickingImage, setPickingImage] = useState(false);

  const [selectedPortalResponse, setSelectedPortalResponse] = useState<PortalResponse | null>(null);
  const [showPortalModal, setShowPortalModal] = useState(false);

  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState<DrugPrice | null>(null);
  const [prSearch, setPrSearch] = useState("");
  const [dpName, setDpName] = useState("");
  const [dpNameAr, setDpNameAr] = useState("");
  const [dpPrice, setDpPrice] = useState("");
  const [dpUnit, setDpUnit] = useState("");
  const [dpCategory, setDpCategory] = useState("");
  const [dpNotes, setDpNotes] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState("");

  const { data: requests = [], isLoading: reqLoading, refetch: refetchReq, isRefetching: reqRefetching } = useQuery<DrugRequest[]>({
    queryKey: ["admin-requests"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/requests`); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 5000, enabled: isAdmin,
  });

  const { data: pendingPayments = [], isLoading: payLoading, refetch: refetchPay, isRefetching: payRefetching } = useQuery<PendingPayment[]>({
    queryKey: ["admin-pending-payments"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/notifications/admin/pending-payments`); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 5000, enabled: isAdmin,
  });

  const { data: pharmacies = [], isLoading: pharmaLoading, refetch: refetchPharma, isRefetching: pharmaRefetching } = useQuery<Pharmacy[]>({
    queryKey: ["admin-pharmacies"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/pharmacies`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: isAdmin && activeTab === "pharmacies",
  });

  const { data: dutyRegionImages = [], isLoading: dutyImgLoading, refetch: refetchDutyImages, isRefetching: dutyImgRefetching } = useQuery<{ id: string; region: string; mimeType: string; caption: string | null; isActive: boolean; uploadedAt: string }[]>({
    queryKey: ["admin-duty-images", selectedAdminDutyRegion?.id],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/duty-images/${selectedAdminDutyRegion!.id}`);
      if (!r.ok) throw new Error(); return r.json();
    },
    enabled: isAdmin && !!selectedAdminDutyRegion && showDutyImagesModal,
  });

  const { data: portalResponses = [], isLoading: portalLoading, refetch: refetchPortal, isRefetching: portalRefetching } = useQuery<PortalResponse[]>({
    queryKey: ["admin-portal-responses"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/pharmacy-portal/responses`); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 8000, enabled: isAdmin && activeTab === "portal",
  });

  const { data: allDrugPrices = [], isLoading: priceLoading, refetch: refetchPrices, isRefetching: priceRefetching } = useQuery<DrugPrice[]>({
    queryKey: ["admin-drug-prices"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/drug-prices?limit=500`, { headers: { "x-admin-secret": ADMIN_SECRET } });
      if (!r.ok) throw new Error(); return r.json();
    },
    enabled: isAdmin && activeTab === "prices",
  });

  const filteredDrugPrices = prSearch.trim()
    ? allDrugPrices.filter(p => p.name.toLowerCase().includes(prSearch.toLowerCase()) || (p.nameAr && p.nameAr.includes(prSearch)))
    : allDrugPrices;

  const savePriceMutation = useMutation({
    mutationFn: async (body: object) => {
      const url = editingPrice ? `${API_BASE}/drug-prices/${editingPrice.id}` : `${API_BASE}/drug-prices`;
      const r = await fetch(url, {
        method: editingPrice ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-drug-prices"] });
      setShowPriceModal(false); setEditingPrice(null);
      setDpName(""); setDpNameAr(""); setDpPrice(""); setDpUnit(""); setDpCategory(""); setDpNotes("");
    },
  });

  const deletePriceMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API_BASE}/drug-prices/${id}`, {
        method: "DELETE", headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-drug-prices"] }),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (rows: object[]) => {
      const r = await fetch(`${API_BASE}/drug-prices/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify(rows),
      });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin-drug-prices"] });
      setShowImportModal(false); setCsvText("");
      Alert.alert(isRTL ? "تم الاستيراد" : "Import réussi", isRTL ? `تمت إضافة ${data.inserted} دواء` : `${data.inserted} médicaments importés`);
    },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل الاستيراد" : "Échec de l'import"),
  });

  const openAddPrice = () => {
    setEditingPrice(null);
    setDpName(""); setDpNameAr(""); setDpPrice(""); setDpUnit(""); setDpCategory(""); setDpNotes("");
    setShowPriceModal(true);
  };

  const openEditPrice = (p: DrugPrice) => {
    setEditingPrice(p);
    setDpName(p.name); setDpNameAr(p.nameAr ?? ""); setDpPrice(String(p.price));
    setDpUnit(p.unit ?? ""); setDpCategory(p.category ?? ""); setDpNotes(p.notes ?? "");
    setShowPriceModal(true);
  };

  const submitPrice = () => {
    if (!dpName.trim() || !dpPrice.trim()) {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "يرجى إدخال الاسم والسعر" : "Nom et prix obligatoires"); return;
    }
    const price = parseFloat(dpPrice.replace(",", "."));
    if (isNaN(price) || price < 0) {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "سعر غير صالح" : "Prix invalide"); return;
    }
    savePriceMutation.mutate({ name: dpName.trim(), nameAr: dpNameAr.trim() || null, price, unit: dpUnit.trim() || null, category: dpCategory.trim() || null, notes: dpNotes.trim() || null });
  };

  const parseAndImportCSV = () => {
    const lines = csvText.trim().split("\n").filter(l => l.trim());
    if (lines.length === 0) { Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "لا توجد بيانات" : "Pas de données"); return; }
    const rows: object[] = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/^"|"$/g, ""));
      const name = parts[0]; const price = parseFloat((parts[1] || "").replace(",", "."));
      if (!name || isNaN(price)) continue;
      rows.push({ name, nameAr: parts[2] || null, price, unit: parts[3] || null, category: parts[4] || null });
    }
    if (rows.length === 0) { Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "لا توجد صفوف صالحة" : "Aucune ligne valide"); return; }
    bulkImportMutation.mutate(rows);
  };

  const respondMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: object }) => {
      const r = await fetch(`${API_BASE}/requests/${id}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
      setShowRespondModal(false); setSelectedRequest(null);
      setPharmacyNameR(""); setPharmacyAddressR(""); setPharmacyPhoneR("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const confirmPayMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const r = await fetch(`${API_BASE}/notifications/${notifId}/confirm-payment`, { method: "POST" });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pending-payments"] }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  });

  const savePharmacyMutation = useMutation({
    mutationFn: async () => {
      const body = { name: pName, nameAr: pNameAr || undefined, address: pAddress, addressAr: pAddressAr || undefined, phone: pPhone, lat: pLat ? parseFloat(pLat) : undefined, lon: pLon ? parseFloat(pLon) : undefined, region: pRegion || undefined, portalPin: pPin || undefined };
      if (editingPharmacy) {
        const r = await fetch(`${API_BASE}/pharmacies/${editingPharmacy.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(); return r.json();
      } else {
        const r = await fetch(`${API_BASE}/pharmacies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(); return r.json();
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pharmacies"] }); setShowPharmacyModal(false); resetPharmacyForm(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "حدث خطأ" : "Une erreur"),
  });

  const deletePharmacyMutation = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`${API_BASE}/pharmacies/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pharmacies"] }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  });

  const uploadDutyImageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAdminDutyRegion || !uploadBase64) throw new Error("No image selected");
      const r = await fetch(`${API_BASE}/duty-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ region: selectedAdminDutyRegion.id, imageData: uploadBase64, mimeType: uploadMimeType, caption: uploadCaption.trim() || null }),
      });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-duty-images", selectedAdminDutyRegion?.id] });
      setShowDutyUploadModal(false);
      setUploadBase64(""); setUploadCaption(""); setUploadMimeType("image/jpeg");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل رفع الصورة" : "Échec du téléchargement"),
  });

  const deleteDutyImageMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API_BASE}/duty-images/${id}`, { method: "DELETE", headers: { "x-admin-secret": ADMIN_SECRET } });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-duty-images", selectedAdminDutyRegion?.id] }),
  });

  const pickDutyImage = async () => {
    setPickingImage(true);
    try {
      const { launchImageLibraryAsync, MediaTypeOptions } = await import("expo-image-picker");
      const result = await launchImageLibraryAsync({ mediaTypes: MediaTypeOptions.Images, quality: 0.7, base64: true, allowsEditing: false });
      if (!result.canceled && result.assets?.[0]?.base64) {
        setUploadBase64(result.assets[0].base64);
        const uri = result.assets[0].uri ?? "";
        setUploadMimeType(uri.endsWith(".png") ? "image/png" : "image/jpeg");
      }
    } catch {
    } finally {
      setPickingImage(false);
    }
  };

  const usePortalResponseMutation = useMutation({
    mutationFn: async ({ portalRes, requestId }: { portalRes: PortalResponse; requestId: string }) => {
      const r = await fetch(`${API_BASE}/requests/${requestId}/respond`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pharmacyName: portalRes.pharmacyName, pharmacyAddress: portalRes.pharmacyAddress, pharmacyPhone: portalRes.pharmacyPhone }),
      });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-portal-responses"] });
      setShowPortalModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const resetPharmacyForm = () => { setPName(""); setPNameAr(""); setPAddress(""); setPAddressAr(""); setPPhone(""); setPLat(""); setPLon(""); setPRegion(""); setPPin(""); setEditingPharmacy(null); };

  const openEditPharmacy = (p: Pharmacy) => {
    setEditingPharmacy(p); setPName(p.name); setPNameAr(p.nameAr ?? ""); setPAddress(p.address); setPAddressAr(p.addressAr ?? ""); setPPhone(p.phone); setPLat(p.lat ? String(p.lat) : ""); setPLon(p.lon ? String(p.lon) : ""); setPRegion(p.region ?? ""); setPPin(p.portalPin ?? ""); setShowPharmacyModal(true);
  };

  const confirmDelete = (title: string, onConfirm: () => void) => {
    Alert.alert(isRTL ? "تأكيد الحذف" : "Confirmer", title, [
      { text: isRTL ? "إلغاء" : "Annuler", style: "cancel" },
      { text: isRTL ? "حذف" : "Supprimer", style: "destructive", onPress: onConfirm },
    ]);
  };

  const handleCopyRef = async (ref: string) => {
    await Clipboard.setStringAsync(ref); setCopiedRef(ref); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => setCopiedRef(null), 3000);
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const respondedRequests = requests.filter((r) => r.status === "responded");

  if (!isAdmin) {
    return (
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top, alignItems: "center", justifyContent: "center" }]}>
        <View style={styles.pinGate}>
          <View style={styles.pinIconWrap}>
            <Ionicons name="shield-outline" size={44} color={Colors.light.textTertiary} />
          </View>
          <Text style={[styles.pinTitle, isRTL && styles.rtlText]}>
            {isRTL ? "لوحة الإدارة" : "Panneau d'administration"}
          </Text>
          <Text style={[styles.pinSubtitle, isRTL && styles.rtlText]}>
            {isRTL
              ? "اضغط مطولاً على الشعار لمدة 5 ثوانٍ وأدخل رمز الدخول"
              : "Appuyez longuement sur le logo pendant 5 secondes pour accéder"}
          </Text>
          <View style={[styles.pinHintBox, isRTL && { flexDirection: "row-reverse" }]}>
            <Ionicons name="finger-print" size={20} color={Colors.primary} />
            <Text style={[styles.pinHint, isRTL && styles.rtlText]}>
              {isRTL ? "الشعار ← ضغط 5 ثوانٍ ← رمز 2026" : "Logo ← appui 5s ← code 2026"}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const TABS = [
    { id: "pending", label: isRTL ? `طلبات (${pendingRequests.length})` : `Attente (${pendingRequests.length})` },
    { id: "payments", label: isRTL ? `دفع${pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ""}` : `Pmt${pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ""}` },
    { id: "portal", label: isRTL ? `ردود${portalResponses.length > 0 ? ` (${portalResponses.length})` : ""}` : `Portail${portalResponses.length > 0 ? ` (${portalResponses.length})` : ""}` },
    { id: "pharmacies", label: isRTL ? "صيدليات" : "Pharma" },
    { id: "duty", label: isRTL ? "مداومة" : "Garde" },
    { id: "prices", label: isRTL ? "أسعار" : "Prix" },
  ];

  const isLoading =
    activeTab === "payments" ? payLoading :
    activeTab === "pharmacies" ? pharmaLoading :
    activeTab === "portal" ? portalLoading :
    activeTab === "prices" ? priceLoading :
    reqLoading;

  const isRefetching =
    activeTab === "payments" ? payRefetching :
    activeTab === "pharmacies" ? pharmaRefetching :
    activeTab === "portal" ? portalRefetching :
    activeTab === "prices" ? priceRefetching :
    reqRefetching;

  const onRefresh = () => {
    if (activeTab === "payments") refetchPay();
    else if (activeTab === "pharmacies") refetchPharma();
    else if (activeTab === "portal") refetchPortal();
    else if (activeTab === "prices") refetchPrices();
    else refetchReq();
  };

  const renderRequest = ({ item }: { item: DrugRequest }) => (
    <TouchableOpacity
      style={[styles.requestCard, item.status === "responded" && styles.respondedCard]}
      onPress={() => { if (item.status === "pending") { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedRequest(item); setShowRespondModal(true); } }}
      activeOpacity={item.status === "pending" ? 0.8 : 1}
    >
      <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
        <View style={[styles.requestIcon, item.status === "responded" ? styles.respondedIcon : styles.pendingIcon]}>
          <MaterialCommunityIcons name={item.status === "responded" ? "check-circle" : "clock-outline"} size={22} color={item.status === "responded" ? Colors.accent : Colors.warning} />
        </View>
        <View style={[styles.requestInfo, isRTL && styles.rtlInfo]}>
          <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.drugName}</Text>
          <Text style={[styles.userId, isRTL && styles.rtlText]}>{t("requestedBy")}: {item.userId.substring(0, 16)}...</Text>
          <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{formatTime(item.createdAt, language)}</Text>
          {item.status === "responded" && item.pharmacyName && (
            <View style={[styles.responseBadge, isRTL && styles.rtlRow]}>
              <Ionicons name="business-outline" size={12} color={Colors.accent} />
              <Text style={styles.responseText}>{item.pharmacyName}</Text>
            </View>
          )}
        </View>
        {item.status === "pending" && <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />}
      </View>
    </TouchableOpacity>
  );

  const renderPayment = ({ item }: { item: PendingPayment }) => {
    const isConfirming = confirmPayMutation.isPending && confirmPayMutation.variables === item.id;
    const isCopied = copiedRef === item.paymentRef;
    return (
      <View style={styles.paymentCard}>
        <View style={[styles.paymentCardTop, isRTL && styles.rtlRow]}>
          <View style={styles.paymentIconWrap}><Ionicons name="cash-outline" size={22} color={Colors.primary} /></View>
          <View style={[styles.paymentInfo, isRTL && styles.rtlInfo]}>
            <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.drugName ?? (isRTL ? "دواء" : "Médicament")}</Text>
            <Text style={[styles.userId, isRTL && styles.rtlText]}>{isRTL ? "المستخدم:" : "Utilisateur:"} {item.userId.substring(0, 16)}...</Text>
            <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{formatTime(item.createdAt, language)}</Text>
          </View>
        </View>
        <View style={styles.refBox}>
          <View style={[styles.refRow, isRTL && styles.rtlRow]}>
            <View style={styles.refLabelWrap}><Ionicons name="key-outline" size={14} color={Colors.primary} /><Text style={styles.refLabel}>{isRTL ? "الكود:" : "Code:"}</Text></View>
            <View style={[styles.refCodeWrap, isRTL && styles.rtlRow]}>
              <Text style={styles.refCode}>{item.paymentRef}</Text>
              <TouchableOpacity style={[styles.copyRefSmall, isCopied && { backgroundColor: Colors.accent }]} onPress={() => item.paymentRef && handleCopyRef(item.paymentRef)}>
                <Ionicons name={isCopied ? "checkmark" : "copy-outline"} size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.refHint, isRTL && styles.rtlText]}>{isRTL ? "تحقق أن التحويل المستلم يحمل هذا الكود في الوصف" : "Vérifiez que le virement reçu contient ce code dans la description"}</Text>
        </View>
        <TouchableOpacity style={[styles.confirmPayBtn, isConfirming && { opacity: 0.7 }]} onPress={() => confirmPayMutation.mutate(item.id)} activeOpacity={0.85} disabled={isConfirming}>
          {isConfirming ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="shield-checkmark" size={18} color="#fff" /><Text style={styles.confirmPayBtnText}>{isRTL ? "تأكيد الدفع وفتح الإشعار" : "Confirmer et débloquer"}</Text></>}
        </TouchableOpacity>
      </View>
    );
  };

  const renderPortalResponse = ({ item }: { item: PortalResponse }) => (
    <View style={styles.portalCard}>
      <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
        <View style={[styles.requestIcon, { backgroundColor: Colors.primary + "15" }]}>
          <MaterialCommunityIcons name="hospital-building" size={22} color={Colors.primary} />
        </View>
        <View style={[styles.requestInfo, isRTL && styles.rtlInfo]}>
          <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.pharmacyName}</Text>
          <Text style={[styles.userId, isRTL && styles.rtlText]}>
            {isRTL ? "طلب رقم:" : "Demande #"} {item.requestId.substring(0, 12)}
          </Text>
          <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{formatTime(item.createdAt, language)}</Text>
        </View>
        <TouchableOpacity
          style={styles.useResponseBtn}
          onPress={() => { setSelectedPortalResponse(item); setShowPortalModal(true); }}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={15} color="#fff" />
          <Text style={styles.useResponseBtnText}>{isRTL ? "إرسال" : "Envoyer"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPharmacy = ({ item }: { item: Pharmacy }) => (
    <View style={styles.pharmCard}>
      <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
        <View style={[styles.requestIcon, { backgroundColor: Colors.primary + "12" }]}>
          <MaterialCommunityIcons name="hospital-box" size={22} color={Colors.primary} />
        </View>
        <View style={[styles.requestInfo, isRTL && styles.rtlInfo]}>
          <Text style={[styles.drugName, isRTL && styles.rtlText]}>{isRTL && item.nameAr ? item.nameAr : item.name}</Text>
          <Text style={[styles.userId, isRTL && styles.rtlText]}>{item.phone}</Text>
          <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{isRTL && item.addressAr ? item.addressAr : item.address}</Text>
          <View style={[styles.tagRow, isRTL && styles.rtlRow]}>
            {item.region && <View style={styles.tag}><Text style={styles.tagText}>{item.region}</Text></View>}
            {item.portalPin && <View style={[styles.tag, { backgroundColor: Colors.accent + "15" }]}><Ionicons name="key" size={10} color={Colors.accent} /><Text style={[styles.tagText, { color: Colors.accent }]}>PIN</Text></View>}
            {item.lat && item.lon && <View style={[styles.tag, { backgroundColor: Colors.primary + "12" }]}><Ionicons name="location" size={10} color={Colors.primary} /><Text style={[styles.tagText, { color: Colors.primary }]}>GPS</Text></View>}
          </View>
        </View>
        <View style={styles.actionIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => openEditPharmacy(item)} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: Colors.danger + "10" }]} onPress={() => confirmDelete(isRTL ? "حذف هذه الصيدلية؟" : "Supprimer cette pharmacie?", () => deletePharmacyMutation.mutate(item.id))} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderDutyAdminRegions = () => {
    const { DUTY_REGIONS } = require("@/constants/duty-regions");
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 10 }}>
        {DUTY_REGIONS.map((r: import("@/constants/duty-regions").DutyRegion) => (
          <TouchableOpacity
            key={r.id}
            style={styles.dutyRegionRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedAdminDutyRegion(r);
              setShowDutyImagesModal(true);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.dutyRegionIcon]}>
              <MaterialCommunityIcons name="hospital-building" size={20} color="#DC3545" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.drugName, isRTL && styles.rtlText]}>{isRTL ? r.ar : r.fr}</Text>
              <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{isRTL ? r.fr : r.ar}</Text>
            </View>
            <View style={styles.dutyRegionBadge}>
              <Ionicons name="images-outline" size={16} color="#DC3545" />
            </View>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={18} color={Colors.light.textTertiary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderDrugPrice = ({ item }: { item: DrugPrice }) => (
    <View style={styles.requestCard}>
      <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
        <View style={[styles.cardIconCircle2, { backgroundColor: "#F59E0B22" }]}>
          <MaterialCommunityIcons name="tag-outline" size={20} color="#F59E0B" />
        </View>
        <View style={[styles.requestInfo, isRTL && styles.rtlInfo, { flex: 1 }]}>
          <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.name}</Text>
          {item.nameAr ? <Text style={[styles.userId, isRTL && styles.rtlText]}>{item.nameAr}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>{item.price.toFixed(2)} MRU{item.unit ? ` / ${item.unit}` : ""}</Text>
            </View>
            {item.category ? <View style={styles.categoryBadge}><Text style={styles.categoryText}>{item.category}</Text></View> : null}
          </View>
        </View>
        <View style={{ flexDirection: "column", gap: 6, alignItems: "center" }}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openEditPrice(item); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert(isRTL ? "حذف" : "Supprimer", isRTL ? `حذف "${item.name}"؟` : `Supprimer "${item.name}" ?`, [{ text: isRTL ? "إلغاء" : "Annuler", style: "cancel" }, { text: isRTL ? "حذف" : "Supprimer", style: "destructive", onPress: () => deletePriceMutation.mutate(item.id) }])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const isAddTab = activeTab === "pharmacies" || activeTab === "prices";
  const currentData: any[] =
    activeTab === "pending" ? pendingRequests :
    activeTab === "responded" ? respondedRequests :
    activeTab === "payments" ? pendingPayments :
    activeTab === "pharmacies" ? pharmacies :
    activeTab === "prices" ? filteredDrugPrices :
    portalResponses;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <View style={[styles.headerLeft, isRTL && styles.rtlRow]}>
          <View style={styles.adminBadge}><Ionicons name="shield" size={18} color={Colors.primary} /></View>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t("adminPanel")}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={styles.statsBadge}>
            <Text style={styles.statsText}>{pendingPayments.length}</Text>
            <Text style={styles.statsLabel}>{isRTL ? "دفع" : "Pmt"}</Text>
          </View>
          <TouchableOpacity style={styles.lockBtn} onPress={() => adminLogout()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.id as typeof activeTab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === "duty" ? renderDutyAdminRegions() : isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /><Text style={styles.loadingText}>{t("loading")}</Text></View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item.id}
          renderItem={
            (activeTab === "pharmacies" ? renderPharmacy :
            activeTab === "payments" ? renderPayment :
            activeTab === "portal" ? renderPortalResponse :
            activeTab === "prices" ? renderDrugPrice :
            renderRequest) as any
          }
          contentContainerStyle={[styles.list, currentData.length === 0 && styles.emptyList, { paddingBottom: Platform.OS === "web" ? 34 : 0 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={!!isRefetching} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            isAddTab ? (
              activeTab === "prices" ? (
                <View>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                    <TouchableOpacity style={[styles.addBtn, { flex: 1 }]} onPress={() => { openAddPrice(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} activeOpacity={0.85}>
                      <Ionicons name="add-circle-outline" size={20} color="#fff" />
                      <Text style={styles.addBtnText}>{isRTL ? "إضافة دواء" : "Ajouter un médicament"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.addBtn, { flex: 1, backgroundColor: Colors.accent }]} onPress={() => setShowImportModal(true)} activeOpacity={0.85}>
                      <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                      <Text style={styles.addBtnText}>{isRTL ? "استيراد CSV" : "Import CSV"}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.searchBarWrap}>
                    <Ionicons name="search-outline" size={16} color={Colors.light.textTertiary} />
                    <TextInput
                      style={[styles.searchBarInput, isRTL && styles.rtlText]}
                      placeholder={isRTL ? "بحث عن دواء..." : "Rechercher un médicament..."}
                      placeholderTextColor={Colors.light.textTertiary}
                      value={prSearch}
                      onChangeText={setPrSearch}
                      returnKeyType="search"
                    />
                    {prSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setPrSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color={Colors.light.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.countLabel, isRTL && styles.rtlText]}>{isRTL ? `${filteredDrugPrices.length} دواء` : `${filteredDrugPrices.length} médicament(s)`}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => { resetPharmacyForm(); setShowPharmacyModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={styles.addBtnText}>{isRTL ? "إضافة صيدلية" : "Ajouter une pharmacie"}</Text>
                </TouchableOpacity>
              )
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="inbox-remove-outline" size={64} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                {activeTab === "pharmacies" ? (isRTL ? "لا توجد صيدليات مسجلة" : "Aucune pharmacie enregistrée") :
                 activeTab === "portal" ? (isRTL ? "لا توجد ردود من الصيدليات" : "Aucune réponse de pharmacie") :
                 activeTab === "prices" ? (isRTL ? "لا توجد أسعار مسجلة" : "Aucun médicament enregistré") :
                 t("noPendingRequests")}
              </Text>
            </View>
          }
        />
      )}

      {/* Respond to drug request modal */}
      <Modal visible={showRespondModal} transparent animationType="slide" onRequestClose={() => setShowRespondModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>{t("respondToRequest")}</Text>
                {selectedRequest && (
                  <View style={styles.requestSummary}>
                    <MaterialCommunityIcons name="pill" size={18} color={Colors.primary} />
                    <Text style={[styles.requestSummaryText, isRTL && styles.rtlText]}>{selectedRequest.drugName}</Text>
                  </View>
                )}
                {[
                  { label: t("pharmacyName"), value: pharmacyNameR, setter: setPharmacyNameR, icon: "business-outline", placeholder: t("respondPlaceholder") },
                  { label: t("pharmacyAddress"), value: pharmacyAddressR, setter: setPharmacyAddressR, icon: "location-outline", placeholder: t("addressPlaceholder") },
                  { label: t("pharmacyPhone"), value: pharmacyPhoneR, setter: setPharmacyPhoneR, icon: "call-outline", placeholder: t("phonePlaceholder"), keyboardType: "phone-pad" as any },
                ].map((field) => (
                  <View key={field.label} style={styles.formGroup}>
                    <Text style={[styles.label, isRTL && styles.rtlText]}>{field.label}</Text>
                    <View style={[styles.inputRow, isRTL && styles.rtlRow]}>
                      <Ionicons name={field.icon as any} size={18} color={Colors.light.textSecondary} style={styles.inputIcon} />
                      <TextInput style={[styles.input, isRTL && styles.rtlInput]} placeholder={field.placeholder} placeholderTextColor={Colors.light.textTertiary} value={field.value} onChangeText={field.setter} textAlign={isRTL ? "right" : "left"} keyboardType={field.keyboardType} />
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={[styles.sendButton, (!pharmacyNameR || !pharmacyAddressR || !pharmacyPhoneR) && styles.sendButtonDisabled]} onPress={() => { if (selectedRequest) respondMutation.mutate({ id: selectedRequest.id, body: { pharmacyName: pharmacyNameR, pharmacyAddress: pharmacyAddressR, pharmacyPhone: pharmacyPhoneR } }); }} activeOpacity={0.85} disabled={!pharmacyNameR || !pharmacyAddressR || !pharmacyPhoneR || respondMutation.isPending}>
                  {respondMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="send" size={18} color="#fff" /><Text style={styles.sendButtonText}>{t("sendResponse")}</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowRespondModal(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>{t("cancel")}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Portal response → use for drug request modal */}
      <Modal visible={showPortalModal} transparent animationType="slide" onRequestClose={() => setShowPortalModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "55%" }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "إرسال رد الصيدلية للمستخدم" : "Envoyer la réponse à l'utilisateur"}
            </Text>
            {selectedPortalResponse && (
              <View style={styles.requestSummary}>
                <MaterialCommunityIcons name="hospital-building" size={18} color={Colors.primary} />
                <View>
                  <Text style={[styles.requestSummaryText, isRTL && styles.rtlText]}>{selectedPortalResponse.pharmacyName}</Text>
                  <Text style={[styles.userId, isRTL && styles.rtlText]}>{selectedPortalResponse.pharmacyAddress}</Text>
                </View>
              </View>
            )}
            <Text style={[styles.label, isRTL && styles.rtlText, { marginHorizontal: 20, marginTop: 10 }]}>
              {isRTL ? "هذا الرد سيُرسَل للمستخدم الذي طلب الدواء" : "Cette réponse sera envoyée à l'utilisateur qui a demandé le médicament"}
            </Text>
            <TouchableOpacity
              style={[styles.sendButton, { margin: 20 }, (usePortalResponseMutation.isPending) && { opacity: 0.7 }]}
              onPress={() => { if (selectedPortalResponse) usePortalResponseMutation.mutate({ portalRes: selectedPortalResponse, requestId: selectedPortalResponse.requestId }); }}
              disabled={usePortalResponseMutation.isPending}
              activeOpacity={0.85}
            >
              {usePortalResponseMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="send" size={18} color="#fff" /><Text style={styles.sendButtonText}>{isRTL ? "إرسال للمستخدم" : "Envoyer à l'utilisateur"}</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPortalModal(false)} activeOpacity={0.7}>
              <Text style={styles.cancelText}>{t("cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pharmacy add/edit modal */}
      <Modal visible={showPharmacyModal} transparent animationType="slide" onRequestClose={() => setShowPharmacyModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                  {editingPharmacy ? (isRTL ? "تعديل صيدلية" : "Modifier la pharmacie") : (isRTL ? "إضافة صيدلية جديدة" : "Ajouter une pharmacie")}
                </Text>
                {[
                  { label: isRTL ? "الاسم (فرنسي)" : "Nom (français)", value: pName, setter: setPName, placeholder: "Pharmacie..." },
                  { label: isRTL ? "الاسم (عربي)" : "Nom (arabe)", value: pNameAr, setter: setPNameAr, placeholder: "صيدلية..." },
                  { label: isRTL ? "العنوان" : "Adresse", value: pAddress, setter: setPAddress, placeholder: isRTL ? "العنوان بالفرنسية..." : "Adresse..." },
                  { label: isRTL ? "العنوان (عربي)" : "Adresse (arabe)", value: pAddressAr, setter: setPAddressAr, placeholder: isRTL ? "العنوان بالعربية..." : "Adresse en arabe..." },
                  { label: isRTL ? "رقم الهاتف" : "Téléphone", value: pPhone, setter: setPPhone, placeholder: "XX XXX XXX", keyboardType: "phone-pad" as any },
                  { label: isRTL ? "خط العرض (GPS)" : "Latitude (GPS)", value: pLat, setter: setPLat, placeholder: "18.08...", keyboardType: "decimal-pad" as any },
                  { label: isRTL ? "خط الطول (GPS)" : "Longitude (GPS)", value: pLon, setter: setPLon, placeholder: "-15.97...", keyboardType: "decimal-pad" as any },
                  { label: isRTL ? "رمز البوابة (للصيدلية)" : "Code portail (pharmacie)", value: pPin, setter: setPPin, placeholder: "PIN..." },
                ].map((field) => (
                  <View key={field.label} style={styles.formGroup}>
                    <Text style={[styles.label, isRTL && styles.rtlText]}>{field.label}</Text>
                    <TextInput style={[styles.input, { marginHorizontal: 0 }, isRTL && styles.rtlInput]} placeholder={field.placeholder} placeholderTextColor={Colors.light.textTertiary} value={field.value} onChangeText={field.setter} textAlign={isRTL ? "right" : "left"} keyboardType={field.keyboardType} />
                  </View>
                ))}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isRTL && styles.rtlText]}>{isRTL ? "المنطقة" : "Région"}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                    {REGIONS.map((r) => (
                      <TouchableOpacity key={r.id} style={[styles.regionChip, pRegion === r.id && styles.regionChipActive]} onPress={() => setPRegion(r.id)} activeOpacity={0.8}>
                        <Text style={[styles.regionChipText, pRegion === r.id && { color: "#fff" }]}>{isRTL ? r.ar : r.fr}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <TouchableOpacity style={[styles.sendButton, (!pName || !pAddress || !pPhone) && styles.sendButtonDisabled]} onPress={() => savePharmacyMutation.mutate()} disabled={!pName || !pAddress || !pPhone || savePharmacyMutation.isPending} activeOpacity={0.85}>
                  {savePharmacyMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={styles.sendButtonText}>{isRTL ? "حفظ" : "Enregistrer"}</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPharmacyModal(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>{t("cancel")}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Duty region images management modal */}
      <Modal visible={showDutyImagesModal} transparent animationType="slide" onRequestClose={() => { setShowDutyImagesModal(false); setSelectedAdminDutyRegion(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }, isRTL && styles.rtlText]}>
                {selectedAdminDutyRegion ? (isRTL ? selectedAdminDutyRegion.ar : selectedAdminDutyRegion.fr) : ""}
              </Text>
              <TouchableOpacity onPress={() => { setShowDutyImagesModal(false); setSelectedAdminDutyRegion(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={24} color={Colors.light.textTertiary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: "#DC3545", marginBottom: 12 }]}
              onPress={() => setShowDutyUploadModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.addBtnText}>{isRTL ? "رفع صورة جديدة" : "Télécharger une image"}</Text>
            </TouchableOpacity>
            {dutyImgLoading ? (
              <ActivityIndicator color="#DC3545" size="small" style={{ marginVertical: 20 }} />
            ) : dutyRegionImages.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
                <Ionicons name="images-outline" size={40} color={Colors.light.textTertiary} />
                <Text style={[styles.emptySub, isRTL && styles.rtlText]}>{isRTL ? "لا توجد صور لهذه المنطقة" : "Aucune image pour cette région"}</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {dutyRegionImages.map((img) => (
                  <View key={img.id} style={[styles.dutyImgRow, isRTL && styles.rtlRow]}>
                    <View style={styles.dutyImgIconWrap}>
                      <Ionicons name="image-outline" size={20} color="#DC3545" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userId, isRTL && styles.rtlText]}>{img.caption || (isRTL ? "بدون وصف" : "Sans description")}</Text>
                      <Text style={[styles.requestTime, isRTL && styles.rtlText]}>
                        {new Date(img.uploadedAt).toLocaleDateString(isRTL ? "ar-SA" : "fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => Alert.alert(
                        isRTL ? "حذف الصورة" : "Supprimer l'image",
                        isRTL ? "هل تريد حذف هذه الصورة؟" : "Supprimer cette image ?",
                        [{ text: isRTL ? "إلغاء" : "Annuler", style: "cancel" }, { text: isRTL ? "حذف" : "Supprimer", style: "destructive", onPress: () => deleteDutyImageMutation.mutate(img.id) }]
                      )}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Duty image upload modal */}
      <Modal visible={showDutyUploadModal} transparent animationType="slide" onRequestClose={() => { setShowDutyUploadModal(false); setUploadBase64(""); setUploadCaption(""); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {isRTL ? "رفع صورة مداومة" : "Télécharger une image de garde"}
              </Text>
              <TouchableOpacity
                style={[styles.imagePicker, uploadBase64 && styles.imagePickerHasImg]}
                onPress={pickDutyImage}
                activeOpacity={0.8}
                disabled={pickingImage}
              >
                {pickingImage ? (
                  <ActivityIndicator color="#DC3545" size="large" />
                ) : uploadBase64 ? (
                  <View style={{ alignItems: "center", gap: 8 }}>
                    <Image source={{ uri: `data:${uploadMimeType};base64,${uploadBase64}` }} style={styles.previewImg} resizeMode="cover" />
                    <Text style={{ fontSize: 12, color: Colors.light.textSecondary, fontFamily: "Inter_400Regular" }}>
                      {isRTL ? "اضغط لتغيير الصورة" : "Appuyer pour changer"}
                    </Text>
                  </View>
                ) : (
                  <View style={{ alignItems: "center", gap: 10 }}>
                    <Ionicons name="camera-outline" size={40} color="#DC3545" />
                    <Text style={[styles.imagePickerText, isRTL && styles.rtlText]}>
                      {isRTL ? "اضغط لاختيار صورة من المعرض" : "Appuyer pour choisir une image"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? "وصف (اختياري)" : "Description (optionnel)"}</Text>
              <TextInput
                style={[styles.modalInput, isRTL && styles.rtlInput]}
                value={uploadCaption}
                onChangeText={setUploadCaption}
                placeholder={isRTL ? "مثال: قائمة مداومة أسبوع..." : "Ex: Liste de garde semaine..."}
                placeholderTextColor={Colors.light.textTertiary}
              />
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: "#DC3545" }, !uploadBase64 && styles.sendButtonDisabled]}
                onPress={() => uploadDutyImageMutation.mutate()}
                disabled={!uploadBase64 || uploadDutyImageMutation.isPending}
                activeOpacity={0.85}
              >
                {uploadDutyImageMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="cloud-upload-outline" size={18} color="#fff" /><Text style={styles.sendButtonText}>{isRTL ? "رفع الصورة" : "Télécharger"}</Text></>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowDutyUploadModal(false); setUploadBase64(""); setUploadCaption(""); }} activeOpacity={0.7}>
                <Text style={styles.cancelText}>{t("cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Drug Price Modal */}
      <Modal visible={showPriceModal} transparent animationType="slide" onRequestClose={() => setShowPriceModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {editingPrice ? (isRTL ? "تعديل الدواء" : "Modifier le médicament") : (isRTL ? "إضافة دواء" : "Ajouter un médicament")}
              </Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? "الاسم بالفرنسية *" : "Nom en français *"}</Text>
                <TextInput style={[styles.modalInput, isRTL && styles.rtlInput]} value={dpName} onChangeText={setDpName} placeholder={isRTL ? "مثال: Paracetamol" : "Ex: Paracetamol"} placeholderTextColor={Colors.light.textTertiary} />
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? "الاسم بالعربية" : "Nom en arabe"}</Text>
                <TextInput style={[styles.modalInput, isRTL && styles.rtlInput]} value={dpNameAr} onChangeText={setDpNameAr} placeholder={isRTL ? "اختياري" : "Optionnel"} placeholderTextColor={Colors.light.textTertiary} />
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? "السعر (MRU) *" : "Prix (MRU) *"}</Text>
                <TextInput style={[styles.modalInput, isRTL && styles.rtlInput]} value={dpPrice} onChangeText={setDpPrice} placeholder="0.00" placeholderTextColor={Colors.light.textTertiary} keyboardType="decimal-pad" />
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? "الوحدة" : "Unité"}</Text>
                <TextInput style={[styles.modalInput, isRTL && styles.rtlInput]} value={dpUnit} onChangeText={setDpUnit} placeholder={isRTL ? "مثال: بوكس، حبة..." : "Ex: boîte, comprimé..."} placeholderTextColor={Colors.light.textTertiary} />
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? "الفئة" : "Catégorie"}</Text>
                <TextInput style={[styles.modalInput, isRTL && styles.rtlInput]} value={dpCategory} onChangeText={setDpCategory} placeholder={isRTL ? "مثال: مضاد حيوي..." : "Ex: Antibiotique..."} placeholderTextColor={Colors.light.textTertiary} />
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? "ملاحظات" : "Notes"}</Text>
                <TextInput style={[styles.modalInput, styles.textArea, isRTL && styles.rtlInput]} value={dpNotes} onChangeText={setDpNotes} placeholder={isRTL ? "اختياري" : "Optionnel"} placeholderTextColor={Colors.light.textTertiary} multiline numberOfLines={3} />
                <TouchableOpacity style={[styles.sendButton, (!dpName.trim() || !dpPrice.trim()) && styles.sendButtonDisabled]} onPress={submitPrice} disabled={!dpName.trim() || !dpPrice.trim() || savePriceMutation.isPending} activeOpacity={0.85}>
                  {savePriceMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={styles.sendButtonText}>{isRTL ? "حفظ" : "Enregistrer"}</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPriceModal(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>{t("cancel")}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CSV Import Modal */}
      <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>{isRTL ? "استيراد CSV" : "Import CSV"}</Text>
              <Text style={[styles.fieldLabel, { marginBottom: 8 }, isRTL && styles.rtlText]}>
                {isRTL ? "صيغة: الاسم, السعر, الاسم عربي, الوحدة, الفئة (سطر لكل دواء)" : "Format: Nom, Prix, NomArabe, Unité, Catégorie (une ligne par médicament)"}
              </Text>
              <View style={[styles.csvHintBox, isRTL && { alignItems: "flex-end" }]}>
                <Text style={styles.csvHintCode}>{"Paracetamol, 45.00, باراسيتامول, boîte\nAmoxicilline, 120.00, أموكسيسيلين, gélule, Antibiotique"}</Text>
              </View>
              <TextInput
                style={[styles.modalInput, styles.csvArea, isRTL && styles.rtlInput]}
                value={csvText}
                onChangeText={setCsvText}
                placeholder={isRTL ? "ألصق البيانات هنا..." : "Collez vos données ici..."}
                placeholderTextColor={Colors.light.textTertiary}
                multiline
                numberOfLines={8}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={[styles.sendButton, !csvText.trim() && styles.sendButtonDisabled]} onPress={parseAndImportCSV} disabled={!csvText.trim() || bulkImportMutation.isPending} activeOpacity={0.85}>
                {bulkImportMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="cloud-upload-outline" size={18} color="#fff" /><Text style={styles.sendButtonText}>{isRTL ? "استيراد" : "Importer"}</Text></>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowImportModal(false)} activeOpacity={0.7}>
                <Text style={styles.cancelText}>{t("cancel")}</Text>
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
  rtlInfo: { alignItems: "flex-end" },
  rtlInput: { textAlign: "right" },

  pinGate: { width: "90%", maxWidth: 360, alignItems: "center", gap: 14 },
  pinIconWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.primary + "12", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  pinTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.light.text },
  pinSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
  pinRow: { flexDirection: "row", alignItems: "center", width: "100%", backgroundColor: Colors.light.inputBackground, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 2, borderWidth: 1.5, borderColor: Colors.light.border, gap: 8 },
  pinRowError: { borderColor: Colors.danger },
  pinField: { flex: 1, height: 52, fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.light.text, letterSpacing: 2 },
  pinErrorText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.danger },
  pinBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 14, backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  pinBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  pinBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  pinHint: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary, flex: 1 },
  pinHintBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primary + "10", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, width: "100%" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  adminBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.light.text },
  statsBadge: { backgroundColor: Colors.primary + "15", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" },
  statsText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.primary },
  statsLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.primary },
  lockBtn: { padding: 6 },

  tabsRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: Colors.light.inputBackground, borderWidth: 1, borderColor: Colors.light.border },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textSecondary },
  tabTextActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },

  list: { padding: 16, gap: 10 },
  emptyList: { flex: 1 },

  requestCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: Colors.light.border, marginBottom: 2 },
  respondedCard: { opacity: 0.85 },
  pharmCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: Colors.light.border, marginBottom: 2 },
  portalCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.primary + "25", marginBottom: 2 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  requestIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  pendingIcon: { backgroundColor: Colors.warning + "18" },
  respondedIcon: { backgroundColor: Colors.accent + "18" },
  requestInfo: { flex: 1, gap: 2 },
  drugName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  userId: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary },
  requestTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  responseBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  responseText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.accent },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  tag: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: Colors.light.inputBackground, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  actionIcons: { flexDirection: "row", gap: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary + "10", alignItems: "center", justifyContent: "center" },
  useResponseBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  useResponseBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 },

  paymentCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: Colors.primary + "30", marginBottom: 2 },
  paymentCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  paymentIconWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary + "12", alignItems: "center", justifyContent: "center" },
  paymentInfo: { flex: 1, gap: 3 },
  refBox: { backgroundColor: Colors.primary + "08", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.primary + "25" },
  refRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  refLabelWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  refLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  refCodeWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  refCode: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.primary, letterSpacing: 2 },
  copyRefSmall: { backgroundColor: Colors.primary, borderRadius: 6, padding: 5 },
  refHint: { fontSize: 11.5, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, lineHeight: 17 },
  confirmPayBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  confirmPayBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },

  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 13, marginBottom: 14, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  addBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },

  emptyState: { alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 40 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary, textAlign: "center" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },

  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: { backgroundColor: Colors.light.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", paddingBottom: Platform.OS === "ios" ? 34 : 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.light.border, alignSelf: "center", marginTop: 12, marginBottom: 6 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.light.text, marginHorizontal: 20, marginVertical: 12 },
  requestSummary: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.primary + "0E", marginHorizontal: 20, borderRadius: 12, padding: 12, marginBottom: 12 },
  requestSummaryText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text },

  formGroup: { marginHorizontal: 20, marginBottom: 14 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, marginBottom: 6 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.inputBackground, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.light.border },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 48, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.text, backgroundColor: Colors.light.inputBackground, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.light.border },

  sendButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, marginHorizontal: 20, marginTop: 10, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  sendButtonDisabled: { opacity: 0.5, shadowOpacity: 0 },
  sendButtonText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  cancelButton: { alignItems: "center", paddingVertical: 14, marginHorizontal: 20, marginTop: 6 },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },

  regionChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.light.inputBackground, borderWidth: 1, borderColor: Colors.light.border },
  regionChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  regionChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },

  cardIconCircle2: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginRight: 12 },
  priceBadge: { backgroundColor: "#F59E0B22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  priceBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#B45309" },
  categoryBadge: { backgroundColor: Colors.primary + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  categoryText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.primary },
  searchBarWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.light.inputBackground, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.light.border, marginBottom: 8 },
  searchBarInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text },
  countLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, marginBottom: 6 },
  textArea: { height: 80, textAlignVertical: "top" },
  csvArea: { height: 160, textAlignVertical: "top", fontFamily: "monospace" as any, fontSize: 12 },
  csvHintBox: { backgroundColor: Colors.light.inputBackground, borderRadius: 10, padding: 10, marginBottom: 10 },
  csvHintCode: { fontSize: 11, fontFamily: "monospace" as any, color: Colors.light.textSecondary, lineHeight: 18 },

  dutyRegionRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.light.card, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: "#DC354520",
  },
  dutyRegionIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#DC354514",
    alignItems: "center", justifyContent: "center",
  },
  dutyRegionBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#DC354514",
    alignItems: "center", justifyContent: "center",
  },
  dutyImgRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  dutyImgIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#DC354514", alignItems: "center", justifyContent: "center",
  },
  imagePicker: {
    borderWidth: 2, borderColor: "#DC3545", borderStyle: "dashed",
    borderRadius: 16, padding: 24, alignItems: "center", justifyContent: "center",
    marginBottom: 16, minHeight: 140, backgroundColor: "#DC354508",
  },
  imagePickerHasImg: { borderStyle: "solid", padding: 8 },
  imagePickerText: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, textAlign: "center",
  },
  previewImg: { width: "100%", height: 180, borderRadius: 10 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center", lineHeight: 19 },
});
