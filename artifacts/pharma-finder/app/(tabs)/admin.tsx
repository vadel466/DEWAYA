import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
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
  Animated,
  Vibration,
} from "react-native";
import { useBell } from "@/hooks/useBell";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { REGIONS } from "@/constants/regions";
import { DewyaBrand, DewyaFooter } from "@/components/DewyaBrand";

const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_DOMAIN
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
  userPhone: string | null;
};
type Pharmacy = {
  id: string; name: string; nameAr: string | null;
  address: string; addressAr: string | null;
  phone: string; lat: number | null; lon: number | null;
  region: string | null; portalPin: string | null;
  isActive: boolean; b2bEnabled: boolean; subscriptionActive: boolean;
};
type PortalResponse = {
  id: string; requestId: string; pharmacyId: string | null; pharmacyName: string;
  pharmacyAddress: string; pharmacyPhone: string;
  status: string; adminStatus: string; createdAt: string;
  drugName: string | null;
};
type B2bMessage = {
  id: string; pharmacyId: string; pharmacyName: string;
  message: string; type: string; adminStatus: string;
  adminNote: string | null; createdAt: string;
};
type Company = {
  id: string; name: string; nameAr: string | null;
  code: string | null; contact: string | null;
  subscriptionActive: boolean; isActive: boolean;
  notes: string | null; createdAt: string;
};
type CompanyOrder = {
  id: string; pharmacyId: string; pharmacyName: string;
  companyId: string | null; companyName: string | null;
  drugName: string; quantity: string | null; message: string | null;
  type: string; status: string; companyResponse: string | null;
  respondedAt: string | null; createdAt: string;
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
  const { playAlertBell } = useBell("alert");


  const [activeTab, setActiveTab] = useState<"pending" | "responded" | "payments" | "pharmacies" | "duty" | "portal" | "prices" | "b2b" | "companies" | "nursing">("pending");
  const [hasNewRequests, setHasNewRequests] = useState(false);
  const [diagTesting, setDiagTesting] = useState(false);

  const runDiagnostic = async () => {
    setDiagTesting(true);
    try {
      const url = `${API_BASE}/drug-prices?limit=1`;
      console.log("[DIAG] Testing:", url);
      const r = await fetch(url, { headers: { "x-admin-secret": ADMIN_SECRET } });
      const body = await r.text();
      console.log("[DIAG] Status:", r.status, "Body:", body.substring(0, 200));
      Alert.alert(
        `🔧 تشخيص — Status ${r.status}`,
        `URL: ${url}\n\nResponse (${r.status}):\n${body.substring(0, 300)}`
      );
    } catch (err: any) {
      console.error("[DIAG] Error:", err);
      Alert.alert("🔴 خطأ في الاتصال", `URL: ${API_BASE}\n\nError: ${err?.message || String(err)}`);
    } finally {
      setDiagTesting(false);
    }
  };
  const prevPendingCountRef = useRef<number>(-1);
  const vibrationActiveRef = useRef(false);
  const webFileInputRef = useRef<any>(null);
  const bellShake = useRef(new Animated.Value(0)).current;
  const bellLoop = useRef<Animated.CompositeAnimation | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<DrugRequest | null>(null);
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [pharmacyNameR, setPharmacyNameR] = useState("");
  const [pharmacyAddressR, setPharmacyAddressR] = useState("");
  const [pharmacyPhoneR, setPharmacyPhoneR] = useState("");
  const [payNumInput, setPayNumInput] = useState("");
  const [editingPayNum, setEditingPayNum] = useState(false);

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
  const [confirmingResponseId, setConfirmingResponseId] = useState<string | null>(null);
  const [ignoringResponseId, setIgnoringResponseId] = useState<string | null>(null);
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null);
  const [pendingIgnoreId, setPendingIgnoreId] = useState<string | null>(null);

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
  const [showFileImportModal, setShowFileImportModal] = useState(false);
  const [excelRows, setExcelRows] = useState<{ name: string; price: number; nameAr?: string; unit?: string; category?: string; notes?: string }[]>([]);
  const [fileImportLoading, setFileImportLoading] = useState(false);
  const [fileImportSource, setFileImportSource] = useState<"excel" | "pdf" | "csv">("excel");
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, running: false, done: false });

  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [coSearch, setCoSearch] = useState("");
  const [coName, setCoName] = useState(""); const [coNameAr, setCoNameAr] = useState("");
  const [coCode, setCoCode] = useState(""); const [coContact, setCoContact] = useState("");
  const [coNotes, setCoNotes] = useState("");

  type AdminNursingRequest = { id: string; userId: string; phone: string; region: string; careType: string; description: string | null; status: string; nurseName: string | null; nursePhone: string | null; paymentCode: string | null; paymentStatus: string; nurseCount: number | null; createdAt: string; respondedAt: string | null };

  const reqTabActive = isAdmin && (activeTab === "pending" || activeTab === "responded");
  const payTabActive = isAdmin && activeTab === "payments";

  const { data: requests = [], isLoading: reqLoading, refetch: refetchReq, isRefetching: reqRefetching } = useQuery<DrugRequest[]>({
    queryKey: ["admin-requests"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/requests`); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: reqTabActive ? 5000 : false,
    enabled: reqTabActive,
  });

  const { data: pendingPayments = [], isLoading: payLoading, refetch: refetchPay, isRefetching: payRefetching } = useQuery<PendingPayment[]>({
    queryKey: ["admin-pending-payments"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/notifications/admin/pending-payments`); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: payTabActive ? 5000 : false,
    enabled: payTabActive,
  });

  const { data: payNumData, refetch: refetchPayNum } = useQuery<{ number: string | null }>({
    queryKey: ["admin-payment-number"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/settings/payment-number`); if (!r.ok) return { number: null }; return r.json(); },
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const savePayNumMutation = useMutation({
    mutationFn: async (num: string) => {
      const r = await fetch(`${API_BASE}/settings/payment-number`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ number: num }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { setEditingPayNum(false); refetchPayNum(); },
  });

  const { data: pharmacies = [], isLoading: pharmaLoading, refetch: refetchPharma, isRefetching: pharmaRefetching } = useQuery<Pharmacy[]>({
    queryKey: ["admin-pharmacies"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/pharmacies`, { headers: { "x-admin-secret": ADMIN_SECRET } }); if (!r.ok) throw new Error(); return r.json(); },
    enabled: isAdmin && activeTab === "pharmacies",
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });

  const { data: dutyRegionImages = [], isLoading: dutyImgLoading, refetch: refetchDutyImages, isRefetching: dutyImgRefetching } = useQuery<{ id: string; region: string; mimeType: string; caption: string | null; isActive: boolean; uploadedAt: string }[]>({
    queryKey: ["admin-duty-images", selectedAdminDutyRegion?.id],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/duty-images/${selectedAdminDutyRegion!.id}`);
      if (!r.ok) throw new Error(); return r.json();
    },
    enabled: isAdmin && !!selectedAdminDutyRegion && showDutyImagesModal,
  });

  const { data: allPortalResponses = [], isLoading: portalLoading, refetch: refetchPortal, isRefetching: portalRefetching } = useQuery<PortalResponse[]>({
    queryKey: ["admin-portal-responses"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/pharmacy-portal/responses`, { headers: { "x-admin-secret": ADMIN_SECRET } }); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 8000, enabled: isAdmin && (activeTab === "portal" || activeTab === "b2b"),
  });
  const portalResponses = allPortalResponses.filter(r => r.adminStatus === "pending_admin");
  const pendingPortalCount = portalResponses.length;

  const { data: b2bMessages = [], isLoading: b2bLoading, refetch: refetchB2b, isRefetching: b2bRefetching } = useQuery<B2bMessage[]>({
    queryKey: ["admin-b2b"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/pharmacy-portal/b2b`, { headers: { "x-admin-secret": ADMIN_SECRET } }); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 15000, enabled: isAdmin && activeTab === "b2b",
  });

  const { data: companies = [], isLoading: companyLoading, refetch: refetchCompanies, isRefetching: companyRefetching } = useQuery<Company[]>({
    queryKey: ["admin-companies"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/company-portal/companies`, { headers: { "x-admin-secret": ADMIN_SECRET } }); if (!r.ok) throw new Error(); return r.json(); },
    enabled: isAdmin && activeTab === "companies",
  });

  const { data: allCompanyOrders = [], isLoading: coOrdersLoading } = useQuery<CompanyOrder[]>({
    queryKey: ["admin-company-orders"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/company-portal/orders-all`, { headers: { "x-admin-secret": ADMIN_SECRET } }); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 15000, enabled: isAdmin && activeTab === "companies",
  });

  const filteredCompanies = coSearch.trim()
    ? companies.filter(c => c.name.toLowerCase().includes(coSearch.toLowerCase()) || (c.nameAr && c.nameAr.includes(coSearch)))
    : companies;

  /* ── Drug prices: load first 500 only (perf) + full count from stats ── */
  const PRICE_DISPLAY_LIMIT = 3000;

  const { data: drugTotalStats } = useQuery<{ total: number }>({
    queryKey: ["drug-prices-total"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/drug-prices/stats`);
      if (!r.ok) return { total: 0 };
      const d = await r.json();
      return { total: d.total ?? 0 };
    },
    enabled: isAdmin && activeTab === "prices",
    staleTime: 30_000,
  });
  const drugTotalCount = drugTotalStats?.total ?? 0;

  const { data: allDrugPrices = [], isLoading: priceLoading, refetch: refetchPrices, isRefetching: priceRefetching } = useQuery<DrugPrice[]>({
    queryKey: ["admin-drug-prices"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/drug-prices?limit=${PRICE_DISPLAY_LIMIT}`, { headers: { "x-admin-secret": ADMIN_SECRET } });
      if (!r.ok) throw new Error(); return r.json();
    },
    enabled: isAdmin && activeTab === "prices",
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });

  const filteredDrugPrices = prSearch.trim()
    ? allDrugPrices.filter(p => p.name.toLowerCase().includes(prSearch.toLowerCase()) || (p.nameAr && p.nameAr.includes(prSearch)))
    : allDrugPrices;

  const { data: allNursingReqs = [], isLoading: nursingLoading, refetch: refetchNursing, isRefetching: nursingRefetching } = useQuery<AdminNursingRequest[]>({
    queryKey: ["admin-nursing-requests"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/nursing/requests`, { headers: { "x-admin-secret": ADMIN_SECRET } });
      if (!r.ok) throw new Error(); return r.json();
    },
    enabled: isAdmin && activeTab === "nursing",
    refetchInterval: activeTab === "nursing" ? 30000 : false,
  });

  type DailyStats = { today: number; total: number; pending: number; responded: number; todayPending: number };
  const { data: dailyStats } = useQuery<DailyStats>({
    queryKey: ["admin-daily-stats"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/requests/stats`); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 30000,
    enabled: isAdmin,
  });

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
    playAlertBell();
  }, [bellShake, playAlertBell]);

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
      console.log("[DELETE price]", `${API_BASE}/drug-prices/${id}`);
      const r = await fetch(`${API_BASE}/drug-prices/${id}`, {
        method: "DELETE", headers: { "x-admin-secret": ADMIN_SECRET },
      });
      console.log("[DELETE price] status:", r.status);
      const text = await r.text();
      console.log("[DELETE price] body:", text);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text}`);
      return text ? JSON.parse(text) : {};
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-drug-prices"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(isRTL ? "✅ تم الحذف" : "✅ Supprimé", isRTL ? "تم حذف الدواء بنجاح" : "Médicament supprimé");
    },
    onError: (e: any) => {
      console.error("[DELETE price error]", e);
      Alert.alert(isRTL ? "خطأ في الحذف" : "Erreur de suppression", String(e?.message || e));
    },
  });

  const togglePriceMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API_BASE}/drug-prices/${id}/toggle`, {
        method: "PATCH", headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<DrugPrice>;
    },
    onSuccess: (row: DrugPrice) => {
      qc.invalidateQueries({ queryKey: ["admin-drug-prices"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onError: (e: any) => {
      webAlert(isRTL ? "خطأ في التحديث" : "Erreur", String(e?.message || e));
    },
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
      setShowFileImportModal(false); setExcelRows([]);
      Alert.alert(isRTL ? "تم الاستيراد" : "Import réussi", isRTL ? `تمت إضافة ${data.inserted} دواء` : `${data.inserted} médicaments importés`);
    },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل الاستيراد" : "Échec de l'import"),
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("[DELETE request]", `${API_BASE}/requests/${id}`);
      const r = await fetch(`${API_BASE}/requests/${id}`, {
        method: "DELETE", headers: { "x-admin-secret": ADMIN_SECRET },
      });
      console.log("[DELETE request] status:", r.status);
      const text = await r.text();
      console.log("[DELETE request] body:", text);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(isRTL ? "✅ تم الحذف" : "✅ Supprimé", isRTL ? "تم حذف الطلب بنجاح" : "Demande supprimée");
    },
    onError: (e: any) => {
      console.error("[DELETE request error]", e);
      Alert.alert(isRTL ? "خطأ في الحذف" : "Erreur de suppression", String(e?.message || e));
    },
  });

  const clearAllPricesMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/drug-prices/clear-all`, {
        method: "DELETE",
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin-drug-prices"] });
      qc.invalidateQueries({ queryKey: ["drug-prices-total"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(isRTL ? "تم المسح" : "Suppression effectuée", isRTL ? `تم حذف ${data.deleted} دواء من القاعدة` : `${data.deleted} médicaments supprimés de la base`);
    },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل المسح" : "Échec de la suppression"),
  });

  const seedNouakchottMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/pharmacies/seed-nouakchott`, {
        method: "POST",
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      const text = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text}`);
      return JSON.parse(text);
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin-pharmacies"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        isRTL ? "✅ تم إضافة صيدليات نواكشوط" : "✅ Pharmacies de Nouakchott ajoutées",
        isRTL ? `تم إضافة ${data.inserted} صيدلية بإحداثيات GPS` : `${data.inserted} pharmacies ajoutées avec coordonnées GPS`
      );
    },
    onError: (e: any) => Alert.alert(isRTL ? "خطأ" : "Erreur", String(e?.message || e)),
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

  const webAlert = (title: string, msg?: string) => {
    if (Platform.OS === "web") {
      window.alert(msg ? `${title}\n\n${msg}` : title);
    } else {
      Alert.alert(title, msg);
    }
  };

  const doSendFileToApi = async (base64: string, mimeType: string, fileName: string, replaceAll: boolean) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    try {
      const resp = await fetch(`${API_BASE}/drug-prices/upload-and-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ fileData: base64, fileType: mimeType || "application/octet-stream", fileName, replaceAll }),
        signal: controller.signal,
      });
      const data = await resp.json();
      if (!resp.ok) {
        webAlert(
          isRTL ? "خطأ في الملف" : "Erreur fichier",
          isRTL
            ? (data.errorAr || `تأكد من صيغة الملف (.xlsx / .csv / .pdf)\nالتنسيق: الاسم | السعر`)
            : (data.error || `Vérifiez le format (.xlsx / .csv / .pdf)`)
        );
        return;
      }
      qc.invalidateQueries({ queryKey: ["admin-drug-prices"] });
      qc.invalidateQueries({ queryKey: ["drug-prices-stats"] });
      qc.invalidateQueries({ queryKey: ["drug-prices-total"] });
      webAlert(
        isRTL ? "تم الاستيراد ✓" : "Import réussi ✓",
        isRTL
          ? `تمت ${replaceAll ? "استبدال قاعدة الأدوية بـ" : "إضافة"} ${data.imported} دواء بنجاح`
          : `${data.imported} médicaments ${replaceAll ? "importés (base remplacée)" : "ajoutés"} avec succès`
      );
    } finally {
      clearTimeout(timer);
    }
  };

  const sendFileToApi = async (base64: string, mimeType: string, fileName: string) => {
    /* Ask user: add to existing OR replace all */
    if (Platform.OS === "web") {
      const replace = typeof window !== "undefined" && window.confirm(
        isRTL
          ? `هل تريد استبدال جميع الأدوية الحالية بهذا الملف؟\n\n• اضغط "موافق" لاستبدال الكل (خطر: يحذف ${drugTotalCount} دواء حالي)\n• اضغط "إلغاء" لإضافة الأدوية الجديدة فقط`
          : `Remplacer tous les médicaments actuels par ce fichier ?\n\n• OK = Remplacer tout (supprime ${drugTotalCount} médicaments)\n• Annuler = Ajouter uniquement`
      );
      await doSendFileToApi(base64, mimeType, fileName, replace);
    } else {
      Alert.alert(
        isRTL ? "وضع الاستيراد" : "Mode d'import",
        isRTL
          ? `الملف: ${fileName}\n\nاختر وضع الاستيراد:`
          : `Fichier: ${fileName}\n\nChoisissez le mode d'import:`,
        [
          { text: isRTL ? "إلغاء" : "Annuler", style: "cancel" },
          {
            text: isRTL ? "➕ إضافة فقط" : "➕ Ajouter seulement",
            onPress: () => doSendFileToApi(base64, mimeType, fileName, false),
          },
          {
            text: isRTL ? "🔄 استبدال الكل" : "🔄 Remplacer tout",
            style: "destructive",
            onPress: () => {
              Alert.alert(
                isRTL ? "⚠️ تأكيد الاستبدال" : "⚠️ Confirmer remplacement",
                isRTL
                  ? `سيتم حذف ${drugTotalCount} دواء حالي نهائياً واستبدالهم بمحتوى الملف.\n\nهل أنت متأكد تماماً؟`
                  : `Les ${drugTotalCount} médicaments actuels seront définitivement supprimés.\n\nÊtes-vous sûr ?`,
                [
                  { text: isRTL ? "إلغاء" : "Annuler", style: "cancel" },
                  { text: isRTL ? "نعم، استبدل" : "Oui, remplacer", style: "destructive", onPress: () => doSendFileToApi(base64, mimeType, fileName, true) },
                ]
              );
            },
          },
        ]
      );
    }
  };

  /* web: called by the hidden <input> onChange */
  const handleWebFileChange = async (e: any) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setFileImportLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await sendFileToApi(base64, file.type || "application/octet-stream", file.name);
    } catch (err: any) {
      console.error("[handleWebFileChange]", err);
      const isAbort = err?.name === "AbortError";
      webAlert(
        isRTL ? "خطأ في معالجة الملف" : "Erreur de traitement",
        isRTL
          ? (isAbort ? "انتهت مهلة معالجة الملف. حاول مع ملف أصغر." : `${err?.message ?? "خطأ غير متوقع"}`)
          : (isAbort ? "Délai d'attente dépassé. Essayez un fichier plus petit." : `${err?.message ?? "Erreur inattendue"}`)
      );
    } finally {
      setFileImportLoading(false);
      if (webFileInputRef.current) webFileInputRef.current.value = "";
    }
  };

  const pickAndParseExcel = async () => {
    if (Platform.OS === "web") {
      webFileInputRef.current?.click();
      return;
    }
    setFileImportLoading(true);
    try {
      const { getDocumentAsync } = await import("expo-document-picker");
      const result = await getDocumentAsync({ type: ["*/*"], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const mimeType: string = asset.mimeType || "application/octet-stream";
      const name: string = asset.name || "";

      const FS = (await import("expo-file-system")) as any;
      const base64 = await FS.readAsStringAsync(asset.uri, { encoding: FS.EncodingType.Base64 });
      await sendFileToApi(base64, mimeType, name);
    } catch (e: any) {
      console.error("[pickAndParseExcel]", e);
      Alert.alert(
        isRTL ? "خطأ في رفع الملف" : "Erreur de chargement",
        isRTL ? "تعذّر قراءة الملف. تأكد من أن الملف صالح وحاول مرة أخرى." : "Impossible de lire le fichier. Vérifiez qu'il est valide et réessayez."
      );
    } finally {
      setFileImportLoading(false);
    }
  };

  const doBatchedImport = async (rows: object[]) => {
    const BATCH = 500;
    setImportProgress({ current: 0, total: rows.length, running: true, done: false });
    let inserted = 0;
    try {
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const r = await fetch(`${API_BASE}/drug-prices/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
          body: JSON.stringify(batch),
        });
        if (!r.ok) throw new Error(`Batch ${Math.floor(i / BATCH) + 1} failed`);
        const data = await r.json();
        inserted += data.inserted ?? batch.length;
        setImportProgress({ current: Math.min(i + BATCH, rows.length), total: rows.length, running: true, done: false });
      }
      setImportProgress(p => ({ ...p, running: false, done: true }));
      qc.invalidateQueries({ queryKey: ["admin-drug-prices"] });
      setExcelRows([]);
      setShowFileImportModal(false);
      Alert.alert(isRTL ? "تم الاستيراد ✓" : "Import réussi ✓", isRTL ? `تمت إضافة ${inserted} دواء إلى قاعدة البيانات` : `${inserted} médicaments ajoutés à la base de données`);
    } catch (e: any) {
      setImportProgress(p => ({ ...p, running: false }));
      Alert.alert(isRTL ? "خطأ في الاستيراد" : "Erreur d'import", String(e?.message || ""));
    }
  };

  const confirmFileImport = () => {
    if (excelRows.length === 0) return;
    doBatchedImport(excelRows);
  };

  const handleClearAllPrices = () => {
    const step1Msg = isRTL
      ? `⚠️ سيتم حذف ${drugTotalCount} دواء نهائياً من قاعدة البيانات.\n\nهذه العملية لا يمكن التراجع عنها!`
      : `⚠️ ${drugTotalCount} médicaments seront définitivement supprimés.\n\nCette opération est irréversible !`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(step1Msg)) {
        if (window.confirm(isRTL ? "تأكيد نهائي: هل أنت متأكد 100%؟" : "Confirmation finale: êtes-vous sûr à 100% ?")) {
          clearAllPricesMutation.mutate();
        }
      }
    } else {
      Alert.alert(
        isRTL ? "⚠️ مسح جميع الأدوية" : "⚠️ Effacer tous les médicaments",
        step1Msg,
        [
          { text: isRTL ? "إلغاء" : "Annuler", style: "cancel" },
          {
            text: isRTL ? "نعم، احذف الكل" : "Oui, tout supprimer",
            style: "destructive",
            onPress: () => {
              Alert.alert(
                isRTL ? "تأكيد نهائي" : "Confirmation finale",
                isRTL ? "آخر تحذير: لا يمكن استعادة البيانات بعد الحذف." : "Dernier avertissement: les données ne pourront pas être récupérées.",
                [
                  { text: isRTL ? "إلغاء" : "Annuler", style: "cancel" },
                  { text: isRTL ? "🗑️ نعم، امسح نهائياً" : "🗑️ Oui, supprimer", style: "destructive", onPress: () => clearAllPricesMutation.mutate() },
                ]
              );
            },
          },
        ]
      );
    }
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
      const body = { name: pName.trim() || pNameAr.trim(), nameAr: pNameAr.trim() || undefined, address: "", addressAr: undefined, phone: pPhone.trim(), lat: pLat ? parseFloat(pLat) : undefined, lon: pLon ? parseFloat(pLon) : undefined, region: undefined, portalPin: pPin.trim() || undefined };
      const HEADERS = { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET };
      if (editingPharmacy) {
        const r = await fetch(`${API_BASE}/pharmacies/${editingPharmacy.id}`, { method: "PUT", headers: HEADERS, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(); return r.json();
      } else {
        const r = await fetch(`${API_BASE}/pharmacies`, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(); return r.json();
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pharmacies"] }); setShowPharmacyModal(false); resetPharmacyForm(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "حدث خطأ" : "Une erreur"),
  });

  const deletePharmacyMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("[DELETE pharmacy]", `${API_BASE}/pharmacies/${id}`);
      const r = await fetch(`${API_BASE}/pharmacies/${id}`, { method: "DELETE", headers: { "x-admin-secret": ADMIN_SECRET } });
      console.log("[DELETE pharmacy] status:", r.status);
      const text = await r.text();
      console.log("[DELETE pharmacy] body:", text);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pharmacies"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(isRTL ? "✅ تم الحذف" : "✅ Supprimé", isRTL ? "تم حذف الصيدلية بنجاح" : "Pharmacie supprimée");
    },
    onError: (e: any) => {
      console.error("[DELETE pharmacy error]", e);
      Alert.alert(isRTL ? "خطأ في الحذف" : "Erreur de suppression", String(e?.message || e));
    },
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
      if (Platform.OS !== "web") {
        const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permResult.status !== "granted") {
          Alert.alert(
            isRTL ? "إذن مطلوب" : "Permission requise",
            isRTL ? "يُرجى السماح بالوصول إلى معرض الصور في الإعدادات" : "Veuillez autoriser l'accès à la galerie dans les paramètres",
            [{ text: isRTL ? "حسناً" : "OK" }]
          );
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (!asset.base64) {
          Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "لم يتم الحصول على بيانات الصورة" : "Données d'image manquantes");
          return;
        }
        setUploadBase64(asset.base64);
        const uri = asset.uri ?? "";
        setUploadMimeType(uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
      }
    } catch (err: any) {
      console.error("[pickDutyImage]", err);
      Alert.alert(
        isRTL ? "خطأ في فتح الصور" : "Erreur",
        isRTL ? `تعذّر فتح معرض الصور: ${err?.message || ""}` : `Impossible d'ouvrir la galerie: ${err?.message || ""}`
      );
    } finally {
      setPickingImage(false);
    }
  };

  const confirmResponseMutation = useMutation({
    mutationFn: async (id: string) => {
      setConfirmingResponseId(id);
      const r = await fetch(`${API_BASE}/pharmacy-portal/responses/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || "failed");
      }
      return r.json();
    },
    onSuccess: () => {
      setConfirmingResponseId(null);
      setPendingConfirmId(null);
      qc.invalidateQueries({ queryKey: ["admin-portal-responses"] });
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        isRTL ? "✅ تم الإرسال" : "✅ Envoyé",
        isRTL ? "تم تأكيد الرد وإرسال إشعار للمريض" : "Réponse confirmée et patient notifié",
      );
    },
    onError: (err: any) => {
      setConfirmingResponseId(null);
      setPendingConfirmId(null);
      Alert.alert(
        isRTL ? "خطأ" : "Erreur",
        isRTL ? `فشل التأكيد: ${err?.message || "حاول مجدداً"}` : `Échec: ${err?.message || "réessayez"}`,
      );
    },
  });

  const ignoreResponseMutation = useMutation({
    mutationFn: async (id: string) => {
      setIgnoringResponseId(id);
      const r = await fetch(`${API_BASE}/pharmacy-portal/responses/${id}/ignore`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || "failed");
      }
      return r.json();
    },
    onSuccess: () => {
      setIgnoringResponseId(null);
      setPendingIgnoreId(null);
      qc.invalidateQueries({ queryKey: ["admin-portal-responses"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        isRTL ? "تم التجاهل" : "Ignoré",
        isRTL ? "تم تجاهل الرد — الطلب لا يزال مفتوحاً" : "Réponse ignorée — La demande reste ouverte",
      );
    },
    onError: () => {
      setIgnoringResponseId(null);
      setPendingIgnoreId(null);
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل التجاهل، حاول مجدداً" : "Échec, réessayez");
    },
  });

  const approveB2bMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API_BASE}/pharmacy-portal/b2b/${id}/approve`, {
        method: "POST", headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-b2b"] }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  });

  const rejectB2bMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API_BASE}/pharmacy-portal/b2b/${id}/reject`, {
        method: "POST", headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-b2b"] }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  });

  const toggleB2bMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const r = await fetch(`${API_BASE}/pharmacy-portal/pharmacy/${id}/b2b`, {
        method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ enabled }),
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pharmacies"] }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  });

  const togglePharmacyBanMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const r = await fetch(`${API_BASE}/pharmacies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ isActive }),
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pharmacies"] }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل تغيير حالة الحظر" : "Échec du changement de statut"),
  });

  const togglePharmacySubMutation = useMutation({
    mutationFn: async ({ id, subscriptionActive }: { id: string; subscriptionActive: boolean }) => {
      const r = await fetch(`${API_BASE}/pharmacies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ subscriptionActive }),
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pharmacies"] }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل تغيير الاشتراك" : "Échec du changement d'abonnement"),
  });

  const toggleCompanyBanMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const r = await fetch(`${API_BASE}/company-portal/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ isActive }),
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-companies"] }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل تغيير حالة الحظر" : "Échec du changement de statut"),
  });

  const toggleCompanySubMutation = useMutation({
    mutationFn: async ({ id, subscriptionActive }: { id: string; subscriptionActive: boolean }) => {
      const r = await fetch(`${API_BASE}/company-portal/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ subscriptionActive }),
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-companies"] }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل تغيير الاشتراك" : "Échec du changement d'abonnement"),
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("[DELETE company]", `${API_BASE}/company-portal/companies/${id}`);
      const r = await fetch(`${API_BASE}/company-portal/companies/${id}`, {
        method: "DELETE",
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      console.log("[DELETE company] status:", r.status);
      const text = await r.text();
      console.log("[DELETE company] body:", text);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(isRTL ? "✅ تم الحذف" : "✅ Supprimé", isRTL ? "تم حذف الشركة بنجاح" : "Société supprimée");
    },
    onError: (e: any) => {
      console.error("[DELETE company error]", e);
      Alert.alert(isRTL ? "خطأ في الحذف" : "Erreur de suppression", String(e?.message || e));
    },
  });

  const usePortalResponseMutation = { isPending: false };

  const deletePortalResponseMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API_BASE}/pharmacy-portal/responses/${id}`, {
        method: "DELETE",
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-portal-responses"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert(isRTL ? "خطأ" : "Erreur", String(e?.message || e)),
  });

  const deleteAllPortalResponsesMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/pharmacy-portal/responses-all`, {
        method: "DELETE",
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-portal-responses"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert(isRTL ? "خطأ" : "Erreur", String(e?.message || e)),
  });

  const deleteB2bMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API_BASE}/pharmacy-portal/b2b-messages/${id}`, {
        method: "DELETE",
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-b2b"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert(isRTL ? "خطأ" : "Erreur", String(e?.message || e)),
  });

  const deleteAllB2bMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/pharmacy-portal/b2b-messages-all`, {
        method: "DELETE",
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-b2b"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert(isRTL ? "خطأ" : "Erreur", String(e?.message || e)),
  });

  const deleteNursingMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API_BASE}/nursing/requests/${id}`, {
        method: "DELETE",
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-nursing-requests"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert(isRTL ? "خطأ في الحذف" : "Erreur", String(e?.message || e)),
  });

  const resetPharmacyForm = () => { setPName(""); setPNameAr(""); setPAddress(""); setPAddressAr(""); setPPhone(""); setPLat(""); setPLon(""); setPRegion(""); setPPin(""); setEditingPharmacy(null); };

  const openEditPharmacy = (p: Pharmacy) => {
    setEditingPharmacy(p); setPName(p.name); setPNameAr(p.nameAr ?? ""); setPAddress(p.address); setPAddressAr(p.addressAr ?? ""); setPPhone(p.phone); setPLat(p.lat ? String(p.lat) : ""); setPLon(p.lon ? String(p.lon) : ""); setPRegion(p.region ?? ""); setPPin(p.portalPin ?? ""); setShowPharmacyModal(true);
  };

  const confirmDelete = (title: string, onConfirm: () => void) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(title)) {
        onConfirm();
      }
    } else {
      Alert.alert(isRTL ? "تأكيد الحذف" : "Confirmer", title, [
        { text: isRTL ? "إلغاء" : "Annuler", style: "cancel" },
        { text: isRTL ? "حذف" : "Supprimer", style: "destructive", onPress: onConfirm },
      ]);
    }
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

  useEffect(() => {
    if (!isAdmin) return;
    const newCount = pendingRequests.length;
    if (prevPendingCountRef.current >= 0 && newCount > prevPendingCountRef.current && activeTab !== "pending") {
      startBellAlert();
    }
    prevPendingCountRef.current = newCount;
  }, [pendingRequests.length, isAdmin]);

  useEffect(() => {
    if (activeTab === "pending" && hasNewRequests) {
      stopBellAlert();
    }
  }, [activeTab]);

  useEffect(() => {
    return () => { stopBellAlert(); };
  }, []);

  const bellRotate = bellShake.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-18deg", "0deg", "18deg"] });

  const PHARMA_GROUP = ["pharmacies", "duty"] as const;
  const B2B_GROUP = ["b2b", "companies"] as const;
  const inPharmaGroup = (PHARMA_GROUP as readonly string[]).includes(activeTab);
  const inB2bGroup = (B2B_GROUP as readonly string[]).includes(activeTab);
  const b2bPendingCount = b2bMessages.filter(m => m.adminStatus === "pending").length;

  const TABS = [
    { id: "pending", label: isRTL ? `طلبات (${pendingRequests.length})` : `Attente (${pendingRequests.length})` },
    { id: "payments", label: isRTL ? `دفع${pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ""}` : `Pmt${pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ""}` },
    { id: "portal", label: isRTL ? `ردود${pendingPortalCount > 0 ? ` ⚡${pendingPortalCount}` : (portalResponses.length > 0 ? ` (${portalResponses.length})` : "")}` : `Portail${pendingPortalCount > 0 ? ` ⚡${pendingPortalCount}` : (portalResponses.length > 0 ? ` (${portalResponses.length})` : "")}` },
    { id: "pharma-group", label: isRTL ? "الصيدليات" : "Officine" },
    { id: "b2b-group", label: isRTL ? `الشركات${b2bPendingCount > 0 ? ` ⚡${b2bPendingCount}` : ""}` : `Sociétés${b2bPendingCount > 0 ? ` ⚡${b2bPendingCount}` : ""}` },
    { id: "nursing", label: isRTL ? "التمريض" : "Soins" },
    { id: "prices", label: isRTL ? "الأدوية" : "Base méd." },
  ];

  const PHARMA_SUB_TABS = [
    { id: "pharmacies", label: isRTL ? "الصيدليات" : "Pharmacies", icon: "business-outline" as const },
    { id: "duty", label: isRTL ? "مداومة" : "Garde", icon: "moon-outline" as const },
  ];

  const B2B_SUB_TABS = [
    { id: "b2b", label: `B2B${b2bPendingCount > 0 ? ` (${b2bPendingCount})` : ""}`, icon: "cube-outline" as const },
    { id: "companies", label: isRTL ? "الشركات" : "Sociétés", icon: "briefcase-outline" as const },
  ];

  const isLoading =
    activeTab === "payments" ? payLoading :
    activeTab === "pharmacies" ? pharmaLoading :
    activeTab === "portal" ? portalLoading :
    activeTab === "prices" ? priceLoading :
    activeTab === "b2b" ? b2bLoading :
    activeTab === "companies" ? companyLoading :
    activeTab === "nursing" ? nursingLoading :
    reqLoading;

  const isRefetching =
    activeTab === "payments" ? payRefetching :
    activeTab === "pharmacies" ? pharmaRefetching :
    activeTab === "portal" ? portalRefetching :
    activeTab === "prices" ? priceRefetching :
    activeTab === "b2b" ? b2bRefetching :
    activeTab === "companies" ? companyRefetching :
    activeTab === "nursing" ? nursingRefetching :
    reqRefetching;

  const onRefresh = () => {
    if (activeTab === "payments") refetchPay();
    else if (activeTab === "pharmacies") refetchPharma();
    else if (activeTab === "portal") refetchPortal();
    else if (activeTab === "prices") refetchPrices();
    else if (activeTab === "b2b") refetchB2b();
    else if (activeTab === "companies") refetchCompanies();
    else if (activeTab === "nursing") refetchNursing();
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
        <View style={{ flexDirection: "column", gap: 8, alignItems: "center" }}>
          {item.status === "pending" && <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              confirmDelete(isRTL ? "حذف هذا الطلب نهائياً؟" : "Supprimer définitivement cette demande?", () => deleteRequestMutation.mutate(item.id));
            }}
            disabled={deleteRequestMutation.isPending}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ padding: 8 }}
          >
            {deleteRequestMutation.isPending
              ? <ActivityIndicator size="small" color={Colors.danger} />
              : <Ionicons name="trash-outline" size={22} color={Colors.danger} />}
          </Pressable>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderPayment = ({ item }: { item: PendingPayment }) => {
    const isConfirming = confirmPayMutation.isPending && confirmPayMutation.variables === item.id;
    return (
      <View style={styles.paymentCard}>
        <View style={[styles.paymentCardTop, isRTL && styles.rtlRow]}>
          <View style={styles.paymentIconWrap}><Ionicons name="cash-outline" size={22} color={Colors.primary} /></View>
          <View style={[styles.paymentInfo, isRTL && styles.rtlInfo]}>
            <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.drugName ?? (isRTL ? "دواء" : "Médicament")}</Text>
            {item.userPhone && (
              <Text style={[styles.userId, isRTL && styles.rtlText]}>
                📱 {item.userPhone}
              </Text>
            )}
            <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{formatTime(item.createdAt, language)}</Text>
          </View>
        </View>
        <Text style={[styles.refHint, isRTL && styles.rtlText]}>
          {isRTL ? "تحقق أن الدفع جاء من الرقم أعلاه في بانكيلي أو مصرفي" : "Vérifiez que le paiement provient du numéro ci-dessus dans Bankily ou Masrafi"}
        </Text>
        <TouchableOpacity style={[styles.confirmPayBtn, isConfirming && { opacity: 0.7 }]} onPress={() => confirmPayMutation.mutate(item.id)} activeOpacity={0.85} disabled={isConfirming}>
          {isConfirming ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="shield-checkmark" size={18} color="#fff" /><Text style={styles.confirmPayBtnText}>{isRTL ? "تأكيد الدفع وفتح الإشعار" : "Confirmer et débloquer"}</Text></>}
        </TouchableOpacity>
      </View>
    );
  };

  const renderPortalResponse = ({ item }: { item: PortalResponse }) => {
    const isConfirming = confirmingResponseId === item.id;
    const isIgnoring = ignoringResponseId === item.id;
    const isBusy = isConfirming || isIgnoring;
    const isPending = item.adminStatus === "pending_admin";
    const isConfirmed = item.adminStatus === "confirmed";
    const isIgnored = item.adminStatus === "ignored";
    return (
      <View style={[
        styles.portalCard,
        isConfirmed && { borderColor: Colors.accent + "40", backgroundColor: Colors.accent + "05" },
        isIgnored && { borderColor: "#88888830", backgroundColor: "#88888808" },
      ]}>
        <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
          <View style={[styles.requestIcon, {
            backgroundColor: isConfirmed ? Colors.accent + "15" : isIgnored ? "#88888812" : Colors.primary + "15"
          }]}>
            <MaterialCommunityIcons
              name={isConfirmed ? "hospital-building" : isIgnored ? "hospital-building" : "hospital-building"}
              size={22}
              color={isConfirmed ? Colors.accent : isIgnored ? "#888" : Colors.primary}
            />
          </View>
          <View style={[styles.requestInfo, isRTL && styles.rtlInfo]}>
            {item.drugName && (
              <View style={[styles.drugNameBadge, isRTL && styles.rtlRow]}>
                <MaterialCommunityIcons name="pill" size={13} color={isIgnored ? "#888" : Colors.accent} />
                <Text style={[styles.drugNameBadgeText, isIgnored && { color: "#888" }]}>{item.drugName}</Text>
              </View>
            )}
            <Text style={[styles.drugName, isRTL && styles.rtlText, isIgnored && { color: "#999" }]}>{item.pharmacyName}</Text>
            <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{item.pharmacyAddress}</Text>
            <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{item.pharmacyPhone} • {formatTime(item.createdAt, language)}</Text>
          </View>
          {/* Status badge for non-pending */}
          {isConfirmed && (
            <View style={{ backgroundColor: Colors.accent + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" }}>
              <Text style={{ fontSize: 11, color: Colors.accent, fontFamily: "Inter_600SemiBold" }}>{isRTL ? "✅ مؤكد" : "✅ Confirmé"}</Text>
            </View>
          )}
          {isIgnored && (
            <View style={{ backgroundColor: "#88888818", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" }}>
              <Text style={{ fontSize: 11, color: "#888", fontFamily: "Inter_600SemiBold" }}>{isRTL ? "✖ متجاهل" : "✖ Ignoré"}</Text>
            </View>
          )}
          {isPending && (
            <View style={{ backgroundColor: Colors.warning + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" }}>
              <Text style={{ fontSize: 11, color: Colors.warning, fontFamily: "Inter_600SemiBold" }}>{isRTL ? "⏳ معلق" : "⏳ Attente"}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => confirmDelete(
              isRTL ? "حذف هذا الرد؟" : "Supprimer cette réponse ?",
              () => deletePortalResponseMutation.mutate(item.id)
            )}
            disabled={deletePortalResponseMutation.isPending}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
        {isPending && (
          pendingConfirmId === item.id ? (
            /* Inline confirm dialog */
            <View style={[styles.inlineConfirmBox, { borderColor: Colors.accent + "40", backgroundColor: Colors.accent + "08" }]}>
              <Text style={[styles.inlineConfirmText, isRTL && styles.rtlText]}>
                {isRTL ? `✅ إرسال رد "${item.pharmacyName}" للمريض؟` : `✅ Envoyer la réponse de "${item.pharmacyName}" au patient?`}
              </Text>
              <View style={[styles.inlineConfirmBtns, isRTL && styles.rtlRow]}>
                <TouchableOpacity
                  style={[styles.confirmBtn, { flex: 1 }, isConfirming && { opacity: 0.6 }]}
                  onPress={() => confirmResponseMutation.mutate(item.id)}
                  disabled={isConfirming}
                  activeOpacity={0.85}
                >
                  {isConfirming ? <ActivityIndicator size={14} color="#fff" /> : <Ionicons name="checkmark-circle" size={15} color="#fff" />}
                  <Text style={styles.confirmBtnText}>{isRTL ? "نعم، أرسل ✓" : "Oui, envoyer ✓"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelInlineBtn}
                  onPress={() => setPendingConfirmId(null)}
                  disabled={isConfirming}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelInlineBtnText}>{isRTL ? "إلغاء" : "Annuler"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : pendingIgnoreId === item.id ? (
            /* Inline ignore dialog */
            <View style={[styles.inlineConfirmBox, { borderColor: Colors.danger + "40", backgroundColor: Colors.danger + "08" }]}>
              <Text style={[styles.inlineConfirmText, isRTL && styles.rtlText]}>
                {isRTL ? "تجاهل الرد؟ الطلب سيبقى مفتوحاً للصيدليات الأخرى" : "Ignorer? La demande restera ouverte aux autres pharmacies"}
              </Text>
              <View style={[styles.inlineConfirmBtns, isRTL && styles.rtlRow]}>
                <TouchableOpacity
                  style={[styles.ignoreBtn, { flex: 1 }, isIgnoring && { opacity: 0.6 }]}
                  onPress={() => ignoreResponseMutation.mutate(item.id)}
                  disabled={isIgnoring}
                  activeOpacity={0.8}
                >
                  {isIgnoring ? <ActivityIndicator size={14} color={Colors.danger} /> : <Ionicons name="close-circle" size={15} color={Colors.danger} />}
                  <Text style={styles.ignoreBtnText}>{isRTL ? "نعم، تجاهل" : "Oui, ignorer"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelInlineBtn}
                  onPress={() => setPendingIgnoreId(null)}
                  disabled={isIgnoring}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelInlineBtnText}>{isRTL ? "إلغاء" : "Annuler"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Normal action buttons */
            <View style={[styles.mediationBtns, isRTL && styles.rtlRow]}>
              <TouchableOpacity
                style={[styles.confirmBtn, { flex: 1 }, isBusy && { opacity: 0.6 }]}
                onPress={() => { setPendingConfirmId(item.id); setPendingIgnoreId(null); }}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={15} color="#fff" />
                <Text style={styles.confirmBtnText}>{isRTL ? "تأكيد ✓" : "Confirmer ✓"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ignoreBtn, isBusy && { opacity: 0.6 }]}
                onPress={() => { setPendingIgnoreId(item.id); setPendingConfirmId(null); }}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={15} color={Colors.danger} />
                <Text style={styles.ignoreBtnText}>{isRTL ? "تجاهل" : "Ignorer"}</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </View>
    );
  };

  const renderB2b = ({ item }: { item: B2bMessage }) => (
    <View style={[styles.portalCard, { borderColor: "#7C3AED20" }]}>
      <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
        <View style={[styles.requestIcon, { backgroundColor: "#7C3AED12" }]}>
          <MaterialCommunityIcons name={item.type === "order" ? "cart-outline" : "help-circle-outline"} size={22} color="#7C3AED" />
        </View>
        <View style={[styles.requestInfo, isRTL && styles.rtlInfo]}>
          <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.pharmacyName}</Text>
          <View style={[{ flexDirection: "row", gap: 6 }, isRTL && { flexDirection: "row-reverse" }]}>
            <View style={[styles.tag, { backgroundColor: "#7C3AED14" }]}><Text style={[styles.tagText, { color: "#7C3AED" }]}>{item.type === "order" ? (isRTL ? "طلبية" : "Commande") : (isRTL ? "استفسار" : "Demande")}</Text></View>
            <View style={[styles.tag, { backgroundColor: item.adminStatus === "approved" ? Colors.accent + "14" : item.adminStatus === "rejected" ? Colors.danger + "14" : Colors.warning + "14" }]}>
              <Text style={[styles.tagText, { color: item.adminStatus === "approved" ? Colors.accent : item.adminStatus === "rejected" ? Colors.danger : Colors.warning }]}>
                {item.adminStatus === "approved" ? (isRTL ? "موافق" : "Approuvé") : item.adminStatus === "rejected" ? (isRTL ? "مرفوض" : "Rejeté") : (isRTL ? "معلق" : "En attente")}
              </Text>
            </View>
          </View>
          <Text style={[styles.requestTime, isRTL && styles.rtlText]} numberOfLines={2}>{item.message}</Text>
          <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{formatTime(item.createdAt, language)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => confirmDelete(
            isRTL ? "حذف هذه الرسالة؟" : "Supprimer ce message ?",
            () => deleteB2bMutation.mutate(item.id)
          )}
          disabled={deleteB2bMutation.isPending}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
      {item.adminStatus === "pending" && (
        <View style={[styles.mediationBtns, isRTL && styles.rtlRow]}>
          <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: "#7C3AED" }]} onPress={() => approveB2bMutation.mutate(item.id)} disabled={approveB2bMutation.isPending} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle" size={15} color="#fff" />
            <Text style={styles.confirmBtnText}>{isRTL ? "موافقة" : "Approuver"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ignoreBtn} onPress={() => rejectB2bMutation.mutate(item.id)} disabled={rejectB2bMutation.isPending} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={15} color={Colors.danger} />
            <Text style={styles.ignoreBtnText}>{isRTL ? "رفض" : "Rejeter"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderCompany = ({ item }: { item: Company }) => (
    <View style={[styles.pharmCard, { borderColor: "#7C3AED18" }]}>
      <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
        <View style={[styles.requestIcon, { backgroundColor: "#7C3AED12" }]}>
          <MaterialCommunityIcons name="domain" size={22} color="#7C3AED" />
        </View>
        <View style={[styles.requestInfo, isRTL && styles.rtlInfo]}>
          <Text style={[styles.drugName, isRTL && styles.rtlText]}>{isRTL && item.nameAr ? item.nameAr : item.name}</Text>
          {item.nameAr && !isRTL && <Text style={styles.requestTime}>{item.nameAr}</Text>}
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {item.code
              ? <View style={[styles.tag, { backgroundColor: "#7C3AED18" }]}>
                  <Ionicons name="key" size={10} color="#7C3AED" />
                  <Text style={[styles.tagText, { color: "#7C3AED" }]}>{item.code}</Text>
                </View>
              : <View style={[styles.tag, { backgroundColor: Colors.warning + "18", borderWidth: 1, borderColor: Colors.warning + "40" }]}>
                  <Ionicons name="warning-outline" size={10} color={Colors.warning} />
                  <Text style={[styles.tagText, { color: Colors.warning }]}>{isRTL ? "بدون رمز" : "Sans code"}</Text>
                </View>
            }
            <View style={[styles.tag, { backgroundColor: item.subscriptionActive ? Colors.accent + "18" : Colors.warning + "18" }]}>
              <Text style={[styles.tagText, { color: item.subscriptionActive ? Colors.accent : Colors.warning }]}>
                {item.subscriptionActive ? (isRTL ? "اشتراك فعّال" : "Abonnement actif") : (isRTL ? "اشتراك متوقف" : "Abonnement inactif")}
              </Text>
            </View>
            {!item.isActive && (
              <View style={[styles.tag, { backgroundColor: Colors.danger + "22", borderWidth: 1, borderColor: Colors.danger + "50" }]}>
                <Ionicons name="lock-closed" size={10} color={Colors.danger} />
                <Text style={[styles.tagText, { color: Colors.danger }]}>{isRTL ? "محظور" : "Bloqué"}</Text>
              </View>
            )}
          </View>
          {item.contact && <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{item.contact}</Text>}
        </View>
        <View style={styles.actionIcons}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: item.subscriptionActive ? Colors.warning + "15" : Colors.accent + "15" }]}
            onPress={() => toggleCompanySubMutation.mutate({ id: item.id, subscriptionActive: !item.subscriptionActive })}
            disabled={toggleCompanySubMutation.isPending}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name={item.subscriptionActive ? "pause-circle-outline" : "play-circle-outline"} size={18} color={item.subscriptionActive ? Colors.warning : Colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: item.isActive ? Colors.danger + "10" : Colors.accent + "10" }]}
            onPress={() => toggleCompanyBanMutation.mutate({ id: item.id, isActive: !item.isActive })}
            disabled={toggleCompanyBanMutation.isPending}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={item.isActive ? "lock-closed-outline" : "lock-open-outline"} size={18} color={item.isActive ? Colors.danger : Colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => {
            setEditingCompany(item);
            setCoName(item.name); setCoNameAr(item.nameAr || "");
            setCoCode(item.code || ""); setCoContact(item.contact || ""); setCoNotes(item.notes || "");
            setShowCompanyModal(true);
          }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: Colors.danger + "10" }]}
            onPress={() => confirmDelete(isRTL ? "حذف هذه الشركة نهائياً؟" : "Supprimer définitivement cette société?", () => deleteCompanyMutation.mutate(item.id))}
            disabled={deleteCompanyMutation.isPending}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
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
            {item.portalPin
              ? <View style={[styles.tag, { backgroundColor: Colors.accent + "15" }]}><Ionicons name="key" size={10} color={Colors.accent} /><Text style={[styles.tagText, { color: Colors.accent }]}>{item.portalPin}</Text></View>
              : <View style={[styles.tag, { backgroundColor: Colors.warning + "18", borderWidth: 1, borderColor: Colors.warning + "40" }]}><Ionicons name="warning-outline" size={10} color={Colors.warning} /><Text style={[styles.tagText, { color: Colors.warning }]}>{isRTL ? "بدون PIN" : "Sans PIN"}</Text></View>
            }
            {item.lat && item.lon && <View style={[styles.tag, { backgroundColor: Colors.primary + "12" }]}><Ionicons name="location" size={10} color={Colors.primary} /><Text style={[styles.tagText, { color: Colors.primary }]}>GPS</Text></View>}
            <View style={[styles.tag, { backgroundColor: item.subscriptionActive ? Colors.accent + "18" : Colors.warning + "18" }]}>
              <Text style={[styles.tagText, { color: item.subscriptionActive ? Colors.accent : Colors.warning }]}>
                {item.subscriptionActive ? (isRTL ? "اشتراك فعّال" : "Abonné") : (isRTL ? "اشتراك متوقف" : "Non abonné")}
              </Text>
            </View>
            {!item.isActive && (
              <View style={[styles.tag, { backgroundColor: Colors.danger + "22", borderWidth: 1, borderColor: Colors.danger + "50" }]}>
                <Ionicons name="lock-closed" size={10} color={Colors.danger} />
                <Text style={[styles.tagText, { color: Colors.danger }]}>{isRTL ? "محظور" : "Bloqué"}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.actionIcons}>
          <TouchableOpacity
            style={[styles.b2bToggleBtn, item.b2bEnabled && styles.b2bToggleBtnOn]}
            onPress={() => toggleB2bMutation.mutate({ id: item.id, enabled: !item.b2bEnabled })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
          >
            <Text style={[styles.b2bToggleText, item.b2bEnabled && styles.b2bToggleTextOn]}>B2B</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: item.subscriptionActive ? Colors.warning + "15" : Colors.accent + "15" }]}
            onPress={() => togglePharmacySubMutation.mutate({ id: item.id, subscriptionActive: !item.subscriptionActive })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name={item.subscriptionActive ? "pause-circle-outline" : "play-circle-outline"} size={18} color={item.subscriptionActive ? Colors.warning : Colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: item.isActive ? Colors.danger + "10" : Colors.accent + "10" }]}
            onPress={() => togglePharmacyBanMutation.mutate({ id: item.id, isActive: !item.isActive })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
          >
            <Ionicons name={item.isActive ? "lock-closed-outline" : "lock-open-outline"} size={18} color={item.isActive ? Colors.danger : Colors.accent} />
          </TouchableOpacity>
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

  const renderDrugPrice = ({ item }: { item: DrugPrice }) => {
    const isToggling = togglePriceMutation.isPending && togglePriceMutation.variables === item.id;
    const isDeleting = deletePriceMutation.isPending && deletePriceMutation.variables === item.id;
    const inactive = !item.isActive;
    return (
      <View style={[
        styles.requestCard,
        inactive && { borderWidth: 1.5, borderColor: "#F59E0B55", backgroundColor: "#FFFBEB" },
      ]}>
        <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
          <View style={[styles.cardIconCircle2, { backgroundColor: inactive ? "#F59E0B22" : "#F59E0B22" }]}>
            <MaterialCommunityIcons
              name={inactive ? "eye-off-outline" : "tag-outline"}
              size={20}
              color={inactive ? "#F59E0B" : "#F59E0B"}
            />
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
            {/* Clear status message for inactive drugs */}
            {inactive && (
              <View style={{
                marginTop: 6, flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center", gap: 5,
                backgroundColor: "#FEF3C7", borderRadius: 6,
                paddingHorizontal: 8, paddingVertical: 4,
                borderWidth: 1, borderColor: "#FCD34D",
              }}>
                <Ionicons name="warning-outline" size={13} color="#D97706" />
                <Text style={{ fontSize: 11, color: "#92400E", fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left", flex: 1 }}>
                  {isRTL
                    ? "مخفي عن المستخدمين — لن يظهر في البحث. اضغط 👁 لإعادة تفعيله."
                    : "Caché aux utilisateurs — n'apparaît pas dans la recherche. Appuyez 👁 pour réactiver."}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: "column", alignItems: "center", gap: 6 }}>
            {/* Toggle visibility button */}
            <TouchableOpacity
              onPress={() => {
                if (inactive) {
                  togglePriceMutation.mutate(item.id);
                } else {
                  Alert.alert(
                    isRTL ? "إخفاء الدواء" : "Masquer le médicament",
                    isRTL
                      ? `هل تريد إخفاء "${item.name}" من نتائج البحث؟ لن يُحذف من القاعدة.`
                      : `Masquer "${item.name}" des résultats de recherche? Il ne sera pas supprimé.`,
                    [
                      { text: isRTL ? "إلغاء" : "Annuler", style: "cancel" },
                      { text: isRTL ? "إخفاء" : "Masquer", style: "destructive", onPress: () => togglePriceMutation.mutate(item.id) },
                    ]
                  );
                }
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isToggling || isDeleting}
              style={[{
                padding: 8, borderRadius: 8,
                backgroundColor: inactive ? "#059669" + "15" : "#6B728015",
              }]}
            >
              {isToggling
                ? <ActivityIndicator size="small" color="#6B7280" />
                : <Ionicons
                    name={inactive ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={inactive ? "#059669" : "#6B7280"}
                  />}
            </TouchableOpacity>
            {/* Edit button */}
            <TouchableOpacity
              onPress={() => openEditPrice(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: 8, borderRadius: 8, backgroundColor: Colors.primary + "12" }}
              disabled={isDeleting || isToggling}
            >
              <Ionicons name="create-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
            {/* Delete button */}
            <TouchableOpacity
              onPress={() => confirmDelete(
                isRTL ? `حذف "${item.name}" نهائياً؟` : `Supprimer définitivement "${item.name}" ?`,
                () => deletePriceMutation.mutate(item.id)
              )}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isDeleting || isToggling}
              style={{ padding: 8, borderRadius: 8, backgroundColor: Colors.danger + "10" }}
            >
              {isDeleting
                ? <ActivityIndicator size="small" color={Colors.danger} />
                : <Ionicons name="trash-outline" size={20} color={Colors.danger} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const NURSING_TEAL = "#0D9488";
  const renderNursingRequest = ({ item }: { item: AdminNursingRequest }) => {
    const responded = item.status === "responded";
    const payOk = item.paymentStatus === "claimed";
    return (
      <View style={[styles.requestCard, responded && styles.respondedCard]}>
        <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
          <View style={[styles.cardIconCircle2, { backgroundColor: NURSING_TEAL + "18" }]}>
            <MaterialCommunityIcons name={responded ? "account-check" : "needle"} size={22} color={NURSING_TEAL} />
          </View>
          <View style={[styles.requestInfo, isRTL && styles.rtlInfo, { flex: 1 }]}>
            <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.careType}</Text>
            <Text style={[styles.userId, isRTL && styles.rtlText]}>{item.phone} • {item.region}</Text>
            <Text style={[styles.requestTime, isRTL && styles.rtlText]}>
              {new Date(item.createdAt).toLocaleString(isRTL ? "ar-SA" : "fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
              <View style={[styles.tag, { backgroundColor: responded ? Colors.accent + "18" : NURSING_TEAL + "12" }]}>
                <Text style={[styles.tagText, { color: responded ? Colors.accent : NURSING_TEAL }]}>
                  {responded ? (isRTL ? "✅ تم الرد" : "✅ Traité") : (isRTL ? "⏳ بانتظار" : "⏳ En attente")}
                </Text>
              </View>
              <View style={[styles.tag, { backgroundColor: payOk ? Colors.accent + "18" : Colors.warning + "18" }]}>
                <Text style={[styles.tagText, { color: payOk ? Colors.accent : Colors.warning }]}>
                  {payOk ? (isRTL ? "💰 دُفع" : "💰 Payé") : (isRTL ? "💳 لم يُدفع" : "💳 Non payé")}
                </Text>
              </View>
              {item.paymentCode ? (
                <View style={[styles.tag, { backgroundColor: Colors.light.inputBackground }]}>
                  <Text style={[styles.tagText, { color: Colors.light.textSecondary }]}>{item.paymentCode}</Text>
                </View>
              ) : null}
              <View style={[styles.tag, { backgroundColor: Colors.light.border }]}>
                <Text style={[styles.tagText, { color: Colors.light.textSecondary }]}>
                  {isRTL ? `${item.nurseCount ?? 0} ممرض متاح` : `${item.nurseCount ?? 0} infirmier(s) dispo`}
                </Text>
              </View>
            </View>
            {responded && item.nurseName ? (
              <Text style={[styles.requestTime, isRTL && styles.rtlText, { color: Colors.accent, marginTop: 3 }]}>
                {isRTL ? `الممرض: ${item.nurseName} - ${item.nursePhone}` : `Infirmier: ${item.nurseName} - ${item.nursePhone}`}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => confirmDelete(
              isRTL ? "حذف الطلب؟" : "Supprimer cette demande ?",
              () => deleteNursingMutation.mutate(item.id)
            )}
            disabled={deleteNursingMutation.isPending}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const isAddTab = activeTab === "pharmacies" || activeTab === "companies";
  const currentData: any[] =
    activeTab === "pending" ? pendingRequests :
    activeTab === "responded" ? respondedRequests :
    activeTab === "payments" ? pendingPayments :
    activeTab === "pharmacies" ? pharmacies :
    activeTab === "prices" ? filteredDrugPrices :
    activeTab === "b2b" ? b2bMessages :
    activeTab === "companies" ? filteredCompanies :
    activeTab === "nursing" ? allNursingReqs :
    portalResponses;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      {Platform.OS === "web" && React.createElement("input", {
        ref: webFileInputRef,
        type: "file",
        accept: ".xlsx,.xls,.csv,.pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/pdf",
        style: { display: "none", position: "absolute" },
        onChange: handleWebFileChange,
      })}
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
          <TouchableOpacity
            style={[styles.lockBtn, { backgroundColor: "#F59E0B18" }]}
            onPress={runDiagnostic}
            disabled={diagTesting}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {diagTesting
              ? <ActivityIndicator size="small" color="#F59E0B" />
              : <Ionicons name="wifi-outline" size={18} color="#F59E0B" />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.lockBtn} onPress={() => adminLogout()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Daily stats bar */}
      {dailyStats && (
        <View style={[styles.dailyStatsBar, isRTL && styles.rtlRow]}>
          <View style={styles.dailyStatItem}>
            <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
            <Text style={styles.dailyStatValue}>{dailyStats.today}</Text>
            <Text style={styles.dailyStatLabel}>{isRTL ? "اليوم" : "Auj."}</Text>
          </View>
          <View style={styles.dailyStatDivider} />
          <View style={styles.dailyStatItem}>
            <Ionicons name="time-outline" size={13} color={Colors.warning} />
            <Text style={[styles.dailyStatValue, { color: Colors.warning }]}>{dailyStats.pending}</Text>
            <Text style={styles.dailyStatLabel}>{isRTL ? "معلّق" : "Attente"}</Text>
          </View>
          <View style={styles.dailyStatDivider} />
          <View style={styles.dailyStatItem}>
            <Ionicons name="checkmark-circle-outline" size={13} color={Colors.accent} />
            <Text style={[styles.dailyStatValue, { color: Colors.accent }]}>{dailyStats.responded}</Text>
            <Text style={styles.dailyStatLabel}>{isRTL ? "مجاب" : "Répondus"}</Text>
          </View>
          <View style={styles.dailyStatDivider} />
          <View style={styles.dailyStatItem}>
            <Ionicons name="bar-chart-outline" size={13} color={Colors.light.textSecondary} />
            <Text style={styles.dailyStatValue}>{dailyStats.total}</Text>
            <Text style={styles.dailyStatLabel}>{isRTL ? "إجمالي" : "Total"}</Text>
          </View>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {TABS.map((tab) => {
          const isPending = tab.id === "pending";
          const isGroupPharma = tab.id === "pharma-group";
          const isGroupB2b = tab.id === "b2b-group";
          const isActive = isGroupPharma ? inPharmaGroup : isGroupB2b ? inB2bGroup : activeTab === tab.id;
          const hasAlert = (isGroupB2b && b2bPendingCount > 0 && !isActive);
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabBtn,
                isActive && styles.tabBtnActive,
                isPending && hasNewRequests && !isActive && styles.tabBtnAlert,
                hasAlert && styles.tabBtnAlert,
                isGroupPharma && isActive && { backgroundColor: Colors.accent },
                isGroupB2b && isActive && { backgroundColor: "#7C3AED" },
                tab.id === "prices" && isActive && { backgroundColor: "#D97706" },
              ]}
              onPress={() => {
                if (isGroupPharma) {
                  if (!inPharmaGroup) setActiveTab("pharmacies");
                } else if (isGroupB2b) {
                  if (!inB2bGroup) setActiveTab("b2b");
                } else {
                  setActiveTab(tab.id as typeof activeTab);
                }
              }}
              activeOpacity={0.7}
            >
              {isPending ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Animated.View style={{ transform: [{ rotate: bellRotate }] }}>
                    <Ionicons
                      name={hasNewRequests ? "notifications" : "notifications-outline"}
                      size={15}
                      color={isActive ? "#fff" : (hasNewRequests ? Colors.warning : Colors.light.textSecondary)}
                    />
                  </Animated.View>
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
                  {hasNewRequests && !isActive && <View style={styles.bellDot} />}
                </View>
              ) : isGroupPharma ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons name="business-outline" size={14} color={isActive ? "#fff" : Colors.accent} />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
                  <Ionicons name={inPharmaGroup ? "chevron-up" : "chevron-down"} size={12} color={isActive ? "#ffffffaa" : Colors.light.textTertiary} />
                </View>
              ) : isGroupB2b ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons name="briefcase-outline" size={14} color={isActive ? "#fff" : "#7C3AED"} />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
                  <Ionicons name={inB2bGroup ? "chevron-up" : "chevron-down"} size={12} color={isActive ? "#ffffffaa" : Colors.light.textTertiary} />
                </View>
              ) : tab.id === "prices" ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <MaterialCommunityIcons name="pill" size={14} color={isActive ? "#fff" : "#D97706"} />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
                </View>
              ) : (
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sub-tabs for Officine group */}
      {inPharmaGroup && (
        <View style={[styles.subTabsRow, isRTL && styles.rtlRow]}>
          {PHARMA_SUB_TABS.map(sub => (
            <TouchableOpacity
              key={sub.id}
              style={[styles.subTabBtn, activeTab === sub.id && styles.subTabBtnActive]}
              onPress={() => { setActiveTab(sub.id as typeof activeTab); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.75}
            >
              <Ionicons name={sub.icon} size={14} color={activeTab === sub.id ? Colors.accent : Colors.light.textSecondary} />
              <Text style={[styles.subTabText, activeTab === sub.id && styles.subTabTextActive]}>{sub.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Sub-tabs for B2B/Sociétés group */}
      {inB2bGroup && (
        <View style={[styles.subTabsRow, isRTL && styles.rtlRow]}>
          {B2B_SUB_TABS.map(sub => (
            <TouchableOpacity
              key={sub.id}
              style={[styles.subTabBtn, activeTab === sub.id && styles.subTabBtnActiveB2b]}
              onPress={() => { setActiveTab(sub.id as typeof activeTab); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.75}
            >
              <Ionicons name={sub.icon} size={14} color={activeTab === sub.id ? "#7C3AED" : Colors.light.textSecondary} />
              <Text style={[styles.subTabText, activeTab === sub.id && styles.subTabTextActiveB2b]}>{sub.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
            activeTab === "b2b" ? renderB2b :
            activeTab === "companies" ? renderCompany :
            activeTab === "nursing" ? renderNursingRequest :
            renderRequest) as any
          }
          contentContainerStyle={[styles.list, currentData.length === 0 && styles.emptyList, { paddingBottom: Platform.OS === "web" ? 34 : 0 }]}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={15}
          initialNumToRender={15}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          refreshControl={<RefreshControl refreshing={!!isRefetching} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            activeTab === "prices" ? (
              <View>
                {/* Stats banner — always visible on prices tab */}
                {(() => {
                  const activeCount = allDrugPrices.filter(d => d.isActive).length;
                  const hiddenCount = allDrugPrices.length - activeCount;
                  const dbTotal = drugTotalCount || allDrugPrices.length;
                  return (
                    <View style={{ gap: 8, marginBottom: 10 }}>
                      {/* Total count row */}
                      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", backgroundColor: "#F0FDF4", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: "#86EFAC" }}>
                        <MaterialCommunityIcons name="database-outline" size={18} color="#059669" />
                        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#065F46", flex: 1, textAlign: isRTL ? "right" : "left" }}>
                          {isRTL
                            ? `${dbTotal} دواء في القاعدة  •  يُعرض أول ${allDrugPrices.length}`
                            : `${dbTotal} médicaments en base · affichage: ${allDrugPrices.length}`}
                        </Text>
                      </View>
                      {/* Hidden drugs warning */}
                      {hiddenCount > 0 && (
                        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", backgroundColor: "#FEF3C7", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: "#FCD34D" }}>
                          <Ionicons name="eye-off-outline" size={18} color="#D97706" />
                          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#92400E", flex: 1, textAlign: isRTL ? "right" : "left" }}>
                            {isRTL
                              ? `⚠️ ${hiddenCount} دواء مخفي — اضغط 👁 لإعادة تفعيله.`
                              : `⚠️ ${hiddenCount} caché(s) — appuyez sur 👁 pour réactiver.`}
                          </Text>
                        </View>
                      )}
                      {dbTotal === 0 && !priceLoading && (
                        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", backgroundColor: "#FEF2F2", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: "#FECACA" }}>
                          <Ionicons name="warning-outline" size={18} color="#DC2626" />
                          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#DC2626", flex: 1, textAlign: isRTL ? "right" : "left" }}>
                            {isRTL
                              ? "القاعدة فارغة — ارفع ملف Excel أو CSV أو PDF لتعبئتها"
                              : "Base vide — importez un fichier Excel, CSV ou PDF"}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })()}
                {/* Upload + Clear + Refresh row */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  {/* Upload button */}
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: "#059669", flex: 1 }]}
                    onPress={pickAndParseExcel}
                    disabled={fileImportLoading}
                    activeOpacity={0.85}
                  >
                    {fileImportLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <><MaterialCommunityIcons name="file-upload-outline" size={20} color="#fff" /><Text style={styles.addBtnText}>{isRTL ? "رفع ملف (Excel / CSV / PDF)" : "Importer Excel / CSV / PDF"}</Text></>}
                  </TouchableOpacity>
                  {/* Refresh button */}
                  <TouchableOpacity
                    style={[styles.addBtn, {
                      backgroundColor: Colors.primary,
                      paddingHorizontal: 14, flexDirection: "row", gap: 4, alignItems: "center",
                    }]}
                    onPress={() => { refetchPrices(); qc.invalidateQueries({ queryKey: ["drug-prices-total"] }); }}
                    disabled={priceRefetching}
                    activeOpacity={0.85}
                  >
                    {priceRefetching
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Ionicons name="refresh-outline" size={20} color="#fff" />}
                  </TouchableOpacity>
                  {/* Delete all button — ALWAYS active when drugTotalCount > 0 */}
                  <TouchableOpacity
                    style={[styles.addBtn, {
                      backgroundColor: drugTotalCount > 0 ? Colors.danger : "#D1D5DB",
                      paddingHorizontal: 14, flexDirection: "row", gap: 4, alignItems: "center",
                    }]}
                    onPress={handleClearAllPrices}
                    disabled={clearAllPricesMutation.isPending || drugTotalCount === 0}
                    activeOpacity={0.85}
                  >
                    {clearAllPricesMutation.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <MaterialCommunityIcons name="delete-sweep-outline" size={20} color="#fff" />}
                  </TouchableOpacity>
                </View>
                {/* Search — always visible */}
                <View style={styles.searchBarWrap}>
                  <Ionicons name="search-outline" size={16} color={Colors.light.textTertiary} />
                  <TextInput
                    style={[styles.searchBarInput, isRTL && styles.rtlText]}
                    placeholder={isRTL ? "بحث في أول 500 دواء..." : "Rechercher (500 premiers)..."}
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
                <Text style={[styles.countLabel, isRTL && styles.rtlText]}>
                  {prSearch.trim()
                    ? (isRTL ? `${filteredDrugPrices.length} نتيجة` : `${filteredDrugPrices.length} résultat(s)`)
                    : (isRTL ? `يُعرض ${allDrugPrices.length} من ${drugTotalCount || allDrugPrices.length}` : `Affichage: ${allDrugPrices.length} / ${drugTotalCount || allDrugPrices.length}`)
                  }
                </Text>
              </View>
            ) : activeTab === "payments" ? (
              <View style={{ backgroundColor: "#F0FDF4", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#86EFAC" }}>
                <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <MaterialCommunityIcons name="phone-settings" size={20} color="#059669" />
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#065F46", flex: 1, textAlign: isRTL ? "right" : "left" }}>
                    {isRTL ? "رقم الدفع الموحّد" : "Numéro de paiement unique"}
                  </Text>
                  {!editingPayNum && (
                    <TouchableOpacity
                      style={{ backgroundColor: "#059669", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                      onPress={() => { setPayNumInput(payNumData?.number ?? ""); setEditingPayNum(true); }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                        {isRTL ? "تعديل" : "Modifier"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {editingPayNum ? (
                  <View style={{ gap: 8 }}>
                    <TextInput
                      style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#86EFAC", paddingHorizontal: 14, paddingVertical: 10, fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#065F46", textAlign: "center", letterSpacing: 2 }}
                      value={payNumInput}
                      onChangeText={setPayNumInput}
                      keyboardType="phone-pad"
                      placeholder={isRTL ? "أدخل رقم الدفع..." : "Entrez le numéro..."}
                      placeholderTextColor="#94A3B8"
                      autoFocus
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: "#059669", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
                        onPress={() => savePayNumMutation.mutate(payNumInput)}
                        disabled={savePayNumMutation.isPending || payNumInput.trim().length < 4}
                        activeOpacity={0.85}
                      >
                        {savePayNumMutation.isPending
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>{isRTL ? "حفظ" : "Enregistrer"}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: "#E5E7EB", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
                        onPress={() => setEditingPayNum(false)}
                        activeOpacity={0.85}
                      >
                        <Text style={{ color: "#374151", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{isRTL ? "إلغاء" : "Annuler"}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ backgroundColor: "#fff", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", borderWidth: 1, borderColor: "#D1FAE5" }}>
                    {payNumData?.number ? (
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 22, color: "#059669", letterSpacing: 3 }}>{payNumData.number}</Text>
                    ) : (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#9CA3AF" }}>
                        {isRTL ? "لم يُضبط بعد — اضغط تعديل" : "Non défini — appuyez sur Modifier"}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ) : isAddTab ? (
              activeTab === "companies" ? (
                <View>
                  <TouchableOpacity style={[styles.addBtn, { backgroundColor: "#7C3AED" }]} onPress={() => {
                    setEditingCompany(null); setCoName(""); setCoNameAr(""); setCoCode(""); setCoContact(""); setCoNotes("");
                    setShowCompanyModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }} activeOpacity={0.85}>
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                    <Text style={styles.addBtnText}>{isRTL ? "إضافة شركة" : "Ajouter une société"}</Text>
                  </TouchableOpacity>
                  <View style={[styles.searchBarWrap, { marginTop: 8 }]}>
                    <Ionicons name="search-outline" size={16} color={Colors.light.textTertiary} />
                    <TextInput style={[styles.searchBarInput, isRTL && styles.rtlText]} placeholder={isRTL ? "بحث عن شركة..." : "Rechercher une société..."} placeholderTextColor={Colors.light.textTertiary} value={coSearch} onChangeText={setCoSearch} />
                    {coSearch.length > 0 && (<TouchableOpacity onPress={() => setCoSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={16} color={Colors.light.textTertiary} /></TouchableOpacity>)}
                  </View>
                  <Text style={[styles.countLabel, isRTL && styles.rtlText]}>{isRTL ? `${filteredCompanies.length} شركة` : `${filteredCompanies.length} société(s)`}</Text>
                  {allCompanyOrders.length > 0 && (
                    <View style={{ backgroundColor: "#7C3AED08", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#7C3AED18" }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#7C3AED", marginBottom: 6 }}>{isRTL ? "آخر الطلبات B2B" : "Dernières commandes B2B"}</Text>
                      {allCompanyOrders.slice(0, 3).map(order => (
                        <View key={order.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
                          <MaterialCommunityIcons name="package-variant" size={14} color="#7C3AED" />
                          <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.light.text }}>{order.drugName}</Text>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary }}>{order.pharmacyName}</Text>
                          <View style={[styles.tag, { backgroundColor: order.status === "responded" ? Colors.accent + "18" : Colors.warning + "18" }]}>
                            <Text style={[styles.tagText, { color: order.status === "responded" ? Colors.accent : Colors.warning }]}>{order.status === "responded" ? (isRTL ? "مجاب" : "Répondu") : (isRTL ? "انتظار" : "Attente")}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View>
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => { resetPharmacyForm(); setShowPharmacyModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                    <Text style={styles.addBtnText}>{isRTL ? "إضافة صيدلية" : "Ajouter une pharmacie"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: "#0D9488", marginTop: 8 }]}
                    onPress={() => confirmDelete(
                      isRTL ? "إضافة 15 صيدلية في نواكشوط مع إحداثيات GPS؟ (يعمل فقط إذا كانت القاعدة فارغة)" : "Ajouter 15 pharmacies de Nouakchott avec GPS ? (Uniquement si la base est vide)",
                      () => seedNouakchottMutation.mutate()
                    )}
                    disabled={seedNouakchottMutation.isPending}
                    activeOpacity={0.85}
                  >
                    {seedNouakchottMutation.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <><MaterialCommunityIcons name="map-marker-plus-outline" size={18} color="#fff" /><Text style={styles.addBtnText}>{isRTL ? "إضافة صيدليات نواكشوط التجريبية (15)" : "Seed pharmacies Nouakchott (15)"}</Text></>}
                  </TouchableOpacity>
                </View>
              )
            ) : (activeTab === "b2b" || activeTab === "portal") && currentData.length > 0 ? (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: "#ef4444", marginBottom: 8 }]}
                onPress={() => confirmDelete(
                  isRTL
                    ? (activeTab === "b2b" ? "حذف جميع طلبيات الصيدليات؟" : "حذف جميع ردود الصيدليات؟")
                    : (activeTab === "b2b" ? "Supprimer toutes les commandes pharmacies?" : "Supprimer toutes les réponses pharmacies?"),
                  activeTab === "b2b"
                    ? () => deleteAllB2bMutation.mutate()
                    : () => deleteAllPortalResponsesMutation.mutate()
                )}
                disabled={deleteAllB2bMutation.isPending || deleteAllPortalResponsesMutation.isPending}
                activeOpacity={0.85}
              >
                {(deleteAllB2bMutation.isPending || deleteAllPortalResponsesMutation.isPending)
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><MaterialCommunityIcons name="trash-can-outline" size={18} color="#fff" /><Text style={styles.addBtnText}>{isRTL ? "حذف الكل" : "Tout supprimer"}</Text></>}
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="inbox-remove-outline" size={64} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                {activeTab === "pharmacies" ? (isRTL ? "لا توجد صيدليات مسجلة" : "Aucune pharmacie enregistrée") :
                 activeTab === "portal" ? (isRTL ? "لا توجد ردود من الصيدليات" : "Aucune réponse de pharmacie") :
                 activeTab === "prices" ? (isRTL ? "لا توجد أسعار مسجلة" : "Aucun médicament enregistré") :
                 activeTab === "b2b" ? (isRTL ? "لا توجد رسائل B2B" : "Aucun message B2B") :
                 activeTab === "companies" ? (isRTL ? "لا توجد شركات مسجلة" : "Aucune société enregistrée") :
                 activeTab === "nursing" ? (isRTL ? "لا توجد طلبات تمريض بعد" : "Aucune demande de soins") :
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
              <DewyaBrand isRTL={isRTL} size="md" variant="bar" />
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
                <DewyaFooter isRTL={isRTL} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
                  { label: isRTL ? "اسم الصيدلية (عربي) *" : "Nom pharmacie (arabe) *", value: pNameAr, setter: setPNameAr, placeholder: "صيدلية...", icon: "business-outline" },
                  { label: isRTL ? "اسم الصيدلية (فرنسي) *" : "Nom pharmacie (français) *", value: pName, setter: setPName, placeholder: "Pharmacie...", icon: "business-outline" },
                  { label: isRTL ? "رقم الهاتف *" : "Téléphone *", value: pPhone, setter: setPPhone, placeholder: "XX XXX XXX", keyboardType: "phone-pad" as any, icon: "call-outline" },
                  { label: isRTL ? "رمز الدخول الخاص بالصيدلية" : "Code d'accès de la pharmacie", value: pPin, setter: setPPin, placeholder: isRTL ? "رمز سري..." : "Code secret...", icon: "lock-closed-outline" },
                ].map((field) => (
                  <View key={field.label} style={styles.formGroup}>
                    <Text style={[styles.label, isRTL && styles.rtlText]}>{field.label}</Text>
                    <View style={[styles.inputRow, isRTL && styles.rtlRow]}>
                      <Ionicons name={field.icon as any} size={16} color={Colors.light.textSecondary} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.inputInner, isRTL && styles.rtlInput]}
                        placeholder={field.placeholder}
                        placeholderTextColor={Colors.light.textTertiary}
                        value={field.value}
                        onChangeText={field.setter}
                        textAlign={isRTL ? "right" : "left"}
                        keyboardType={field.keyboardType}
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                ))}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isRTL && styles.rtlText]}>{isRTL ? "موقع GPS" : "Localisation GPS"}</Text>
                  <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 8 }}>
                    <View style={[styles.inputRow, isRTL && styles.rtlRow, { flex: 1 }]}>
                      <Ionicons name="navigate-outline" size={16} color={Colors.light.textSecondary} style={styles.inputIcon} />
                      <TextInput style={[styles.inputInner, isRTL && styles.rtlInput]} placeholder={isRTL ? "خط العرض" : "Latitude"} placeholderTextColor={Colors.light.textTertiary} value={pLat} onChangeText={setPLat} keyboardType="decimal-pad" textAlign={isRTL ? "right" : "left"} />
                    </View>
                    <View style={[styles.inputRow, isRTL && styles.rtlRow, { flex: 1 }]}>
                      <Ionicons name="navigate-outline" size={16} color={Colors.light.textSecondary} style={styles.inputIcon} />
                      <TextInput style={[styles.inputInner, isRTL && styles.rtlInput]} placeholder={isRTL ? "خط الطول" : "Longitude"} placeholderTextColor={Colors.light.textTertiary} value={pLon} onChangeText={setPLon} keyboardType="decimal-pad" textAlign={isRTL ? "right" : "left"} />
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={[styles.sendButton, ((!pNameAr && !pName) || !pPhone) && styles.sendButtonDisabled]} onPress={() => savePharmacyMutation.mutate()} disabled={(!pNameAr && !pName) || !pPhone || savePharmacyMutation.isPending} activeOpacity={0.85}>
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
                      onPress={() => confirmDelete(
                        isRTL ? "هل تريد حذف هذه الصورة؟" : "Supprimer cette image ?",
                        () => deleteDutyImageMutation.mutate(img.id)
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

      {/* File (Excel/PDF) Import Preview Modal */}
      <Modal visible={showFileImportModal} transparent animationType="slide" onRequestClose={() => { if (!importProgress.running) { setShowFileImportModal(false); setExcelRows([]); setImportProgress({ current: 0, total: 0, running: false, done: false }); } }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "85%" }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {importProgress.running
                ? (isRTL ? "جارٍ الاستيراد..." : "Importation en cours...")
                : (isRTL ? "معاينة الملف" : "Aperçu du fichier")}
            </Text>

            {importProgress.running ? (
              <View style={{ padding: 20, alignItems: "center", gap: 16 }}>
                <ActivityIndicator size="large" color="#059669" />
                <Text style={[{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#059669" }, isRTL && styles.rtlText]}>
                  {isRTL
                    ? `${importProgress.current} / ${importProgress.total} دواء`
                    : `${importProgress.current} / ${importProgress.total} médicaments`}
                </Text>
                <View style={{ width: "100%", height: 8, backgroundColor: Colors.light.border, borderRadius: 4, overflow: "hidden" }}>
                  <View style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`, height: "100%", backgroundColor: "#059669", borderRadius: 4 }} />
                </View>
                <Text style={[{ fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary }, isRTL && styles.rtlText]}>
                  {isRTL ? "يرجى الانتظار، لا تغلق النافذة" : "Veuillez patienter, ne fermez pas cette fenêtre"}
                </Text>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: fileImportSource === "pdf" ? "#E53E3E15" : "#05966915", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <MaterialCommunityIcons name={fileImportSource === "pdf" ? "file-pdf-box" : "file-excel-box"} size={32} color={fileImportSource === "pdf" ? "#E53E3E" : "#059669"} />
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontFamily: "Inter_700Bold", fontSize: 15, color: fileImportSource === "pdf" ? "#E53E3E" : "#059669" }, isRTL && styles.rtlText]}>
                      {isRTL ? `${excelRows.length} دواء جاهز للاستيراد` : `${excelRows.length} médicaments prêts`}
                    </Text>
                    <Text style={[{ fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 }, isRTL && styles.rtlText]}>
                      {fileImportSource === "pdf"
                        ? (isRTL ? "مستخرج من ملف PDF — راجع البيانات قبل الاستيراد" : "Extrait du PDF — vérifiez avant d'importer")
                        : (isRTL ? "سيتم إضافتها إلى قاعدة بيانات الأسعار" : "Seront ajoutés à la base des prix")}
                    </Text>
                  </View>
                </View>
                <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                  {excelRows.slice(0, 30).map((row, i) => (
                    <View key={i} style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.light.border, gap: 8 }}>
                      <Text style={{ width: 26, fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textTertiary, textAlign: "center" }}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text }} numberOfLines={1}>{row.name}</Text>
                        {row.nameAr ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, textAlign: "right" }}>{row.nameAr}</Text> : null}
                        {row.category ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textTertiary }}>{row.category}</Text> : null}
                      </View>
                      <View style={{ backgroundColor: Colors.primary + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.primary }}>{row.price} MRU</Text>
                      </View>
                      {row.unit ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary }}>{row.unit}</Text> : null}
                    </View>
                  ))}
                  {excelRows.length > 30 && (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textTertiary, textAlign: "center", paddingVertical: 10 }}>
                      {isRTL ? `... و ${excelRows.length - 30} دواء آخر` : `... et ${excelRows.length - 30} autres médicaments`}
                    </Text>
                  )}
                </ScrollView>
                <TouchableOpacity style={[styles.sendButton, { marginTop: 14, backgroundColor: "#059669" }]} onPress={confirmFileImport} activeOpacity={0.85}>
                  <MaterialCommunityIcons name="database-import-outline" size={18} color="#fff" />
                  <Text style={styles.sendButtonText}>
                    {isRTL ? `استيراد ${excelRows.length} دواء` : `Importer ${excelRows.length} médicaments`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowFileImportModal(false); setExcelRows([]); setImportProgress({ current: 0, total: 0, running: false, done: false }); }} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>{isRTL ? "إلغاء" : "Annuler"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>


      {/* Company add/edit modal */}
      <Modal visible={showCompanyModal} transparent animationType="slide" onRequestClose={() => setShowCompanyModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                  {editingCompany ? (isRTL ? "تعديل الشركة" : "Modifier la société") : (isRTL ? "إضافة شركة جديدة" : "Ajouter une société")}
                </Text>
                {[
                  { label: isRTL ? "اسم الشركة (فرنسي) *" : "Nom (français) *", value: coName, setter: setCoName, placeholder: isRTL ? "اسم الشركة" : "Nom de la société" },
                  { label: isRTL ? "اسم الشركة (عربي)" : "Nom (arabe)", value: coNameAr, setter: setCoNameAr, placeholder: isRTL ? "الاسم بالعربية" : "Nom en arabe", rtl: true },
                  { label: isRTL ? "رمز الدخول *" : "Code d'accès *", value: coCode, setter: setCoCode, placeholder: isRTL ? "مثال: PHARMA2026" : "Ex: PHARMA2026" },
                  { label: isRTL ? "جهة التواصل" : "Contact", value: coContact, setter: setCoContact, placeholder: isRTL ? "رقم الهاتف أو الإيميل" : "Téléphone ou email" },
                  { label: isRTL ? "ملاحظات" : "Notes", value: coNotes, setter: setCoNotes, placeholder: isRTL ? "ملاحظات إضافية..." : "Notes supplémentaires..." },
                ].map(({ label, value, setter, placeholder, rtl }) => (
                  <View key={label} style={styles.formGroup}>
                    <Text style={[styles.label, isRTL && styles.rtlText]}>{label}</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={[styles.modalInput, { flex: 1, borderWidth: 0 }, (isRTL || rtl) && styles.rtlInput]}
                        value={value} onChangeText={setter}
                        placeholder={placeholder} placeholderTextColor={Colors.light.textTertiary}
                        textAlign={(isRTL || rtl) ? "right" : "left"}
                      />
                    </View>
                  </View>
                ))}
                <View style={[styles.formGroup, { flexDirection: "row", gap: 10 }]}>
                  <TouchableOpacity
                    style={[styles.addBtn, { flex: 1 }, { backgroundColor: "#7C3AED" }, (!coName.trim() || !coCode.trim()) && { opacity: 0.5 }]}
                    onPress={async () => {
                      if (!coName.trim() || !coCode.trim()) return;
                      try {
                        const url = editingCompany ? `${API_BASE}/company-portal/companies/${editingCompany.id}` : `${API_BASE}/company-portal/companies`;
                        const resp = await fetch(url, {
                          method: editingCompany ? "PATCH" : "POST",
                          headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
                          body: JSON.stringify({ name: coName.trim(), nameAr: coNameAr.trim() || null, code: coCode.trim().toUpperCase(), contact: coContact.trim() || null, notes: coNotes.trim() || null }),
                        });
                        if (resp.ok) { refetchCompanies(); setShowCompanyModal(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
                        else { Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل حفظ الشركة" : "Échec de l'enregistrement"); }
                      } catch (e: any) {
                        Alert.alert(isRTL ? "خطأ في الاتصال" : "Erreur réseau", isRTL ? `تعذّر الاتصال بالخادم\n${e?.message || ""}` : `Impossible de joindre le serveur\n${e?.message || ""}`);
                      }
                    }}
                    disabled={!coName.trim() || !coCode.trim()} activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.addBtnText}>{isRTL ? "حفظ" : "Enregistrer"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.addBtn, { flex: 0.5, backgroundColor: Colors.light.inputBackground }]} onPress={() => setShowCompanyModal(false)} activeOpacity={0.7}>
                    <Text style={[styles.addBtnText, { color: Colors.light.textSecondary }]}>{t("cancel")}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
  deleteBtn: { padding: 8, borderRadius: 8, alignSelf: "flex-start", alignItems: "center", justifyContent: "center" },
  pharmCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: Colors.light.border, marginBottom: 2 },
  portalCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.primary + "25", marginBottom: 2 },
  drugNameBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.accent + "12", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start", marginBottom: 5 },
  drugNameBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.accent },
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
  modalCard: { backgroundColor: Colors.light.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", paddingBottom: Platform.OS === "ios" ? 34 : 20, paddingHorizontal: 20, paddingTop: 8 },
  modalInput: { backgroundColor: Colors.light.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text, borderWidth: 1, borderColor: Colors.light.border },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, marginBottom: 5, marginTop: 2 },
  modalSheet: { backgroundColor: Colors.light.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", paddingBottom: Platform.OS === "ios" ? 34 : 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.light.border, alignSelf: "center", marginTop: 12, marginBottom: 6 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.light.text, marginHorizontal: 20, marginVertical: 12 },
  requestSummary: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.primary + "0E", marginHorizontal: 20, borderRadius: 12, padding: 12, marginBottom: 12 },
  requestSummaryText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text },

  formGroup: { marginHorizontal: 20, marginBottom: 14 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, marginBottom: 6 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.inputBackground, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.light.border },
  inputIcon: { marginRight: 8 },
  inputInner: { flex: 1, height: 48, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.text },
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

  dailyStatsBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-evenly",
    backgroundColor: Colors.light.card, marginHorizontal: 16, marginBottom: 8,
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8,
    borderWidth: 1, borderColor: Colors.light.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  dailyStatItem: { alignItems: "center", gap: 2, flex: 1 },
  dailyStatValue: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.light.text },
  dailyStatLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary },
  dailyStatDivider: { width: 1, height: 30, backgroundColor: Colors.light.border },

  tabBtnAlert: { backgroundColor: Colors.warning + "18", borderColor: Colors.warning },
  bellDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.warning, marginLeft: 2 },

  mediationBtns: { flexDirection: "row", gap: 10, marginTop: 10 },
  confirmBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 9, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 3 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },
  ignoreBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.danger + "12", borderRadius: 10, paddingVertical: 9, borderWidth: 1, borderColor: Colors.danger + "30" },
  ignoreBtnText: { color: Colors.danger, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  inlineConfirmBox: { marginTop: 10, borderRadius: 10, borderWidth: 1, padding: 12, gap: 10 },
  inlineConfirmText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.text, lineHeight: 19 },
  inlineConfirmBtns: { flexDirection: "row", gap: 8 },
  cancelInlineBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.light.inputBackground, borderWidth: 1, borderColor: Colors.light.border, alignItems: "center", justifyContent: "center" },
  cancelInlineBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary },

  subTabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.light.inputBackground, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  subTabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, backgroundColor: Colors.light.background, borderWidth: 1, borderColor: Colors.light.border },
  subTabBtnActive: { backgroundColor: Colors.accent + "15", borderColor: Colors.accent + "50" },
  subTabBtnActiveB2b: { backgroundColor: "#7C3AED15", borderColor: "#7C3AED50" },
  subTabText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary },
  subTabTextActive: { color: Colors.accent },
  subTabTextActiveB2b: { color: "#7C3AED" },

  b2bToggleBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.light.inputBackground, borderWidth: 1, borderColor: Colors.light.border, marginBottom: 4 },
  b2bToggleBtnOn: { backgroundColor: "#7C3AED18", borderColor: "#7C3AED50" },
  b2bToggleText: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.light.textTertiary },
  b2bToggleTextOn: { color: "#7C3AED" },
});
