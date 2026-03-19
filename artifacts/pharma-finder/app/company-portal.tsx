import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  Linking, RefreshControl, Platform, TextInput, Alert, KeyboardAvoidingView,
  ScrollView, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { DewyaBrand } from "@/components/DewyaBrand";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const COMPANY_COLOR = "#7C3AED";
const COMPANY_LIGHT = "#7C3AED12";

type CompanyInfo = { id: string; name: string; nameAr: string | null; code: string; contact: string | null; subscriptionActive: boolean; isActive: boolean };
type CompanyOrder = { id: string; pharmacyId: string; pharmacyName: string; companyId: string | null; companyName: string | null; drugName: string; quantity: string | null; message: string | null; type: string; status: string; companyResponse: string | null; respondedAt: string | null; createdAt: string };
type InventoryItem = { id: string; companyId: string; companyName: string; drugName: string; price: number | null; unit: string | null; notes: string | null; isAd: boolean; createdAt: string };

type CompanyTab = "orders" | "inventory" | "announcements";

function fmt(d: string, lang: string) {
  return new Date(d).toLocaleString(lang === "ar" ? "ar-SA" : "fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function CompanyPortalScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";

  const [step, setStep] = useState<"code" | "dashboard">("code");
  const [code, setCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [company, setCompany] = useState<CompanyInfo | null>(null);

  const [activeTab, setActiveTab] = useState<CompanyTab>("orders");

  const [orders, setOrders] = useState<CompanyOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [announcements, setAnnouncements] = useState<InventoryItem[]>([]);
  const [invLoading, setInvLoading] = useState(false);

  const [showInvModal, setShowInvModal] = useState(false);
  const [invDrug, setInvDrug] = useState("");
  const [invPrice, setInvPrice] = useState("");
  const [invUnit, setInvUnit] = useState("");
  const [invNotes, setInvNotes] = useState("");
  const [invIsAd, setInvIsAd] = useState(false);
  const [invSaving, setInvSaving] = useState(false);

  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CompanyOrder | null>(null);
  const [responseText, setResponseText] = useState("");

  const handleCodeSubmit = async () => {
    if (!code.trim()) return;
    setAuthLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/company-portal/auth`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        Alert.alert(isRTL ? "رمز غير صحيح" : "Code incorrect", err.error || "");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      const data = await resp.json();
      setCompany(data);
      setStep("dashboard");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(isRTL ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally { setAuthLoading(false); }
  };

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (!company) return;
    if (isRefresh) setOrdersRefreshing(true); else setOrdersLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/company-portal/orders/${company.id}`, {
        headers: { "x-company-code": company.code },
      });
      if (resp.ok) setOrders(await resp.json());
    } catch {} finally { setOrdersLoading(false); setOrdersRefreshing(false); }
  }, [company]);

  const fetchInventory = useCallback(async () => {
    if (!company) return;
    setInvLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/company-portal/inventory/${company.id}`, {
        headers: { "x-company-code": company.code },
      });
      if (resp.ok) setInventory(await resp.json());
    } catch {} finally { setInvLoading(false); }
  }, [company]);

  const fetchAnnouncements = useCallback(async () => {
    if (!company) return;
    setInvLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/company-portal/announcements`);
      if (resp.ok) {
        const all = await resp.json();
        setAnnouncements(all.filter((a: InventoryItem) => a.companyId === company.id));
      }
    } catch {} finally { setInvLoading(false); }
  }, [company]);

  useEffect(() => {
    if (!company) return;
    if (activeTab === "orders") fetchOrders();
    else if (activeTab === "inventory") fetchInventory();
    else if (activeTab === "announcements") fetchAnnouncements();
  }, [activeTab, company]);

  const handleRespond = async () => {
    if (!selectedOrder || !responseText.trim() || !company) return;
    setRespondingId(selectedOrder.id);
    try {
      const resp = await fetch(`${API_BASE}/company-portal/orders/${selectedOrder.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-company-code": company.code },
        body: JSON.stringify({ response: responseText.trim(), companyId: company.id }),
      });
      if (resp.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowRespondModal(false); setResponseText(""); setSelectedOrder(null);
        fetchOrders();
      }
    } catch {} finally { setRespondingId(null); }
  };

  const handleAddInventory = async () => {
    if (!company || !invDrug.trim()) return;
    setInvSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/company-portal/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-company-code": company.code },
        body: JSON.stringify({
          companyId: company.id, companyName: company.nameAr || company.name,
          drugName: invDrug.trim(), price: invPrice.trim() || null, unit: invUnit.trim() || null,
          notes: invNotes.trim() || null, isAd: invIsAd,
        }),
      });
      if (resp.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setInvDrug(""); setInvPrice(""); setInvUnit(""); setInvNotes(""); setInvIsAd(false);
        setShowInvModal(false);
        if (activeTab === "inventory") fetchInventory();
        else if (activeTab === "announcements") fetchAnnouncements();
      }
    } catch {} finally { setInvSaving(false); }
  };

  const handleRemoveInventory = async (id: string) => {
    if (!company) return;
    try {
      await fetch(`${API_BASE}/company-portal/inventory/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-company-code": company.code },
        body: JSON.stringify({ companyId: company.id }),
      });
      setInventory(prev => prev.filter(i => i.id !== id));
      setAnnouncements(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  const doLogout = () => {
    setCompany(null); setCode(""); setStep("code");
    setOrders([]); setInventory([]); setAnnouncements([]); setActiveTab("orders");
  };

  const pendingOrders = orders.filter(o => o.status === "pending");
  const respondedOrders = orders.filter(o => o.status === "responded");

  const TABS: { id: CompanyTab; label: string; icon: string }[] = [
    { id: "orders", label: isRTL ? `الطلبات${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ""}` : `Commandes${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ""}`, icon: "package-variant" },
    { id: "inventory", label: isRTL ? "مخزوني" : "Mon Stock", icon: "pill" },
    { id: "announcements", label: isRTL ? "إعلاناتي" : "Mes Annonces", icon: "bullhorn" },
  ];

  if (step === "code") {
    return (
      <KeyboardAvoidingView style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, isRTL && styles.rtlRow]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isRTL ? "بوابة الشركاء" : "Portail Partenaires"}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
          <View style={[styles.loginIconWrap, { backgroundColor: COMPANY_LIGHT }]}>
            <MaterialCommunityIcons name="domain" size={52} color={COMPANY_COLOR} />
          </View>
          <DewyaBrand isRTL={isRTL} size="md" variant="badge" />
          <Text style={[styles.loginTitle, isRTL && styles.rtlText]}>{isRTL ? "دخول شركات الأدوية" : "Accès Sociétés Pharmaceutiques"}</Text>
          <Text style={[styles.loginSub, isRTL && styles.rtlText]}>
            {isRTL ? "أدخل رمز الشركة للوصول إلى لوحة التحكم" : "Entrez le code société pour accéder au tableau de bord"}
          </Text>

          <View style={[styles.codeHintBox, { backgroundColor: COMPANY_LIGHT, borderColor: COMPANY_COLOR + "30" }]}>
            <Ionicons name="information-circle" size={18} color={COMPANY_COLOR} />
            <Text style={[styles.codeHintText, isRTL && styles.rtlText, { color: COMPANY_COLOR }]}>
              {isRTL ? "رمز الدخول خاص بشركتكم — تواصلوا مع إدارة DEWAYA للحصول عليه" : "Le code est propre à votre société — contactez l'administration DEWAYA"}
            </Text>
          </View>

          <View style={[styles.pinInputRow, isRTL && styles.rtlRow]}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={Colors.light.textSecondary} style={styles.pinIcon} />
            <TextInput
              style={[styles.pinInput, isRTL && styles.rtlText]}
              placeholder={isRTL ? "رمز الشركة" : "Code société"}
              placeholderTextColor={Colors.light.textTertiary}
              value={code} onChangeText={setCode}
              autoCapitalize="characters" keyboardType="default"
              textAlign={isRTL ? "right" : "left"}
              returnKeyType="go" onSubmitEditing={handleCodeSubmit}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: COMPANY_COLOR }, (!code.trim() || authLoading) && styles.loginBtnDisabled]}
            onPress={handleCodeSubmit} disabled={!code.trim() || authLoading} activeOpacity={0.85}
          >
            {authLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Ionicons name="enter" size={18} color="#fff" /><Text style={styles.loginBtnText}>{isRTL ? "دخول" : "Connexion"}</Text></>
            }
          </TouchableOpacity>
          <Text style={[styles.loginHint, isRTL && styles.rtlText]}>
            {isRTL ? "منصة حصرية لشركات الأدوية الشريكة مع DEWAYA" : "Plateforme exclusive pour les sociétés pharmaceutiques partenaires de DEWAYA"}
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
          <Text style={styles.headerTitle}>{isRTL && company!.nameAr ? company!.nameAr : company!.name}</Text>
          <Text style={[styles.headerSub, { color: COMPANY_COLOR }]}>{isRTL ? "بوابة الشركاء" : "Portail Partenaires"}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={doLogout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="log-out-outline" size={22} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      {!company!.subscriptionActive && (
        <View style={styles.suspendedBanner}>
          <Ionicons name="warning" size={16} color={Colors.warning} />
          <Text style={[styles.suspendedBannerText, isRTL && styles.rtlText]}>
            {isRTL ? "اشتراككم غير فعّال — تواصلوا مع إدارة DEWAYA" : "Votre abonnement est inactif — contactez l'administration DEWAYA"}
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive, activeTab === tab.id && { borderColor: COMPANY_COLOR + "50" }]}
            onPress={() => { setActiveTab(tab.id); Haptics.selectionAsync(); }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name={tab.icon as any} size={16} color={activeTab === tab.id ? COMPANY_COLOR : Colors.light.textTertiary} />
            <Text style={[styles.tabBtnText, activeTab === tab.id && { ...styles.tabBtnTextActive, color: COMPANY_COLOR }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === "orders" && (
        ordersLoading ? <View style={styles.centered}><ActivityIndicator size="large" color={COMPANY_COLOR} /></View> : (
          <FlatList
            data={orders}
            keyExtractor={i => i.id}
            contentContainerStyle={[styles.list, orders.length === 0 && styles.emptyList, { paddingBottom: insets.bottom + 20 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={ordersRefreshing} onRefresh={() => fetchOrders(true)} tintColor={COMPANY_COLOR} />}
            ListHeaderComponent={
              <View style={{ gap: 8, marginBottom: 4 }}>
                <View style={[styles.b2bExplainBanner, isRTL && { alignItems: "flex-end" }]}>
                  <View style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, isRTL && { flexDirection: "row-reverse" }]}>
                    <MaterialCommunityIcons name="swap-horizontal" size={15} color={COMPANY_COLOR} />
                    <Text style={[styles.b2bTitle, isRTL && { textAlign: "right" }]}>{isRTL ? "طلبيات B2B المباشرة" : "Commandes B2B directes"}</Text>
                  </View>
                  <Text style={[styles.b2bSub, isRTL && { textAlign: "right" }]}>
                    {isRTL
                      ? "الصيدليات المشتركة في DEWAYA ترسل طلباتها مباشرة إليكم. ردوا على كل طلب بالتوفر والسعر."
                      : "Les pharmacies DEWAYA vous envoient leurs commandes directement. Répondez avec disponibilité et prix."}
                  </Text>
                </View>
                {pendingOrders.length > 0 && (
                  <View style={[styles.alertBanner, { backgroundColor: COMPANY_LIGHT, borderColor: COMPANY_COLOR + "30" }]}>
                    <MaterialCommunityIcons name="package-variant" size={16} color={COMPANY_COLOR} />
                    <Text style={[styles.alertBannerText, { color: COMPANY_COLOR }]}>
                      {isRTL ? `${pendingOrders.length} طلب جديد في انتظار ردكم` : `${pendingOrders.length} commande(s) en attente de votre réponse`}
                    </Text>
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) => {
              const isPending = item.status === "pending";
              return (
                <View style={[styles.orderCard, !isPending && styles.orderCardDone]}>
                  <View style={[styles.orderCardHeader, isRTL && styles.rtlRow]}>
                    <View style={[styles.orderIcon, { backgroundColor: isPending ? COMPANY_LIGHT : Colors.light.inputBackground }]}>
                      <MaterialCommunityIcons name="package-variant" size={20} color={isPending ? COMPANY_COLOR : Colors.light.textTertiary} />
                    </View>
                    <View style={[styles.orderInfo, isRTL && { alignItems: "flex-end" }]}>
                      <Text style={[styles.orderDrug, isRTL && styles.rtlText]}>{item.drugName}</Text>
                      <Text style={[styles.orderPharmacy, isRTL && styles.rtlText]}>{item.pharmacyName}</Text>
                      {item.quantity && <Text style={[styles.orderQuantity, isRTL && styles.rtlText]}>{isRTL ? `الكمية: ${item.quantity}` : `Qté: ${item.quantity}`}</Text>}
                    </View>
                    <View style={[styles.orderTypeBadge, { backgroundColor: item.type === "order" ? "#0A7EA415" : item.type === "inquiry" ? "#F59E0B15" : "#1BB58015" }]}>
                      <Text style={[styles.orderTypeBadgeText, { color: item.type === "order" ? Colors.primary : item.type === "inquiry" ? Colors.warning : Colors.accent }]}>
                        {item.type === "order" ? (isRTL ? "طلب" : "Commande") : item.type === "inquiry" ? (isRTL ? "استفسار" : "Demande") : (isRTL ? "عرض" : "Offre")}
                      </Text>
                    </View>
                  </View>
                  {item.message && (
                    <View style={[styles.orderMsg, isRTL && { alignItems: "flex-end" }]}>
                      <Text style={[styles.orderMsgText, isRTL && styles.rtlText]}>{item.message}</Text>
                    </View>
                  )}
                  <View style={[styles.orderFooter, isRTL && styles.rtlRow]}>
                    <Text style={styles.orderTime}>{fmt(item.createdAt, language)}</Text>
                    {isPending ? (
                      <TouchableOpacity
                        style={styles.respondBtn}
                        onPress={() => { setSelectedOrder(item); setResponseText(""); setShowRespondModal(true); }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="send" size={14} color="#fff" />
                        <Text style={styles.respondBtnText}>{isRTL ? "رد" : "Répondre"}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.respondedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
                        <Text style={styles.respondedBadgeText}>{isRTL ? "تم الرد" : "Répondu"}</Text>
                      </View>
                    )}
                  </View>
                  {item.companyResponse && (
                    <View style={[styles.responseBox, isRTL && { alignItems: "flex-end" }]}>
                      <Text style={[styles.responseLabel, isRTL && styles.rtlText]}>{isRTL ? "ردكم:" : "Votre réponse:"}</Text>
                      <Text style={[styles.responseText, isRTL && styles.rtlText]}>{item.companyResponse}</Text>
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons name="package-variant-closed" size={48} color={Colors.light.textTertiary} />
                <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{isRTL ? "لا توجد طلبات حتى الآن" : "Aucune commande pour l'instant"}</Text>
                <Text style={[styles.emptySub, isRTL && styles.rtlText]}>{isRTL ? "ستظهر هنا طلبات الصيدليات" : "Les commandes des pharmacies apparaîtront ici"}</Text>
              </View>
            }
          />
        )
      )}

      {(activeTab === "inventory" || activeTab === "announcements") && (
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: COMPANY_COLOR }]}
            onPress={() => { setInvIsAd(activeTab === "announcements"); setShowInvModal(true); }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>
              {activeTab === "inventory" ? (isRTL ? "إضافة دواء للمخزون" : "Ajouter au stock") : (isRTL ? "نشر إعلان" : "Publier une annonce")}
            </Text>
          </TouchableOpacity>

          {invLoading ? <View style={styles.centered}><ActivityIndicator size="large" color={COMPANY_COLOR} /></View> : (
            <FlatList
              data={activeTab === "inventory" ? inventory.filter(i => !i.isAd) : announcements}
              keyExtractor={i => i.id}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.invCard}>
                  <View style={[styles.invCardHeader, isRTL && styles.rtlRow]}>
                    <View style={[styles.invIcon, { backgroundColor: item.isAd ? "#F59E0B15" : COMPANY_LIGHT }]}>
                      <MaterialCommunityIcons name={item.isAd ? "bullhorn" : "pill"} size={20} color={item.isAd ? Colors.warning : COMPANY_COLOR} />
                    </View>
                    <View style={[styles.invInfo, isRTL && { alignItems: "flex-end" }]}>
                      <Text style={[styles.invDrug, isRTL && styles.rtlText]}>{item.drugName}</Text>
                      {item.price != null && <Text style={[styles.invPrice, isRTL && styles.rtlText]}>{item.price} MRU {item.unit ? `/ ${item.unit}` : ""}</Text>}
                      {item.notes && <Text style={[styles.invNotes, isRTL && styles.rtlText]}>{item.notes}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveInventory(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.invTime}>{fmt(item.createdAt, language)}</Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <MaterialCommunityIcons name={activeTab === "inventory" ? "pill" : "bullhorn-outline"} size={48} color={Colors.light.textTertiary} />
                  <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                    {activeTab === "inventory" ? (isRTL ? "المخزون فارغ" : "Stock vide") : (isRTL ? "لا توجد إعلانات" : "Aucune annonce")}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      )}

      <Modal visible={showRespondModal} transparent animationType="slide" onRequestClose={() => setShowRespondModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {isRTL ? "الرد على الطلب" : "Répondre à la commande"}
              </Text>
              {selectedOrder && (
                <View style={styles.orderSummary}>
                  <MaterialCommunityIcons name="pill" size={18} color={COMPANY_COLOR} />
                  <View>
                    <Text style={[styles.orderSummaryDrug, isRTL && styles.rtlText]}>{selectedOrder.drugName}</Text>
                    <Text style={[styles.orderSummaryPharmacy, isRTL && styles.rtlText]}>{selectedOrder.pharmacyName}</Text>
                  </View>
                </View>
              )}
              <TextInput
                style={[styles.responseInput, isRTL && styles.rtlText]}
                placeholder={isRTL ? "اكتب ردك هنا..." : "Écrivez votre réponse ici..."}
                placeholderTextColor={Colors.light.textTertiary}
                value={responseText} onChangeText={setResponseText}
                multiline numberOfLines={3}
                textAlign={isRTL ? "right" : "left"}
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.sendBtn, { backgroundColor: COMPANY_COLOR }, (!responseText.trim() || !!respondingId) && { opacity: 0.6 }]}
                  onPress={handleRespond} disabled={!responseText.trim() || !!respondingId} activeOpacity={0.85}>
                  {respondingId ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="send" size={16} color="#fff" /><Text style={styles.sendBtnText}>{isRTL ? "إرسال الرد" : "Envoyer"}</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRespondModal(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>{isRTL ? "إلغاء" : "Annuler"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showInvModal} transparent animationType="slide" onRequestClose={() => setShowInvModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {invIsAd ? (isRTL ? "نشر إعلان دواء" : "Publier une annonce") : (isRTL ? "إضافة دواء للمخزون" : "Ajouter au stock")}
              </Text>
              <View style={styles.formGroup}>
                <Text style={[styles.label, isRTL && styles.rtlText]}>{isRTL ? "اسم الدواء *" : "Nom du médicament *"}</Text>
                <TextInput style={[styles.input, isRTL && styles.rtlText]} value={invDrug} onChangeText={setInvDrug}
                  placeholder={isRTL ? "اسم الدواء" : "Nom"} placeholderTextColor={Colors.light.textTertiary} textAlign={isRTL ? "right" : "left"} />
              </View>
              <View style={[styles.formRow]}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.label, isRTL && styles.rtlText]}>{isRTL ? "السعر (MRU)" : "Prix (MRU)"}</Text>
                  <TextInput style={[styles.input, isRTL && styles.rtlText]} value={invPrice} onChangeText={setInvPrice}
                    placeholder="0.00" placeholderTextColor={Colors.light.textTertiary} keyboardType="numeric" textAlign={isRTL ? "right" : "left"} />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.label, isRTL && styles.rtlText]}>{isRTL ? "الوحدة" : "Unité"}</Text>
                  <TextInput style={[styles.input, isRTL && styles.rtlText]} value={invUnit} onChangeText={setInvUnit}
                    placeholder={isRTL ? "علبة" : "boîte"} placeholderTextColor={Colors.light.textTertiary} textAlign={isRTL ? "right" : "left"} />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.label, isRTL && styles.rtlText]}>{isRTL ? "ملاحظات" : "Notes"}</Text>
                <TextInput style={[styles.input, styles.inputMulti, isRTL && styles.rtlText]} value={invNotes} onChangeText={setInvNotes}
                  placeholder={isRTL ? "ملاحظات إضافية..." : "Notes supplémentaires..."} placeholderTextColor={Colors.light.textTertiary}
                  multiline numberOfLines={2} textAlign={isRTL ? "right" : "left"} />
              </View>
              <TouchableOpacity style={styles.typeToggle} onPress={() => setInvIsAd(!invIsAd)} activeOpacity={0.8}>
                <View style={[styles.typeToggleCheck, invIsAd && { backgroundColor: Colors.warning, borderColor: Colors.warning }]}>
                  {invIsAd && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={[styles.typeToggleText, isRTL && styles.rtlText]}>
                  {isRTL ? "نشر كإعلان للصيدليات" : "Publier comme annonce aux pharmacies"}
                </Text>
              </TouchableOpacity>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.sendBtn, { backgroundColor: COMPANY_COLOR }, (!invDrug.trim() || invSaving) && { opacity: 0.6 }]}
                  onPress={handleAddInventory} disabled={!invDrug.trim() || invSaving} activeOpacity={0.85}>
                  {invSaving ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="add" size={16} color="#fff" /><Text style={styles.sendBtnText}>{isRTL ? "حفظ" : "Enregistrer"}</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInvModal(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>{isRTL ? "إلغاء" : "Annuler"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.light.border, backgroundColor: Colors.light.background },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.light.text, flex: 1, textAlign: "center" },
  headerTitleWrap: { flex: 1, alignItems: "center" },
  headerSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  loginContainer: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, alignItems: "center" },
  loginIconWrap: { width: 96, height: 96, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  loginTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.light.text, textAlign: "center", marginBottom: 8 },
  loginSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 20 },
  codeHintBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginBottom: 20, alignSelf: "stretch" },
  codeHintText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  pinInputRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.inputBackground, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16, height: 52, borderWidth: 1, borderColor: Colors.light.border, alignSelf: "stretch" },
  pinIcon: { marginRight: 10 },
  pinInput: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.light.text, letterSpacing: 2 },
  loginBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14, alignSelf: "stretch", marginBottom: 12 },
  loginBtnDisabled: { opacity: 0.5 },
  loginBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  loginHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center", marginTop: 4, paddingHorizontal: 20 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.light.inputBackground, borderRadius: 12, paddingHorizontal: 14, marginHorizontal: 16, marginTop: 12, marginBottom: 4, height: 44, borderWidth: 1, borderColor: Colors.light.border },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text },
  pickCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.light.border },
  pickIcon: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pickInfo: { flex: 1 },
  pickName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text, marginBottom: 2 },
  pickSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  suspendedBadge: { backgroundColor: Colors.warning + "15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4, alignSelf: "flex-start" },
  suspendedBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.warning },
  suspendedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.warning + "12", padding: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.warning + "30" },
  suspendedBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.warning },
  tabBar: { maxHeight: 52, backgroundColor: Colors.light.background },
  tabBarContent: { paddingHorizontal: 16, gap: 8, alignItems: "center", paddingVertical: 8 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.light.inputBackground, borderWidth: 1, borderColor: Colors.light.border },
  tabBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textTertiary },
  tabBtnTextActive: { fontFamily: "Inter_600SemiBold" },
  list: { padding: 16, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginBottom: 4 },
  alertBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  orderCard: { backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.light.border },
  orderCardDone: { opacity: 0.75 },
  orderCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  orderIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  orderInfo: { flex: 1 },
  orderDrug: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text, marginBottom: 2 },
  orderPharmacy: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary, marginBottom: 2 },
  orderQuantity: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary },
  orderTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  orderTypeBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  orderMsg: { backgroundColor: Colors.light.inputBackground, borderRadius: 8, padding: 10, marginBottom: 8 },
  orderMsgText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  orderFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary },
  respondBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COMPANY_COLOR, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  respondBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },
  respondedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  respondedBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.accent },
  responseBox: { backgroundColor: Colors.accent + "10", borderRadius: 8, padding: 10, marginTop: 8 },
  responseLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.accent, marginBottom: 2 },
  responseText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.text },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginHorizontal: 16, marginVertical: 10, borderRadius: 12, paddingVertical: 12 },
  addBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  invCard: { backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.light.border },
  invCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  invIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  invInfo: { flex: 1 },
  invDrug: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text, marginBottom: 2 },
  invPrice: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: COMPANY_COLOR },
  invNotes: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  invTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, marginTop: 4 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary, textAlign: "center" },
  logoutBtn: { padding: 4 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: Colors.light.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.light.border, alignSelf: "center", marginTop: 12, marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text, textAlign: "center", marginBottom: 16, paddingHorizontal: 20 },
  orderSummary: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COMPANY_LIGHT, padding: 12, borderRadius: 12, marginHorizontal: 20, marginBottom: 16 },
  orderSummaryDrug: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.light.text },
  orderSummaryPharmacy: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  responseInput: { marginHorizontal: 20, marginBottom: 16, backgroundColor: Colors.light.inputBackground, borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text, borderWidth: 1, borderColor: Colors.light.border, minHeight: 80, textAlignVertical: "top" },
  formGroup: { paddingHorizontal: 20, marginBottom: 12 },
  formRow: { flexDirection: "row", gap: 8 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.light.inputBackground, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text, borderWidth: 1, borderColor: Colors.light.border },
  inputMulti: { minHeight: 60, textAlignVertical: "top" },
  typeToggle: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 16 },
  typeToggleCheck: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: Colors.light.border, alignItems: "center", justifyContent: "center" },
  typeToggleText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.text },
  modalBtns: { paddingHorizontal: 20, gap: 10 },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, paddingVertical: 14 },
  sendBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.textTertiary },

  b2bExplainBanner: { backgroundColor: COMPANY_COLOR + "0C", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COMPANY_COLOR + "25", gap: 5 },
  b2bTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: COMPANY_COLOR },
  b2bSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, lineHeight: 17 },
});
