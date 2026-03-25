import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, ScrollView, Alert, Modal, FlatList, Linking,
  Animated, Vibration,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { REGIONS } from "@/constants/regions";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const TEAL = "#0D9488";
const TEAL_LIGHT = "#EBF9F4";

const CARE_TYPES_AR = [
  "حقن / تلقيح",
  "تضميد وعناية بالجروح",
  "قياس ضغط الدم والسكر",
  "رعاية ما بعد العملية",
  "مغذيات وريدية (IV)",
  "رعاية مسنين",
  "العلاج الطبيعي في المنزل",
  "عناية بمرضى الفراش",
  "أخرى",
];

const CARE_TYPES_FR = [
  "Injections / Vaccination",
  "Pansements et soins des plaies",
  "Mesure tension artérielle et glycémie",
  "Soins post-opératoires",
  "Perfusion intraveineuse (IV)",
  "Soins aux personnes âgées",
  "Kinésithérapie à domicile",
  "Soins aux patients alités",
  "Autre",
];

type NursingRequest = {
  id: string;
  phone: string;
  region: string;
  careType: string;
  description: string | null;
  status: string;
  nurseName: string | null;
  nursePhone: string | null;
  paymentCode: string | null;
  paymentStatus: string;
  createdAt: string;
};

type NurseSession = {
  id: string;
  name: string;
  phone: string;
  region: string | null;
  specialty: string | null;
  token: string;
  isVerified: boolean;
};

export default function NursingCareScreen() {
  const insets = useSafeAreaInsets();
  const { language, userId } = useApp();
  const isRTL = language === "ar";
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [activeTab, setActiveTab] = useState<"request" | "portal">("request");

  const [phone, setPhone] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [careType, setCareType] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCareTypePicker, setShowCareTypePicker] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);

  const [nurseSession, setNurseSession] = useState<NurseSession | null>(null);
  const [nurseMode, setNurseMode] = useState<"login" | "register" | "dashboard">("login");
  const [nursePhone, setNursePhone] = useState("");
  const [nursePassword, setNursePassword] = useState("");
  const [nurseName, setNurseName] = useState("");
  const [nurseEmail, setNurseEmail] = useState("");
  const [nurseRegion, setNurseRegion] = useState("");
  const [nurseSpecialty, setNurseSpecialty] = useState("");
  const [nurseLoading, setNurseLoading] = useState(false);
  const [nurseRequests, setNurseRequests] = useState<NursingRequest[]>([]);
  const [nurseReqLoading, setNurseReqLoading] = useState(false);
  const [showNurseRegionPicker, setShowNurseRegionPicker] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [newReqCount, setNewReqCount] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPaymentCode, setPendingPaymentCode] = useState("");
  const [pendingRequestId, setPendingRequestId] = useState("");
  const [paymentConfirming, setPaymentConfirming] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  const bellAnim = useRef(new Animated.Value(0)).current;
  const prevReqCountRef = useRef(-1);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const careList = isRTL ? CARE_TYPES_AR : CARE_TYPES_FR;

  const handleSubmitRequest = async () => {
    if (!phone.trim() || !selectedRegion || !careType) {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "يرجى تعبئة جميع الحقول المطلوبة" : "Veuillez remplir tous les champs obligatoires");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`${API_BASE}/nursing/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, phone: phone.trim(), region: selectedRegion, careType, description: description.trim() || null }),
      });
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPendingPaymentCode(data.paymentCode || "");
      setPendingRequestId(data.id || "");
      setPaymentDone(false);
      setShowPaymentModal(true);
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "حدث خطأ، حاول مجدداً" : "Une erreur s'est produite, réessayez");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentConfirm = async () => {
    setPaymentConfirming(true);
    try {
      await fetch(`${API_BASE}/nursing/requests/${pendingRequestId}/pay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPaymentDone(true);
    } catch {
    } finally {
      setPaymentConfirming(false);
    }
  };

  const handleNurseLogin = async () => {
    if (!nursePhone.trim() || !nursePassword.trim()) {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "يرجى إدخال الهاتف وكلمة المرور" : "Téléphone et mot de passe requis");
      return;
    }
    setNurseLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/nursing/nurse/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: nursePhone.trim(), password: nursePassword }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "");
      const session: NurseSession = { id: data.id, name: data.name, phone: data.phone, region: data.region, specialty: data.specialty, token: data.token, isVerified: data.isVerified };
      setNurseSession(session);
      setNurseMode("dashboard");
      await AsyncStorage.setItem("nurse_session", JSON.stringify(session));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadNurseRequests(session);
    } catch (err: any) {
      Alert.alert(isRTL ? "خطأ" : "Erreur", err.message || (isRTL ? "رقم هاتف أو كلمة مرور خاطئة" : "Numéro ou mot de passe incorrect"));
    } finally {
      setNurseLoading(false);
    }
  };

  const handleNurseRegister = async () => {
    if (!nurseName.trim() || !nursePhone.trim() || !nursePassword.trim()) {
      Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "الاسم والهاتف وكلمة المرور إلزامية" : "Nom, téléphone et mot de passe requis");
      return;
    }
    setNurseLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/nursing/nurse/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nurseName.trim(), phone: nursePhone.trim(), password: nursePassword,
          email: nurseEmail.trim() || null, region: nurseRegion || null, specialty: nurseSpecialty.trim() || null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "");
      const session: NurseSession = { id: data.id, name: data.name, phone: data.phone, region: data.region, specialty: data.specialty, token: data.token, isVerified: data.isVerified };
      setNurseSession(session);
      setNurseMode("dashboard");
      await AsyncStorage.setItem("nurse_session", JSON.stringify(session));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadNurseRequests(session);
    } catch (err: any) {
      Alert.alert(isRTL ? "خطأ" : "Erreur", err.message || (isRTL ? "فشل التسجيل" : "Échec de l'inscription"));
    } finally {
      setNurseLoading(false);
    }
  };

  const triggerBell = useCallback(() => {
    bellAnim.setValue(0);
    Animated.sequence([
      Animated.timing(bellAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: 0.5, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: -0.5, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
    Vibration.vibrate([0, 150, 80, 150]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [bellAnim]);

  const loadNurseRequests = useCallback(async (session?: NurseSession, silent?: boolean) => {
    const s = session || nurseSession;
    if (!s) return;
    if (!silent) setNurseReqLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/nursing/requests`, {
        headers: { "x-nurse-id": s.id, "x-nurse-token": s.token },
      });
      if (!resp.ok) throw new Error();
      const data: NursingRequest[] = await resp.json();
      const pendingCount = data.filter(r => r.status === "pending").length;
      if (pendingCount > prevReqCountRef.current && prevReqCountRef.current >= 0) {
        const added = pendingCount - prevReqCountRef.current;
        setNewReqCount(prev => prev + added);
        triggerBell();
      }
      prevReqCountRef.current = pendingCount;
      setNurseRequests(data);
    } catch {
      if (!silent) setNurseRequests([]);
    } finally {
      if (!silent) setNurseReqLoading(false);
    }
  }, [nurseSession, triggerBell]);

  useEffect(() => {
    if (nurseMode === "dashboard" && nurseSession) {
      pollIntervalRef.current = setInterval(() => {
        loadNurseRequests(undefined, true);
      }, 20000);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [nurseMode, nurseSession, loadNurseRequests]);

  const handleRespond = async (reqId: string, reqPhone: string) => {
    if (!nurseSession) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      isRTL ? "الرد على الطلب" : "Répondre à la demande",
      isRTL ? "سيتم تسجيل اسمك ورقم هاتفك على هذا الطلب" : "Votre nom et téléphone seront enregistrés sur cette demande",
      [
        { text: isRTL ? "إلغاء" : "Annuler", style: "cancel" },
        {
          text: isRTL ? "تأكيد" : "Confirmer",
          onPress: async () => {
            try {
              await fetch(`${API_BASE}/nursing/requests/${reqId}/respond`, {
                method: "PATCH",
                headers: { "x-nurse-id": nurseSession.id, "x-nurse-token": nurseSession.token },
              });
              loadNurseRequests();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}
          }
        }
      ]
    );
  };

  const handleNurseLogout = async () => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    await AsyncStorage.removeItem("nurse_session");
    setNurseSession(null);
    setNurseMode("login");
    setNursePhone(""); setNursePassword("");
    setNewReqCount(0);
    prevReqCountRef.current = -1;
  };

  const handleDeleteRequest = (reqId: string) => {
    const doDelete = async () => {
      if (!nurseSession) return;
      setDeletingId(reqId);
      try {
        await fetch(`${API_BASE}/nursing/requests/${reqId}`, {
          method: "DELETE",
          headers: { "x-nurse-id": nurseSession.id, "x-nurse-token": nurseSession.token },
        });
        setNurseRequests(prev => prev.filter(r => r.id !== reqId));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        if (Platform.OS === "web") {
          window.alert(isRTL ? "فشل الحذف" : "Échec de la suppression");
        } else {
          Alert.alert(isRTL ? "خطأ" : "Erreur", isRTL ? "فشل الحذف" : "Échec de la suppression");
        }
      } finally {
        setDeletingId(null);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(isRTL ? "هل تريد حذف هذا الطلب نهائياً؟" : "Voulez-vous supprimer définitivement cette demande?")) {
        doDelete();
      }
    } else {
      Alert.alert(
        isRTL ? "حذف الطلب" : "Supprimer la demande",
        isRTL ? "هل تريد حذف هذا الطلب نهائياً؟" : "Voulez-vous supprimer définitivement cette demande?",
        [
          { text: isRTL ? "إلغاء" : "Annuler", style: "cancel" },
          { text: isRTL ? "حذف" : "Supprimer", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  React.useEffect(() => {
    AsyncStorage.getItem("nurse_session").then((json) => {
      if (json) {
        try {
          const s = JSON.parse(json) as NurseSession;
          setNurseSession(s);
          setNurseMode("dashboard");
          loadNurseRequests(s);
        } catch {}
      }
    });
  }, []);

  const renderNurseRequest = ({ item }: { item: NursingRequest }) => (
    <View style={[styles.reqCard, item.status === "responded" && styles.reqCardDone]}>
      <View style={[styles.reqCardTop, isRTL && styles.rowReverse]}>
        <View style={[styles.reqIcon, { backgroundColor: item.status === "responded" ? Colors.accent + "18" : TEAL + "18" }]}>
          <MaterialCommunityIcons name={item.status === "responded" ? "check-circle" : "needle"} size={20} color={item.status === "responded" ? Colors.accent : TEAL} />
        </View>
        <View style={[{ flex: 1 }, isRTL && { alignItems: "flex-end" }]}>
          <Text style={[styles.reqCareType, isRTL && styles.rtlText]}>{item.careType}</Text>
          <Text style={[styles.reqRegion, isRTL && styles.rtlText]}>{item.region} • {item.phone}</Text>
          <Text style={[styles.reqTime, isRTL && styles.rtlText]}>{new Date(item.createdAt).toLocaleString(isRTL ? "ar-SA" : "fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
          {item.description ? <Text style={[styles.reqDesc, isRTL && styles.rtlText]} numberOfLines={2}>{item.description}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View style={[styles.statusBadge, { backgroundColor: item.status === "responded" ? Colors.accent + "18" : TEAL + "12" }]}>
            <Text style={[styles.statusBadgeText, { color: item.status === "responded" ? Colors.accent : TEAL }]}>
              {item.status === "responded" ? (isRTL ? "تم الرد" : "Traité") : (isRTL ? "جديد" : "Nouveau")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteReqBtn}
            onPress={() => handleDeleteRequest(item.id)}
            disabled={deletingId === item.id}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            {deletingId === item.id
              ? <ActivityIndicator size="small" color={Colors.danger} />
              : <Ionicons name="trash-outline" size={15} color={Colors.danger} />
            }
          </TouchableOpacity>
        </View>
      </View>
      {item.status === "pending" && (
        <View style={[styles.reqActions, isRTL && styles.rowReverse]}>
          <TouchableOpacity style={styles.callReqBtn} onPress={() => Linking.openURL(`tel:${item.phone}`)} activeOpacity={0.8}>
            <Ionicons name="call" size={14} color="#fff" />
            <Text style={styles.callReqBtnText}>{isRTL ? "اتصل بالمريض" : "Appeler le patient"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.respondBtn} onPress={() => handleRespond(item.id, item.phone)} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle" size={14} color={TEAL} />
            <Text style={styles.respondBtnText}>{isRTL ? "تم التواصل" : "Contacté"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={[styles.header, isRTL && styles.rowReverse]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={TEAL} />
        </TouchableOpacity>
        <View style={[styles.headerCenter, isRTL && { alignItems: "flex-end" }]}>
          <Text style={[styles.headerTitle, { color: TEAL }, isRTL && styles.rtlText]}>
            {isRTL ? "التمريض المنزلي" : "Soins infirmiers à domicile"}
          </Text>
          <Text style={[styles.headerSub, isRTL && styles.rtlText]}>
            {isRTL ? "طلب ممرض أو رعاية صحية في المنزل" : "Demandez un infirmier ou soins à domicile"}
          </Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: TEAL + "15" }]}>
          <MaterialCommunityIcons name="needle" size={22} color={TEAL} />
        </View>
      </View>

      <View style={[styles.tabsRow, isRTL && styles.rowReverse]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "request" && styles.tabBtnActive]}
          onPress={() => { setActiveTab("request"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="medical-bag" size={15} color={activeTab === "request" ? "#fff" : TEAL} />
          <Text style={[styles.tabBtnText, activeTab === "request" && styles.tabBtnTextActive]}>
            {isRTL ? "طلب رعاية" : "Demande de soins"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "portal" && styles.tabBtnActive]}
          onPress={() => { setActiveTab("portal"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="account-heart" size={15} color={activeTab === "portal" ? "#fff" : TEAL} />
          <Text style={[styles.tabBtnText, activeTab === "portal" && styles.tabBtnTextActive]}>
            {isRTL ? "بوابة الممرض" : "Portail infirmier"}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "request" ? (
        <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {submitted ? (
            <View style={styles.successBox}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={52} color={TEAL} />
              </View>
              <Text style={[styles.successTitle, isRTL && styles.rtlText]}>
                {isRTL ? "تم إرسال طلبك بنجاح!" : "Votre demande a été envoyée!"}
              </Text>
              <Text style={[styles.successSub, isRTL && styles.rtlText]}>
                {isRTL
                  ? "سيتواصل معك أحد الممرضين في أقرب وقت ممكن على رقم الهاتف المُدخل"
                  : "Un infirmier vous contactera dès que possible au numéro fourni"}
              </Text>
              <TouchableOpacity style={styles.newRequestBtn} onPress={() => { setSubmitted(false); setPhone(""); setSelectedRegion(""); setCareType(""); setDescription(""); }} activeOpacity={0.85}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.newRequestBtnText}>{isRTL ? "طلب جديد" : "Nouvelle demande"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.infoBox}>
                <MaterialCommunityIcons name="information-outline" size={18} color={TEAL} />
                <Text style={[styles.infoText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "اطلب زيارة ممرض محترف في منزلك للحصول على العلاجات والرعاية الصحية"
                    : "Demandez la visite d'un infirmier professionnel à domicile pour soins et traitements"}
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, isRTL && styles.rtlText]}>
                  {isRTL ? "رقم الهاتف *" : "Numéro de téléphone *"}
                </Text>
                <View style={[styles.inputRow, isRTL && styles.rowReverse]}>
                  <Ionicons name="call-outline" size={18} color={Colors.light.textSecondary} />
                  <TextInput
                    style={[styles.input, isRTL && styles.rtlText]}
                    placeholder={isRTL ? "أدخل رقم هاتفك..." : "Votre numéro de téléphone..."}
                    placeholderTextColor={Colors.light.textTertiary}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    textAlign={isRTL ? "right" : "left"}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, isRTL && styles.rtlText]}>
                  {isRTL ? "المنطقة *" : "Région *"}
                </Text>
                <TouchableOpacity style={[styles.selectBox, isRTL && styles.rowReverse]} onPress={() => setShowRegionPicker(true)} activeOpacity={0.85}>
                  <Ionicons name="location-outline" size={18} color={Colors.light.textSecondary} />
                  <Text style={[styles.selectBoxText, !selectedRegion && styles.selectBoxPlaceholder, isRTL && styles.rtlText]}>
                    {selectedRegion ? REGIONS.find(r => r.id === selectedRegion)?.[isRTL ? "ar" : "fr"] ?? selectedRegion : (isRTL ? "اختر منطقتك..." : "Choisir votre région...")}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.light.textTertiary} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, isRTL && styles.rtlText]}>
                  {isRTL ? "نوع الرعاية المطلوبة *" : "Type de soin demandé *"}
                </Text>
                <TouchableOpacity style={[styles.selectBox, isRTL && styles.rowReverse]} onPress={() => setShowCareTypePicker(true)} activeOpacity={0.85}>
                  <MaterialCommunityIcons name="needle" size={18} color={Colors.light.textSecondary} />
                  <Text style={[styles.selectBoxText, !careType && styles.selectBoxPlaceholder, isRTL && styles.rtlText]}>
                    {careType || (isRTL ? "اختر نوع الرعاية..." : "Choisir le type de soin...")}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.light.textTertiary} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, isRTL && styles.rtlText]}>
                  {isRTL ? "وصف إضافي (اختياري)" : "Description supplémentaire (optionnel)"}
                </Text>
                <TextInput
                  style={[styles.textArea, isRTL && styles.rtlText]}
                  placeholder={isRTL ? "أضف تفاصيل إضافية عن حالتك..." : "Ajoutez des détails supplémentaires sur votre état..."}
                  placeholderTextColor={Colors.light.textTertiary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlign={isRTL ? "right" : "left"}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, (!phone.trim() || !selectedRegion || !careType || submitting) && styles.submitBtnDisabled]}
                onPress={handleSubmitRequest}
                disabled={!phone.trim() || !selectedRegion || !careType || submitting}
                activeOpacity={0.85}
              >
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="paper-plane" size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>{isRTL ? "إرسال الطلب" : "Envoyer la demande"}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {nurseMode === "dashboard" && nurseSession ? (
            <View style={{ flex: 1 }}>
              {/* Bell notification bar */}
              <View style={styles.bellBar}>
                <TouchableOpacity
                  style={styles.bellBarBtn}
                  onPress={() => { setNewReqCount(0); loadNurseRequests(); }}
                  activeOpacity={0.85}
                >
                  <Animated.View style={{
                    transform: [{
                      rotate: bellAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-25deg", "0deg", "25deg"] })
                    }]
                  }}>
                    <Ionicons name="notifications" size={32} color={newReqCount > 0 ? "#FF3B30" : TEAL} />
                  </Animated.View>
                  {newReqCount > 0 && (
                    <View style={styles.bellBadge}>
                      <Text style={styles.bellBadgeText}>{newReqCount > 9 ? "9+" : newReqCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bellBarTitle, isRTL && styles.rtlText]}>
                    {newReqCount > 0
                      ? (isRTL ? `${newReqCount} طلب جديد وصل!` : `${newReqCount} nouvelle(s) demande(s)!`)
                      : (isRTL ? "لا توجد طلبات جديدة" : "Pas de nouvelles demandes")}
                  </Text>
                  <Text style={[styles.bellBarSub, isRTL && styles.rtlText]}>
                    {isRTL ? "يتم التحديث تلقائياً كل 20 ثانية" : "Mise à jour automatique toutes les 20s"}
                  </Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={() => { setNewReqCount(0); loadNurseRequests(); }} activeOpacity={0.8}>
                  <Ionicons name="refresh" size={16} color={TEAL} />
                </TouchableOpacity>
              </View>

              <View style={[styles.nurseHeader, isRTL && styles.rowReverse]}>
                <View style={styles.nurseAvatarWrap}>
                  <MaterialCommunityIcons name="account-heart" size={24} color={TEAL} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nurseName, isRTL && styles.rtlText]}>{nurseSession.name}</Text>
                  <Text style={[styles.nurseInfo, isRTL && styles.rtlText]}>
                    {nurseSession.region || (isRTL ? "كل المناطق" : "Toutes les régions")}
                    {nurseSession.isVerified ? (isRTL ? " • ✅ موثوق" : " • ✅ Vérifié") : (isRTL ? " • ⏳ قيد التحقق" : " • ⏳ En attente")}
                  </Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleNurseLogout} activeOpacity={0.8}>
                  <Ionicons name="log-out-outline" size={16} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>

              {nurseReqLoading ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={TEAL} />
                </View>
              ) : (
                <FlatList
                  data={nurseRequests}
                  keyExtractor={item => item.id}
                  renderItem={renderNurseRequest}
                  contentContainerStyle={styles.reqList}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <MaterialCommunityIcons name="inbox-outline" size={52} color={Colors.light.textTertiary} />
                      <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                        {isRTL ? "لا توجد طلبات حالياً" : "Aucune demande pour le moment"}
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.portalIntroBox}>
                <MaterialCommunityIcons name="account-heart" size={36} color={TEAL} />
                <Text style={[styles.portalIntroTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "بوابة الممرضين" : "Portail des infirmiers"}
                </Text>
                <Text style={[styles.portalIntroSub, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "سجّل الدخول أو أنشئ حساباً لاستقبال طلبات التمريض المنزلي"
                    : "Connectez-vous ou créez un compte pour recevoir les demandes de soins à domicile"}
                </Text>
              </View>

              <View style={[styles.authToggle, isRTL && styles.rowReverse]}>
                <TouchableOpacity
                  style={[styles.authToggleBtn, nurseMode === "login" && styles.authToggleBtnActive]}
                  onPress={() => setNurseMode("login")}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.authToggleBtnText, nurseMode === "login" && styles.authToggleBtnTextActive]}>
                    {isRTL ? "تسجيل الدخول" : "Connexion"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.authToggleBtn, nurseMode === "register" && styles.authToggleBtnActive]}
                  onPress={() => setNurseMode("register")}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.authToggleBtnText, nurseMode === "register" && styles.authToggleBtnTextActive]}>
                    {isRTL ? "إنشاء حساب" : "S'inscrire"}
                  </Text>
                </TouchableOpacity>
              </View>

              {nurseMode === "register" && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isRTL && styles.rtlText]}>
                    {isRTL ? "الاسم الكامل *" : "Nom complet *"}
                  </Text>
                  <View style={[styles.inputRow, isRTL && styles.rowReverse]}>
                    <Ionicons name="person-outline" size={18} color={Colors.light.textSecondary} />
                    <TextInput
                      style={[styles.input, isRTL && styles.rtlText]}
                      placeholder={isRTL ? "اسمك الكامل..." : "Votre nom complet..."}
                      placeholderTextColor={Colors.light.textTertiary}
                      value={nurseName}
                      onChangeText={setNurseName}
                      textAlign={isRTL ? "right" : "left"}
                    />
                  </View>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={[styles.label, isRTL && styles.rtlText]}>
                  {isRTL ? "رقم الهاتف *" : "Numéro de téléphone *"}
                </Text>
                <View style={[styles.inputRow, isRTL && styles.rowReverse]}>
                  <Ionicons name="call-outline" size={18} color={Colors.light.textSecondary} />
                  <TextInput
                    style={[styles.input, isRTL && styles.rtlText]}
                    placeholder={isRTL ? "رقم هاتفك..." : "Votre téléphone..."}
                    placeholderTextColor={Colors.light.textTertiary}
                    value={nursePhone}
                    onChangeText={setNursePhone}
                    keyboardType="phone-pad"
                    textAlign={isRTL ? "right" : "left"}
                  />
                </View>
              </View>

              {nurseMode === "register" && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, isRTL && styles.rtlText]}>
                      {isRTL ? "البريد الإلكتروني (اختياري)" : "Email (optionnel)"}
                    </Text>
                    <View style={[styles.inputRow, isRTL && styles.rowReverse]}>
                      <Ionicons name="mail-outline" size={18} color={Colors.light.textSecondary} />
                      <TextInput
                        style={[styles.input, isRTL && styles.rtlText]}
                        placeholder="email@..."
                        placeholderTextColor={Colors.light.textTertiary}
                        value={nurseEmail}
                        onChangeText={setNurseEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        textAlign={isRTL ? "right" : "left"}
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.label, isRTL && styles.rtlText]}>
                      {isRTL ? "المنطقة (اختياري)" : "Région (optionnel)"}
                    </Text>
                    <TouchableOpacity style={[styles.selectBox, isRTL && styles.rowReverse]} onPress={() => setShowNurseRegionPicker(true)} activeOpacity={0.85}>
                      <Ionicons name="location-outline" size={18} color={Colors.light.textSecondary} />
                      <Text style={[styles.selectBoxText, !nurseRegion && styles.selectBoxPlaceholder, isRTL && styles.rtlText]}>
                        {nurseRegion ? REGIONS.find(r => r.id === nurseRegion)?.[isRTL ? "ar" : "fr"] ?? nurseRegion : (isRTL ? "منطقة العمل..." : "Région d'activité...")}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={Colors.light.textTertiary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.label, isRTL && styles.rtlText]}>
                      {isRTL ? "التخصص (اختياري)" : "Spécialité (optionnel)"}
                    </Text>
                    <View style={[styles.inputRow, isRTL && styles.rowReverse]}>
                      <MaterialCommunityIcons name="stethoscope" size={18} color={Colors.light.textSecondary} />
                      <TextInput
                        style={[styles.input, isRTL && styles.rtlText]}
                        placeholder={isRTL ? "تخصصك الطبي..." : "Votre spécialité..."}
                        placeholderTextColor={Colors.light.textTertiary}
                        value={nurseSpecialty}
                        onChangeText={setNurseSpecialty}
                        textAlign={isRTL ? "right" : "left"}
                      />
                    </View>
                  </View>
                </>
              )}

              <View style={styles.formGroup}>
                <Text style={[styles.label, isRTL && styles.rtlText]}>
                  {isRTL ? "كلمة المرور *" : "Mot de passe *"}
                </Text>
                <View style={[styles.inputRow, isRTL && styles.rowReverse]}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.light.textSecondary} />
                  <TextInput
                    style={[styles.input, isRTL && styles.rtlText]}
                    placeholder={isRTL ? "كلمة المرور..." : "Mot de passe..."}
                    placeholderTextColor={Colors.light.textTertiary}
                    value={nursePassword}
                    onChangeText={setNursePassword}
                    secureTextEntry={!showPasswordText}
                    textAlign={isRTL ? "right" : "left"}
                  />
                  <TouchableOpacity onPress={() => setShowPasswordText(!showPasswordText)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={showPasswordText ? "eye-off-outline" : "eye-outline"} size={18} color={Colors.light.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, nurseLoading && { opacity: 0.7 }]}
                onPress={nurseMode === "login" ? handleNurseLogin : handleNurseRegister}
                disabled={nurseLoading}
                activeOpacity={0.85}
              >
                {nurseLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name={nurseMode === "login" ? "log-in-outline" : "person-add-outline"} size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>
                      {nurseMode === "login" ? (isRTL ? "دخول" : "Connexion") : (isRTL ? "إنشاء حساب" : "S'inscrire")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      )}

      <Modal visible={showCareTypePicker} transparent animationType="slide" onRequestClose={() => setShowCareTypePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "نوع الرعاية" : "Type de soin"}
            </Text>
            <ScrollView>
              {careList.map((ct) => (
                <TouchableOpacity
                  key={ct}
                  style={[styles.pickerItem, careType === ct && styles.pickerItemActive, isRTL && { flexDirection: "row-reverse" }]}
                  onPress={() => { setCareType(ct); setShowCareTypePicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="needle" size={16} color={careType === ct ? TEAL : Colors.light.textSecondary} />
                  <Text style={[styles.pickerItemText, careType === ct && styles.pickerItemTextActive, isRTL && styles.rtlText]}>{ct}</Text>
                  {careType === ct && <Ionicons name="checkmark" size={16} color={TEAL} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showRegionPicker} transparent animationType="slide" onRequestClose={() => setShowRegionPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "اختر المنطقة" : "Choisir la région"}
            </Text>
            <ScrollView>
              {REGIONS.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.pickerItem, selectedRegion === r.id && styles.pickerItemActive, isRTL && { flexDirection: "row-reverse" }]}
                  onPress={() => { setSelectedRegion(r.id); setShowRegionPicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="location-outline" size={16} color={selectedRegion === r.id ? TEAL : Colors.light.textSecondary} />
                  <Text style={[styles.pickerItemText, selectedRegion === r.id && styles.pickerItemTextActive, isRTL && styles.rtlText]}>
                    {isRTL ? r.ar : r.fr}
                  </Text>
                  {selectedRegion === r.id && <Ionicons name="checkmark" size={16} color={TEAL} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showNurseRegionPicker} transparent animationType="slide" onRequestClose={() => setShowNurseRegionPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "اختر منطقة العمل" : "Choisir la région d'activité"}
            </Text>
            <ScrollView>
              {REGIONS.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.pickerItem, nurseRegion === r.id && styles.pickerItemActive, isRTL && { flexDirection: "row-reverse" }]}
                  onPress={() => { setNurseRegion(r.id); setShowNurseRegionPicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="location-outline" size={16} color={nurseRegion === r.id ? TEAL : Colors.light.textSecondary} />
                  <Text style={[styles.pickerItemText, nurseRegion === r.id && styles.pickerItemTextActive, isRTL && styles.rtlText]}>
                    {isRTL ? r.ar : r.fr}
                  </Text>
                  {nurseRegion === r.id && <Ionicons name="checkmark" size={16} color={TEAL} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.payModalOverlay}>
          <View style={styles.payModalCard}>
            {paymentDone ? (
              <>
                <View style={styles.paySuccessIcon}>
                  <Ionicons name="checkmark-circle" size={56} color={TEAL} />
                </View>
                <Text style={[styles.payTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "شكراً! تم تأكيد طلبك" : "Merci! Votre demande est confirmée"}
                </Text>
                <Text style={[styles.paySub, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "سيتواصل معك أحد الممرضين المتاحين في أقرب وقت ممكن"
                    : "Un infirmier disponible vous contactera dès que possible"}
                </Text>
                <TouchableOpacity
                  style={styles.payDoneBtn}
                  onPress={() => {
                    setShowPaymentModal(false);
                    setSubmitted(true);
                    setPhone(""); setSelectedRegion(""); setCareType(""); setDescription("");
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.payDoneBtnText}>{isRTL ? "إغلاق" : "Fermer"}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.payIconWrap}>
                  <MaterialCommunityIcons name="bank-transfer" size={38} color={TEAL} />
                </View>
                <Text style={[styles.payTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "أكمل الدفع عبر بنكيلي" : "Finalisez le paiement via Bankily"}
                </Text>
                <Text style={[styles.paySub, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "يرجى دفع 50 أوقية عبر بنكيلي باستخدام الكود التالي كمرجع للتحويل:"
                    : "Veuillez payer 50 MRU via Bankily en utilisant le code suivant comme référence:"}
                </Text>

                <View style={styles.payCodeBox}>
                  <Text style={styles.payCodeLabel}>{isRTL ? "كود المعاملة" : "Code transaction"}</Text>
                  <Text style={styles.payCode}>{pendingPaymentCode}</Text>
                  <Text style={styles.payAmount}>50 MRU</Text>
                </View>

                <View style={styles.paySteps}>
                  <Text style={[styles.payStepText, isRTL && styles.rtlText]}>
                    {isRTL ? "١. افتح تطبيق بنكيلي" : "1. Ouvrez l'appli Bankily"}
                  </Text>
                  <Text style={[styles.payStepText, isRTL && styles.rtlText]}>
                    {isRTL ? `٢. ادفع 50 أوقية بمرجع: ${pendingPaymentCode}` : `2. Payez 50 MRU avec référence: ${pendingPaymentCode}`}
                  </Text>
                  <Text style={[styles.payStepText, isRTL && styles.rtlText]}>
                    {isRTL ? "٣. اضغط 'لقد دفعت' أدناه" : "3. Appuyez sur 'J'ai payé' ci-dessous"}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.payConfirmBtn, paymentConfirming && { opacity: 0.7 }]}
                  onPress={handlePaymentConfirm}
                  disabled={paymentConfirming}
                  activeOpacity={0.85}
                >
                  {paymentConfirming
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                        <Text style={styles.payConfirmBtnText}>{isRTL ? "لقد دفعت" : "J'ai payé"}</Text>
                      </>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.payLaterBtn}
                  onPress={() => {
                    setShowPaymentModal(false);
                    setSubmitted(true);
                    setPhone(""); setSelectedRegion(""); setCareType(""); setDescription("");
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.payLaterText}>{isRTL ? "سأدفع لاحقاً" : "Je paierai plus tard"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  rowReverse: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: TEAL + "12",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "flex-start" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.text },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  headerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },

  tabsRow: {
    flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 12,
    backgroundColor: TEAL + "10", borderWidth: 1.5, borderColor: TEAL + "20",
  },
  tabBtnActive: { backgroundColor: TEAL, borderColor: TEAL },
  tabBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: TEAL },
  tabBtnTextActive: { color: "#fff" },

  formContent: { padding: 16, gap: 16 },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: TEAL + "10", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: TEAL + "25",
  },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.text, flex: 1, lineHeight: 20 },

  formGroup: { gap: 6 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.light.cardBackground,
    borderWidth: 1.5, borderColor: Colors.light.border,
    borderRadius: 14, paddingHorizontal: 14, minHeight: 52,
  },
  input: {
    flex: 1, fontFamily: "Inter_400Regular",
    fontSize: 15, color: Colors.light.text, paddingVertical: 14,
  },
  textArea: {
    backgroundColor: Colors.light.cardBackground,
    borderWidth: 1.5, borderColor: Colors.light.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.light.text,
    minHeight: 90,
  },
  selectBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.light.cardBackground,
    borderWidth: 1.5, borderColor: Colors.light.border,
    borderRadius: 14, paddingHorizontal: 14, minHeight: 52,
  },
  selectBoxText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.light.text },
  selectBoxPlaceholder: { color: Colors.light.textTertiary },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: TEAL, borderRadius: 16, paddingVertical: 16, gap: 8,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: Colors.light.textTertiary, shadowOpacity: 0 },
  submitBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },

  successBox: { alignItems: "center", gap: 16, paddingVertical: 32 },
  successIcon: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: TEAL + "15",
    alignItems: "center", justifyContent: "center",
  },
  successTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.light.text, textAlign: "center" },
  successSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, textAlign: "center", lineHeight: 22 },
  newRequestBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8,
    backgroundColor: TEAL, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12,
  },
  newRequestBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },

  portalIntroBox: { alignItems: "center", gap: 8, paddingVertical: 20 },
  portalIntroTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.text },
  portalIntroSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20 },

  authToggle: {
    flexDirection: "row", borderRadius: 12, overflow: "hidden",
    borderWidth: 1.5, borderColor: TEAL + "30",
  },
  authToggleBtn: { flex: 1, paddingVertical: 11, alignItems: "center" },
  authToggleBtnActive: { backgroundColor: TEAL },
  authToggleBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: TEAL },
  authToggleBtnTextActive: { color: "#fff" },

  nurseHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
    backgroundColor: TEAL + "06",
  },
  nurseAvatarWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: TEAL + "18", alignItems: "center", justifyContent: "center",
  },
  nurseName: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.text },
  nurseInfo: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  refreshBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: TEAL + "12", alignItems: "center", justifyContent: "center",
  },
  logoutBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.light.border, alignItems: "center", justifyContent: "center",
  },

  reqList: { padding: 16, gap: 12 },
  reqCard: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.light.border,
    gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  reqCardDone: { borderColor: Colors.accent + "30", backgroundColor: Colors.accent + "04" },
  reqCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  reqIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  reqCareType: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.light.text },
  reqRegion: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  reqTime: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textTertiary, marginTop: 2 },
  reqDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 4, lineHeight: 18 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  statusBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  reqActions: { flexDirection: "row", gap: 8 },
  callReqBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 9,
  },
  callReqBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  respondBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: TEAL + "12", borderWidth: 1.5, borderColor: TEAL + "30",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  respondBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: TEAL },

  bellBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#FFF8F0",
    borderBottomWidth: 1, borderBottomColor: "#FFE4C0",
  },
  bellBarBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#FFF0E0",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFD080",
    position: "relative",
  },
  bellBadge: {
    position: "absolute", top: -4, right: -4,
    backgroundColor: "#FF3B30", borderRadius: 10,
    minWidth: 20, height: 20,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: "#fff",
  },
  bellBadgeText: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#fff" },
  bellBarTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.light.text },
  bellBarSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, marginTop: 2 },
  deleteReqBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.danger + "12",
    alignItems: "center", justifyContent: "center",
  },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.light.textSecondary, textAlign: "center" },

  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: "75%", paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingHorizontal: 4,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.light.border, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.text, paddingHorizontal: 20, paddingVertical: 12 },
  pickerItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  pickerItemActive: { backgroundColor: TEAL + "08" },
  pickerItemText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.light.text },
  pickerItemTextActive: { fontFamily: "Inter_600SemiBold", color: TEAL },

  payModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", alignItems: "center", padding: 20 },
  payModalCard: {
    backgroundColor: Colors.light.background, borderRadius: 24, padding: 24,
    width: "100%", maxWidth: 400, alignItems: "center", gap: 16,
  },
  paySuccessIcon: { marginBottom: 4 },
  payIconWrap: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: TEAL + "15", alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  payTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.text, textAlign: "center" },
  paySub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, textAlign: "center", lineHeight: 19 },
  payCodeBox: {
    backgroundColor: TEAL + "10", borderRadius: 16, padding: 16, alignItems: "center", gap: 4,
    borderWidth: 1.5, borderColor: TEAL + "30", width: "100%",
  },
  payCodeLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: TEAL, textTransform: "uppercase", letterSpacing: 1 },
  payCode: { fontFamily: "Inter_700Bold", fontSize: 28, color: TEAL, letterSpacing: 6 },
  payAmount: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.textSecondary },
  paySteps: { backgroundColor: Colors.light.card, borderRadius: 12, padding: 14, gap: 6, width: "100%" },
  payStepText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.text, lineHeight: 20 },
  payConfirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, width: "100%",
  },
  payConfirmBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  payLaterBtn: { paddingVertical: 8 },
  payLaterText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  payDoneBtn: {
    backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 4,
  },
  payDoneBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
});
