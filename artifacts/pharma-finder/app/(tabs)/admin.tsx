import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Animated,
  Vibration,
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
  region: string | null; portalPin: string | null; isActive: boolean; b2bEnabled?: boolean;
};
type PortalResponse = {
  id: string; requestId: string; pharmacyId: string | null; pharmacyName: string;
  pharmacyAddress: string; pharmacyPhone: string;
  status: string; adminStatus: string; createdAt: string;
};
type B2bMessage = {
  id: string; pharmacyId: string; pharmacyName: string;
  message: string; type: string; adminStatus: string;
  adminNote: string | null; createdAt: string;
};
type DrugPrice = {
  id: string; name: string; nameAr: string | null;
  price: number; unit: string | null; category: string | null;
  notes: string | null; isActive: boolean; createdAt: string;
};
type Doctor = {
  id: string; doctorName: string; doctorNameAr: string | null;
  specialty: string | null; specialtyAr: string | null;
  clinicName: string; clinicNameAr: string | null;
  address: string; addressAr: string | null;
  phone: string; scheduleText: string | null; scheduleAr: string | null;
  imageData: string | null; imageMimeType: string | null;
  region: string | null; isActive: boolean; createdAt: string;
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


  const [activeTab, setActiveTab] = useState<"pending" | "responded" | "payments" | "pharmacies" | "duty" | "portal" | "prices" | "doctors" | "b2b">("pending");
  const [hasNewRequests, setHasNewRequests] = useState(false);
  const prevPendingCountRef = useRef<number>(-1);
  const vibrationActiveRef = useRef(false);
  const bellShake = useRef(new Animated.Value(0)).current;
  const bellLoop = useRef<Animated.CompositeAnimation | null>(null);
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

  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [drSearch, setDrSearch] = useState("");
  const [drName, setDrName] = useState(""); const [drNameAr, setDrNameAr] = useState("");
  const [drSpecialty, setDrSpecialty] = useState(""); const [drSpecialtyAr, setDrSpecialtyAr] = useState("");
  const [drClinic, setDrClinic] = useState(""); const [drClinicAr, setDrClinicAr] = useState("");
  const [drAddress, setDrAddress] = useState(""); const [drAddressAr, setDrAddressAr] = useState("");
  const [drPhone, setDrPhone] = useState(""); const [drSchedule, setDrSchedule] = useState("");
  const [drScheduleAr, setDrScheduleAr] = useState(""); const [drRegion, setDrRegion] = useState("");
  const [drImageBase64, setDrImageBase64] = useState(""); const [drImageMime, setDrImageMime] = useState("image/jpeg");
  const [pickingDrImage, setPickingDrImage] = useState(false);

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

  const { data: allPortalResponses = [], isLoading: portalLoading, refetch: refetchPortal, isRefetching: portalRefetching } = useQuery<PortalResponse[]>({
    queryKey: ["admin-portal-responses"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/pharmacy-portal/responses`, { headers: { "x-admin-secret": ADMIN_SECRET } }); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 8000, enabled: isAdmin && (activeTab === "portal" || activeTab === "b2b"),
  });
  const portalResponses = allPortalResponses.filter(r => r.adminStatus === "pending_admin");

  const { data: b2bMessages = [], isLoading: b2bLoading, refetch: refetchB2b, isRefetching: b2bRefetching } = useQuery<B2bMessage[]>({
    queryKey: ["admin-b2b"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/pharmacy-portal/b2b`, { headers: { "x-admin-secret": ADMIN_SECRET } }); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 15000, enabled: isAdmin && activeTab === "b2b",
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

  const { data: allDoctors = [], isLoading: doctorLoading, refetch: refetchDoctors, isRefetching: doctorRefetching } = useQuery<Doctor[]>({
    queryKey: ["admin-doctors"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/doctors/admin`, { headers: { "x-admin-secret": ADMIN_SECRET } });
      if (!r.ok) throw new Error(); return r.json();
    },
    enabled: isAdmin && activeTab === "doctors",
  });

  const filteredDoctors = drSearch.trim()
    ? allDoctors.filter(d =>
        d.doctorName.toLowerCase().includes(drSearch.toLowerCase()) ||
        (d.doctorNameAr && d.doctorNameAr.includes(drSearch)) ||
        d.clinicName.toLowerCase().includes(drSearch.toLowerCase()) ||
        (d.specialty && d.specialty.toLowerCase().includes(drSearch.toLowerCase()))
      )
    : allDoctors;

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
  }, [bellShake]);

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

  const saveDoctorMutation = useMutation({
    mutationFn: async (body: object) => {
      const url = editingDoctor ? `${API_BASE}/doctors/${editingDoctor.id}` : `${API_BASE}/doctors`;
      const r = await fetch(url, {
        method: editingDoctor ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-doctors"] });
      setShowDoctorModal(false); setEditingDoctor(null);
      resetDoctorForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل الحفظ" : "Échec de la sauvegarde"),
  });

  const deleteDoctorMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API_BASE}/doctors/${id}`, {
        method: "DELETE", headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-doctors"] }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  });

  const resetDoctorForm = () => {
    setDrName(""); setDrNameAr(""); setDrSpecialty(""); setDrSpecialtyAr("");
    setDrClinic(""); setDrClinicAr(""); setDrAddress(""); setDrAddressAr("");
    setDrPhone(""); setDrSchedule(""); setDrScheduleAr(""); setDrRegion("");
    setDrImageBase64(""); setDrImageMime("image/jpeg");
  };

  const openAddDoctor = () => {
    setEditingDoctor(null); resetDoctorForm(); setShowDoctorModal(true);
  };

  const openEditDoctor = (d: Doctor) => {
    setEditingDoctor(d);
    setDrName(d.doctorName); setDrNameAr(d.doctorNameAr ?? "");
    setDrSpecialty(d.specialty ?? ""); setDrSpecialtyAr(d.specialtyAr ?? "");
    setDrClinic(d.clinicName); setDrClinicAr(d.clinicNameAr ?? "");
    setDrAddress(d.address); setDrAddressAr(d.addressAr ?? "");
    setDrPhone(d.phone); setDrSchedule(d.scheduleText ?? ""); setDrScheduleAr(d.scheduleAr ?? "");
    setDrRegion(d.region ?? ""); setDrImageBase64(""); setDrImageMime(d.imageMimeType ?? "image/jpeg");
    setShowDoctorModal(true);
  };

  const submitDoctor = () => {
    if (!drName.trim() || !drClinic.trim() || !drAddress.trim() || !drPhone.trim()) {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "يرجى ملء الحقول الإلزامية" : "Champs obligatoires manquants"); return;
    }
    const body: any = {
      doctorName: drName.trim(), doctorNameAr: drNameAr.trim() || null,
      specialty: drSpecialty.trim() || null, specialtyAr: drSpecialtyAr.trim() || null,
      clinicName: drClinic.trim(), clinicNameAr: drClinicAr.trim() || null,
      address: drAddress.trim(), addressAr: drAddressAr.trim() || null,
      phone: drPhone.trim(), scheduleText: drSchedule.trim() || null,
      scheduleAr: drScheduleAr.trim() || null, region: drRegion.trim() || null,
    };
    if (drImageBase64) { body.imageData = drImageBase64; body.imageMimeType = drImageMime; }
    saveDoctorMutation.mutate(body);
  };

  const pickDoctorImage = async () => {
    setPickingDrImage(true);
    try {
      const { launchImageLibraryAsync, MediaTypeOptions } = await import("expo-image-picker");
      const result = await launchImageLibraryAsync({ mediaTypes: MediaTypeOptions.Images, quality: 0.7, base64: true });
      if (!result.canceled && result.assets?.[0]?.base64) {
        setDrImageBase64(result.assets[0].base64);
        const uri = result.assets[0].uri ?? "";
        setDrImageMime(uri.endsWith(".png") ? "image/png" : "image/jpeg");
      }
    } catch {} finally { setPickingDrImage(false); }
  };

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

  const confirmResponseMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API_BASE}/pharmacy-portal/responses/${id}/confirm`, {
        method: "POST", headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-portal-responses"] });
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل التأكيد" : "Échec de la confirmation"),
  });

  const ignoreResponseMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API_BASE}/pharmacy-portal/responses/${id}/ignore`, {
        method: "POST", headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-portal-responses"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const usePortalResponseMutation = { isPending: false };

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

  const TABS = [
    { id: "pending", label: isRTL ? `طلبات (${pendingRequests.length})` : `Attente (${pendingRequests.length})` },
    { id: "payments", label: isRTL ? `دفع${pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ""}` : `Pmt${pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ""}` },
    { id: "portal", label: isRTL ? `ردود${portalResponses.length > 0 ? ` (${portalResponses.length})` : ""}` : `Portail${portalResponses.length > 0 ? ` (${portalResponses.length})` : ""}` },
    { id: "pharmacies", label: isRTL ? "صيدليات" : "Pharma" },
    { id: "duty", label: isRTL ? "مداومة" : "Garde" },
    { id: "prices", label: isRTL ? "أسعار" : "Prix" },
    { id: "doctors", label: isRTL ? "أطباء" : "Médecins" },
    { id: "b2b", label: `B2B${b2bMessages.filter(m => m.adminStatus === "pending").length > 0 ? ` (${b2bMessages.filter(m => m.adminStatus === "pending").length})` : ""}` },
  ];

  const isLoading =
    activeTab === "payments" ? payLoading :
    activeTab === "pharmacies" ? pharmaLoading :
    activeTab === "portal" ? portalLoading :
    activeTab === "prices" ? priceLoading :
    activeTab === "doctors" ? doctorLoading :
    activeTab === "b2b" ? b2bLoading :
    reqLoading;

  const isRefetching =
    activeTab === "payments" ? payRefetching :
    activeTab === "pharmacies" ? pharmaRefetching :
    activeTab === "portal" ? portalRefetching :
    activeTab === "prices" ? priceRefetching :
    activeTab === "doctors" ? doctorRefetching :
    activeTab === "b2b" ? b2bRefetching :
    reqRefetching;

  const onRefresh = () => {
    if (activeTab === "payments") refetchPay();
    else if (activeTab === "pharmacies") refetchPharma();
    else if (activeTab === "portal") refetchPortal();
    else if (activeTab === "prices") refetchPrices();
    else if (activeTab === "doctors") refetchDoctors();
    else if (activeTab === "b2b") refetchB2b();
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
            {isRTL ? "طلب:" : "Demande:"} {item.requestId.substring(0, 10)}...
          </Text>
          <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{item.pharmacyPhone} • {formatTime(item.createdAt, language)}</Text>
        </View>
      </View>
      <View style={[styles.mediationBtns, isRTL && styles.rtlRow]}>
        <TouchableOpacity
          style={[styles.confirmBtn, confirmResponseMutation.isPending && { opacity: 0.6 }]}
          onPress={() => Alert.alert(isRTL ? "تأكيد الإرسال؟" : "Confirmer l'envoi?", isRTL ? `إرسال رد ${item.pharmacyName} للمستخدم؟` : `Envoyer la réponse de ${item.pharmacyName}?`, [{ text: isRTL ? "إلغاء" : "Annuler", style: "cancel" }, { text: isRTL ? "تأكيد" : "Confirmer", onPress: () => confirmResponseMutation.mutate(item.id) }])}
          disabled={confirmResponseMutation.isPending}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={15} color="#fff" />
          <Text style={styles.confirmBtnText}>{isRTL ? "تأكيد ✓" : "Confirmer"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ignoreBtn, ignoreResponseMutation.isPending && { opacity: 0.6 }]}
          onPress={() => ignoreResponseMutation.mutate(item.id)}
          disabled={ignoreResponseMutation.isPending}
          activeOpacity={0.8}
        >
          <Ionicons name="close-circle" size={15} color={Colors.danger} />
          <Text style={styles.ignoreBtnText}>{isRTL ? "تجاهل" : "Ignorer"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
          <TouchableOpacity
            style={[styles.b2bToggleBtn, item.b2bEnabled && styles.b2bToggleBtnOn]}
            onPress={() => toggleB2bMutation.mutate({ id: item.id, enabled: !item.b2bEnabled })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
          >
            <Text style={[styles.b2bToggleText, item.b2bEnabled && styles.b2bToggleTextOn]}>B2B</Text>
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

  const renderDoctor = ({ item }: { item: Doctor }) => (
    <View style={styles.pharmCard}>
      <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
        <View style={[styles.requestIcon, { backgroundColor: "#1BB58015" }]}>
          <MaterialCommunityIcons name="doctor" size={22} color="#1BB580" />
        </View>
        <View style={[styles.requestInfo, isRTL && styles.rtlInfo]}>
          <Text style={[styles.drugName, isRTL && styles.rtlText]}>
            {isRTL && item.doctorNameAr ? item.doctorNameAr : item.doctorName}
          </Text>
          {item.specialty && (
            <Text style={[styles.userId, isRTL && styles.rtlText]}>
              {isRTL && item.specialtyAr ? item.specialtyAr : item.specialty}
            </Text>
          )}
          <Text style={[styles.requestTime, isRTL && styles.rtlText]}>
            {isRTL && item.clinicNameAr ? item.clinicNameAr : item.clinicName} • {item.phone}
          </Text>
          <View style={[styles.tagRow, isRTL && styles.rtlRow]}>
            {item.region && <View style={styles.tag}><Text style={styles.tagText}>{item.region}</Text></View>}
            {item.scheduleText && <View style={[styles.tag, { backgroundColor: "#1BB58015" }]}><Ionicons name="calendar" size={10} color="#1BB580" /><Text style={[styles.tagText, { color: "#1BB580" }]}>{isRTL ? "جدول" : "Horaire"}</Text></View>}
            {item.imageData && <View style={[styles.tag, { backgroundColor: Colors.primary + "15" }]}><Ionicons name="image" size={10} color={Colors.primary} /><Text style={[styles.tagText, { color: Colors.primary }]}>{isRTL ? "صورة" : "Image"}</Text></View>}
          </View>
        </View>
        <View style={styles.actionIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => openEditDoctor(item)} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: Colors.danger + "10" }]} onPress={() => confirmDelete(isRTL ? "حذف هذا الطبيب؟" : "Supprimer ce médecin?", () => deleteDoctorMutation.mutate(item.id))} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const isAddTab = activeTab === "pharmacies" || activeTab === "prices" || activeTab === "doctors";
  const currentData: any[] =
    activeTab === "pending" ? pendingRequests :
    activeTab === "responded" ? respondedRequests :
    activeTab === "payments" ? pendingPayments :
    activeTab === "pharmacies" ? pharmacies :
    activeTab === "prices" ? filteredDrugPrices :
    activeTab === "doctors" ? filteredDoctors :
    activeTab === "b2b" ? b2bMessages :
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
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabBtn, isActive && styles.tabBtnActive, isPending && hasNewRequests && !isActive && styles.tabBtnAlert]}
              onPress={() => setActiveTab(tab.id as typeof activeTab)}
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
                  {hasNewRequests && !isActive && (
                    <View style={styles.bellDot} />
                  )}
                </View>
              ) : (
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
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
            activeTab === "doctors" ? renderDoctor :
            activeTab === "b2b" ? renderB2b :
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
              ) : activeTab === "doctors" ? (
                <View>
                  <TouchableOpacity style={[styles.addBtn, { backgroundColor: "#1BB580" }]} onPress={() => { openAddDoctor(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} activeOpacity={0.85}>
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                    <Text style={styles.addBtnText}>{isRTL ? "إضافة طبيب/مصحة" : "Ajouter un médecin"}</Text>
                  </TouchableOpacity>
                  <View style={[styles.searchBarWrap, { marginTop: 8 }]}>
                    <Ionicons name="search-outline" size={16} color={Colors.light.textTertiary} />
                    <TextInput
                      style={[styles.searchBarInput, isRTL && styles.rtlText]}
                      placeholder={isRTL ? "بحث عن طبيب..." : "Rechercher un médecin..."}
                      placeholderTextColor={Colors.light.textTertiary}
                      value={drSearch}
                      onChangeText={setDrSearch}
                    />
                    {drSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setDrSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color={Colors.light.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.countLabel, isRTL && styles.rtlText]}>{isRTL ? `${filteredDoctors.length} طبيب` : `${filteredDoctors.length} médecin(s)`}</Text>
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
                 activeTab === "doctors" ? (isRTL ? "لا يوجد أطباء مسجلون" : "Aucun médecin enregistré") :
                 activeTab === "b2b" ? (isRTL ? "لا توجد رسائل B2B" : "Aucun message B2B") :
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

      {/* Doctor Add/Edit Modal */}
      <Modal visible={showDoctorModal} transparent animationType="slide" onRequestClose={() => setShowDoctorModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {editingDoctor ? (isRTL ? "تعديل الطبيب" : "Modifier le médecin") : (isRTL ? "إضافة طبيب/مصحة" : "Ajouter un médecin")}
              </Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {[
                  { label: isRTL ? "اسم الطبيب (فرنسي) *" : "Nom du médecin (fr) *", value: drName, setter: setDrName, placeholder: "Dr. Mohamed" },
                  { label: isRTL ? "اسم الطبيب (عربي)" : "Nom en arabe", value: drNameAr, setter: setDrNameAr, placeholder: isRTL ? "د. محمد" : "Optionnel" },
                  { label: isRTL ? "التخصص (فرنسي)" : "Spécialité (fr)", value: drSpecialty, setter: setDrSpecialty, placeholder: isRTL ? "مثال: Cardiologie" : "Ex: Cardiologie" },
                  { label: isRTL ? "التخصص (عربي)" : "Spécialité (ar)", value: drSpecialtyAr, setter: setDrSpecialtyAr, placeholder: isRTL ? "مثال: طب القلب" : "Optionnel" },
                  { label: isRTL ? "اسم المصحة/المستشفى (فرنسي) *" : "Clinique/Hôpital (fr) *", value: drClinic, setter: setDrClinic, placeholder: "Clinique Al Shifa" },
                  { label: isRTL ? "اسم المصحة (عربي)" : "Clinique (ar)", value: drClinicAr, setter: setDrClinicAr, placeholder: isRTL ? "مصحة الشفاء" : "Optionnel" },
                  { label: isRTL ? "العنوان (فرنسي) *" : "Adresse (fr) *", value: drAddress, setter: setDrAddress, placeholder: isRTL ? "العنوان الكامل" : "Adresse complète" },
                  { label: isRTL ? "العنوان (عربي)" : "Adresse (ar)", value: drAddressAr, setter: setDrAddressAr, placeholder: isRTL ? "اختياري" : "Optionnel" },
                  { label: isRTL ? "رقم السكرتاريا *" : "Téléphone secrétariat *", value: drPhone, setter: setDrPhone, placeholder: "22 XX XX XX", keyboardType: "phone-pad" as const },
                  { label: isRTL ? "المنطقة" : "Région", value: drRegion, setter: setDrRegion, placeholder: isRTL ? "مثال: نواكشوط" : "Ex: Nouakchott" },
                ].map((f) => (
                  <View key={f.label} style={{ marginBottom: 10 }}>
                    <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{f.label}</Text>
                    <TextInput
                      style={[styles.modalInput, isRTL && styles.rtlInput]}
                      value={f.value} onChangeText={f.setter}
                      placeholder={f.placeholder} placeholderTextColor={Colors.light.textTertiary}
                      keyboardType={f.keyboardType}
                    />
                  </View>
                ))}
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? "جدول الدوام (نص)" : "Horaires (texte)"}</Text>
                <TextInput style={[styles.modalInput, styles.textArea, isRTL && styles.rtlInput]} value={drSchedule} onChangeText={setDrSchedule} placeholder={isRTL ? "مثال: السبت-الأربعاء 9ص-5م" : "Ex: Sam-Mer 9h-17h"} placeholderTextColor={Colors.light.textTertiary} multiline numberOfLines={3} />
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? "جدول الدوام (عربي)" : "Horaires (ar)"}</Text>
                <TextInput style={[styles.modalInput, styles.textArea, isRTL && styles.rtlInput]} value={drScheduleAr} onChangeText={setDrScheduleAr} placeholder={isRTL ? "اختياري" : "Optionnel"} placeholderTextColor={Colors.light.textTertiary} multiline numberOfLines={2} />
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? "صورة جدول الدوام" : "Image des horaires"}</Text>
                <TouchableOpacity
                  style={[styles.imagePicker, drImageBase64 && styles.imagePickerHasImg]}
                  onPress={pickDoctorImage} activeOpacity={0.8} disabled={pickingDrImage}
                >
                  {pickingDrImage ? (
                    <ActivityIndicator color="#1BB580" size="large" />
                  ) : drImageBase64 ? (
                    <View style={{ alignItems: "center", gap: 8 }}>
                      <Image source={{ uri: `data:${drImageMime};base64,${drImageBase64}` }} style={styles.previewImg} resizeMode="cover" />
                      <Text style={{ fontSize: 12, color: Colors.light.textSecondary, fontFamily: "Inter_400Regular" }}>{isRTL ? "اضغط لتغيير الصورة" : "Appuyer pour changer"}</Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: "center", gap: 10 }}>
                      <Ionicons name="camera-outline" size={36} color="#1BB580" />
                      <Text style={[styles.imagePickerText, isRTL && styles.rtlText]}>{isRTL ? "اضغط لاختيار صورة الجدول" : "Choisir une image"}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendButton, { backgroundColor: "#1BB580" }, (!drName.trim() || !drClinic.trim() || !drAddress.trim() || !drPhone.trim()) && styles.sendButtonDisabled]}
                  onPress={submitDoctor}
                  disabled={!drName.trim() || !drClinic.trim() || !drAddress.trim() || !drPhone.trim() || saveDoctorMutation.isPending}
                  activeOpacity={0.85}
                >
                  {saveDoctorMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={styles.sendButtonText}>{isRTL ? "حفظ" : "Enregistrer"}</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDoctorModal(false)} activeOpacity={0.7}>
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

  b2bToggleBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.light.inputBackground, borderWidth: 1, borderColor: Colors.light.border, marginBottom: 4 },
  b2bToggleBtnOn: { backgroundColor: "#7C3AED18", borderColor: "#7C3AED50" },
  b2bToggleText: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.light.textTertiary },
  b2bToggleTextOn: { color: "#7C3AED" },
});
