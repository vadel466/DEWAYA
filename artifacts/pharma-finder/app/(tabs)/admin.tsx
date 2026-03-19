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

const ADMIN_PIN = process.env.EXPO_PUBLIC_ADMIN_PIN ?? "DEWAYA26";

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
type DutyPharmacy = {
  id: string; pharmacyName: string; pharmacyAddress: string;
  pharmacyPhone: string; region: string; date: string;
  scheduleText: string | null; notes: string | null; isActive: boolean;
};
type PortalResponse = {
  id: string; requestId: string; pharmacyName: string;
  pharmacyAddress: string; pharmacyPhone: string;
  status: string; createdAt: string;
};

function formatTime(dateStr: string, lang = "ar") {
  return new Date(dateStr).toLocaleString(lang === "ar" ? "ar-SA" : "fr-FR", {
    hour: "2-digit", minute: "2-digit", day: "numeric", month: "short",
  });
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, userId } = useApp();
  const isRTL = language === "ar";
  const qc = useQueryClient();

  const [authenticated, setAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const [activeTab, setActiveTab] = useState<"pending" | "responded" | "payments" | "pharmacies" | "duty" | "portal">("pending");
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

  const [showDutyModal, setShowDutyModal] = useState(false);
  const [editingDuty, setEditingDuty] = useState<DutyPharmacy | null>(null);
  const [dName, setDName] = useState(""); const [dAddress, setDAddress] = useState("");
  const [dPhone, setDPhone] = useState(""); const [dRegion, setDRegion] = useState("");
  const [dDate, setDDate] = useState(todayStr());
  const [dSchedule, setDSchedule] = useState(""); const [dNotes, setDNotes] = useState("");

  const [selectedPortalResponse, setSelectedPortalResponse] = useState<PortalResponse | null>(null);
  const [showPortalModal, setShowPortalModal] = useState(false);

  const handlePinSubmit = async () => {
    if (pinInput.trim() === ADMIN_PIN) {
      setAuthenticated(true);
      setPinInput("");
      setPinError(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setPinError(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setPinError(false), 3000);
    }
  };

  const { data: requests = [], isLoading: reqLoading, refetch: refetchReq, isRefetching: reqRefetching } = useQuery<DrugRequest[]>({
    queryKey: ["admin-requests"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/requests`); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 5000, enabled: authenticated,
  });

  const { data: pendingPayments = [], isLoading: payLoading, refetch: refetchPay, isRefetching: payRefetching } = useQuery<PendingPayment[]>({
    queryKey: ["admin-pending-payments"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/notifications/admin/pending-payments`); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 5000, enabled: authenticated,
  });

  const { data: pharmacies = [], isLoading: pharmaLoading, refetch: refetchPharma, isRefetching: pharmaRefetching } = useQuery<Pharmacy[]>({
    queryKey: ["admin-pharmacies"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/pharmacies`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: authenticated && activeTab === "pharmacies",
  });

  const { data: dutyList = [], isLoading: dutyLoading, refetch: refetchDuty, isRefetching: dutyRefetching } = useQuery<DutyPharmacy[]>({
    queryKey: ["admin-duty"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/duty-pharmacies/all`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: authenticated && activeTab === "duty",
  });

  const { data: portalResponses = [], isLoading: portalLoading, refetch: refetchPortal, isRefetching: portalRefetching } = useQuery<PortalResponse[]>({
    queryKey: ["admin-portal-responses"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/pharmacy-portal/responses`); if (!r.ok) throw new Error(); return r.json(); },
    refetchInterval: 8000, enabled: authenticated && activeTab === "portal",
  });

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

  const saveDutyMutation = useMutation({
    mutationFn: async () => {
      const body = { pharmacyName: dName, pharmacyAddress: dAddress, pharmacyPhone: dPhone, region: dRegion, date: dDate, scheduleText: dSchedule || undefined, notes: dNotes || undefined };
      if (editingDuty) {
        const r = await fetch(`${API_BASE}/duty-pharmacies/${editingDuty.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(); return r.json();
      } else {
        const r = await fetch(`${API_BASE}/duty-pharmacies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(); return r.json();
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-duty"] }); setShowDutyModal(false); resetDutyForm(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
    onError: () => Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "حدث خطأ" : "Une erreur"),
  });

  const deleteDutyMutation = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`${API_BASE}/duty-pharmacies/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-duty"] }); },
  });

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
  const resetDutyForm = () => { setDName(""); setDAddress(""); setDPhone(""); setDRegion(""); setDDate(todayStr()); setDSchedule(""); setDNotes(""); setEditingDuty(null); };

  const openEditPharmacy = (p: Pharmacy) => {
    setEditingPharmacy(p); setPName(p.name); setPNameAr(p.nameAr ?? ""); setPAddress(p.address); setPAddressAr(p.addressAr ?? ""); setPPhone(p.phone); setPLat(p.lat ? String(p.lat) : ""); setPLon(p.lon ? String(p.lon) : ""); setPRegion(p.region ?? ""); setPPin(p.portalPin ?? ""); setShowPharmacyModal(true);
  };
  const openEditDuty = (d: DutyPharmacy) => {
    setEditingDuty(d); setDName(d.pharmacyName); setDAddress(d.pharmacyAddress); setDPhone(d.pharmacyPhone); setDRegion(d.region); setDDate(d.date); setDSchedule(d.scheduleText ?? ""); setDNotes(d.notes ?? ""); setShowDutyModal(true);
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

  if (!authenticated) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top, alignItems: "center", justifyContent: "center" }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.pinGate}>
          <View style={styles.pinIconWrap}>
            <Ionicons name="shield" size={44} color={Colors.primary} />
          </View>
          <Text style={[styles.pinTitle, isRTL && styles.rtlText]}>
            {isRTL ? "لوحة الإدارة" : "Panneau d'administration"}
          </Text>
          <Text style={[styles.pinSubtitle, isRTL && styles.rtlText]}>
            {isRTL ? "أدخل رمز الدخول للمتابعة" : "Entrez le code d'accès pour continuer"}
          </Text>
          <View style={[styles.pinRow, pinError && styles.pinRowError, isRTL && styles.rtlRow]}>
            <Ionicons name="key-outline" size={20} color={pinError ? Colors.danger : Colors.light.textSecondary} />
            <TextInput
              style={[styles.pinField, isRTL && styles.rtlText]}
              placeholder={isRTL ? "رمز الدخول" : "Code d'accès"}
              placeholderTextColor={Colors.light.textTertiary}
              value={pinInput}
              onChangeText={setPinInput}
              secureTextEntry
              autoCapitalize="none"
              textAlign={isRTL ? "right" : "left"}
              returnKeyType="go"
              onSubmitEditing={handlePinSubmit}
            />
          </View>
          {pinError && (
            <Text style={styles.pinErrorText}>
              {isRTL ? "رمز الدخول غير صحيح" : "Code d'accès incorrect"}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.pinBtn, !pinInput.trim() && styles.pinBtnDisabled]}
            onPress={handlePinSubmit}
            disabled={!pinInput.trim()}
            activeOpacity={0.85}
          >
            <Ionicons name="enter" size={18} color="#fff" />
            <Text style={styles.pinBtnText}>{isRTL ? "دخول" : "Connexion"}</Text>
          </TouchableOpacity>
          <Text style={[styles.pinHint, isRTL && styles.rtlText]}>
            {isRTL ? "الرمز محفوظ بأمان — للمدير فقط" : "Code sécurisé — administrateur uniquement"}
          </Text>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const TABS = [
    { id: "pending", label: isRTL ? `طلبات (${pendingRequests.length})` : `Attente (${pendingRequests.length})` },
    { id: "payments", label: isRTL ? `دفع${pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ""}` : `Pmt${pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ""}` },
    { id: "portal", label: isRTL ? `ردود${portalResponses.length > 0 ? ` (${portalResponses.length})` : ""}` : `Portail${portalResponses.length > 0 ? ` (${portalResponses.length})` : ""}` },
    { id: "pharmacies", label: isRTL ? "صيدليات" : "Pharma" },
    { id: "duty", label: isRTL ? "مداومة" : "Garde" },
  ];

  const isLoading =
    activeTab === "payments" ? payLoading :
    activeTab === "pharmacies" ? pharmaLoading :
    activeTab === "duty" ? dutyLoading :
    activeTab === "portal" ? portalLoading :
    reqLoading;

  const isRefetching =
    activeTab === "payments" ? payRefetching :
    activeTab === "pharmacies" ? pharmaRefetching :
    activeTab === "duty" ? dutyRefetching :
    activeTab === "portal" ? portalRefetching :
    reqRefetching;

  const onRefresh = () => {
    if (activeTab === "payments") refetchPay();
    else if (activeTab === "pharmacies") refetchPharma();
    else if (activeTab === "duty") refetchDuty();
    else if (activeTab === "portal") refetchPortal();
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

  const renderDuty = ({ item }: { item: DutyPharmacy }) => (
    <View style={styles.pharmCard}>
      <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
        <View style={[styles.requestIcon, { backgroundColor: "#DC354514" }]}>
          <MaterialCommunityIcons name="hospital-building" size={22} color="#DC3545" />
        </View>
        <View style={[styles.requestInfo, isRTL && styles.rtlInfo]}>
          <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.pharmacyName}</Text>
          <Text style={[styles.userId, isRTL && styles.rtlText]}>{item.pharmacyPhone}</Text>
          <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{item.date} — {item.region}</Text>
          {item.scheduleText && <Text style={[styles.userId, isRTL && styles.rtlText]}>{item.scheduleText}</Text>}
        </View>
        <View style={styles.actionIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => openEditDuty(item)} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: Colors.danger + "10" }]} onPress={() => confirmDelete(isRTL ? "حذف هذا الإدخال؟" : "Supprimer cet entrée?", () => deleteDutyMutation.mutate(item.id))} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const isAddTab = activeTab === "pharmacies" || activeTab === "duty";
  const currentData: any[] =
    activeTab === "pending" ? pendingRequests :
    activeTab === "responded" ? respondedRequests :
    activeTab === "payments" ? pendingPayments :
    activeTab === "pharmacies" ? pharmacies :
    activeTab === "duty" ? dutyList :
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
          <TouchableOpacity style={styles.lockBtn} onPress={() => setAuthenticated(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /><Text style={styles.loadingText}>{t("loading")}</Text></View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item.id}
          renderItem={
            (activeTab === "pharmacies" ? renderPharmacy :
            activeTab === "duty" ? renderDuty :
            activeTab === "payments" ? renderPayment :
            activeTab === "portal" ? renderPortalResponse :
            renderRequest) as any
          }
          contentContainerStyle={[styles.list, currentData.length === 0 && styles.emptyList, { paddingBottom: Platform.OS === "web" ? 34 : 0 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={!!isRefetching} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            isAddTab ? (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => { resetPharmacyForm(); resetDutyForm(); if (activeTab === "pharmacies") setShowPharmacyModal(true); else setShowDutyModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.addBtnText}>{activeTab === "pharmacies" ? (isRTL ? "إضافة صيدلية" : "Ajouter une pharmacie") : (isRTL ? "إضافة مداومة" : "Ajouter une garde")}</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="inbox-remove-outline" size={64} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                {activeTab === "pharmacies" ? (isRTL ? "لا توجد صيدليات مسجلة" : "Aucune pharmacie enregistrée") :
                 activeTab === "duty" ? (isRTL ? "لا توجد مداومات" : "Aucune garde enregistrée") :
                 activeTab === "portal" ? (isRTL ? "لا توجد ردود من الصيدليات" : "Aucune réponse de pharmacie") :
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

      {/* Duty pharmacy add/edit modal */}
      <Modal visible={showDutyModal} transparent animationType="slide" onRequestClose={() => setShowDutyModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                  {editingDuty ? (isRTL ? "تعديل مداومة" : "Modifier la garde") : (isRTL ? "إضافة صيدلية مداومة" : "Ajouter une pharmacie de garde")}
                </Text>
                {[
                  { label: isRTL ? "اسم الصيدلية" : "Nom de la pharmacie", value: dName, setter: setDName, placeholder: isRTL ? "اسم الصيدلية..." : "Nom..." },
                  { label: isRTL ? "العنوان" : "Adresse", value: dAddress, setter: setDAddress, placeholder: isRTL ? "العنوان..." : "Adresse..." },
                  { label: isRTL ? "رقم الهاتف" : "Téléphone", value: dPhone, setter: setDPhone, placeholder: "XX XXX XXX", keyboardType: "phone-pad" as any },
                  { label: isRTL ? "التاريخ (YYYY-MM-DD)" : "Date (YYYY-MM-DD)", value: dDate, setter: setDDate, placeholder: todayStr() },
                  { label: isRTL ? "أوقات العمل" : "Horaires", value: dSchedule, setter: setDSchedule, placeholder: isRTL ? "8:00 - 22:00" : "8:00 - 22:00" },
                  { label: isRTL ? "ملاحظات" : "Notes", value: dNotes, setter: setDNotes, placeholder: isRTL ? "ملاحظة..." : "Note..." },
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
                      <TouchableOpacity key={r.id} style={[styles.regionChip, dRegion === r.id && styles.regionChipActive]} onPress={() => setDRegion(r.id)} activeOpacity={0.8}>
                        <Text style={[styles.regionChipText, dRegion === r.id && { color: "#fff" }]}>{isRTL ? r.ar : r.fr}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <TouchableOpacity style={[styles.sendButton, (!dName || !dAddress || !dPhone || !dRegion || !dDate) && styles.sendButtonDisabled]} onPress={() => saveDutyMutation.mutate()} disabled={!dName || !dAddress || !dPhone || !dRegion || !dDate || saveDutyMutation.isPending} activeOpacity={0.85}>
                  {saveDutyMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={styles.sendButtonText}>{isRTL ? "حفظ" : "Enregistrer"}</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDutyModal(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>{t("cancel")}</Text>
                </TouchableOpacity>
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
  pinHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center" },

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
});
