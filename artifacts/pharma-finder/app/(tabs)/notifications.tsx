import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DewyaBrand, DewyaFooter } from "@/components/DewyaBrand";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";


type Notification = {
  id: string;
  userId: string;
  requestId: string;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  isLocked: boolean;
  isRead: boolean;
  paymentPending: boolean;
  paymentRef: string | null;
  createdAt: string;
};

function formatTime(dateStr: string, lang: string) {
  const date = new Date(dateStr);
  const locale = lang === "ar" ? "ar-SA" : "fr-FR";
  return date.toLocaleString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { t, userId, language, lockedCount } = useApp();
  const isRTL = language === "ar";
  const qc = useQueryClient();

  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState(false);
  const prevNotificationsRef = useRef<Notification[]>([]);

  const bellAnim = useRef(new Animated.Value(0)).current;
  const bellScale = useRef(new Animated.Value(1)).current;

  const ringBell = useCallback(() => {
    Animated.sequence([
      Animated.spring(bellScale, { toValue: 1.3, useNativeDriver: true, speed: 20 }),
      Animated.timing(bellAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.spring(bellScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [bellAnim, bellScale]);

  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery<Notification[]>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const resp = await fetch(`${API_BASE}/notifications/${userId}`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    enabled: !!userId,
    refetchInterval: 5000,
  });

  const { data: paymentNumberData } = useQuery<{ number: string | null }>({
    queryKey: ["payment-number"],
    queryFn: async () => {
      const resp = await fetch(`${API_BASE}/settings/payment-number`);
      if (!resp.ok) return { number: null };
      return resp.json();
    },
    staleTime: 60_000,
  });
  const paymentNumber = paymentNumberData?.number ?? null;

  useEffect(() => {
    const prev = prevNotificationsRef.current;
    const isFirst = prev.length === 0 && notifications.length > 0;
    for (const notif of notifications) {
      const old = prev.find((p) => p.id === notif.id);
      if (!old && !isFirst) {
        ringBell();
      }
      if (old && old.isLocked && !notif.isLocked) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        ringBell();
        setSelectedNotif(notif);
        setPaymentModal(false);
        setDetailModal(true);
      }
      if (selectedNotif?.id === notif.id && old?.paymentPending !== notif.paymentPending) {
        setSelectedNotif(notif);
      }
    }
    prevNotificationsRef.current = notifications;
  }, [notifications]);

  const requestUnlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch(`${API_BASE}/notifications/${id}/request-unlock`, { method: "POST" });
      if (!resp.ok) throw new Error("Failed");
      return resp.json() as Promise<Notification>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
      setSelectedNotif(data);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
  });

  const handleNotifPress = useCallback((notif: Notification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedNotif(notif);
    if (notif.isLocked) {
      setPaymentModal(true);
    } else {
      setDetailModal(true);
    }
  }, []);

  const handleCopy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedId(key);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handleRequestUnlock = () => {
    if (selectedNotif) {
      requestUnlockMutation.mutate(selectedNotif.id);
    }
  };

  const renderNotif = ({ item }: { item: Notification }) => {
    const isPending = item.isLocked && item.paymentPending;
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.isRead && styles.unreadCard, isPending && styles.pendingCard]}
        onPress={() => handleNotifPress(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.notifRow, isRTL && styles.rtlRow]}>
          <View style={[styles.notifIcon, item.isLocked ? (isPending ? styles.pendingIcon : styles.lockedIcon) : styles.unlockedIcon]}>
            <Ionicons
              name={item.isLocked ? (isPending ? "time" : "lock-closed") : "checkmark-circle"}
              size={22}
              color={item.isLocked ? (isPending ? Colors.primary : Colors.warning) : Colors.accent}
            />
          </View>
          <View style={[styles.notifContent, isRTL && styles.rtlContent]}>
            <View style={[styles.notifHeader, isRTL && styles.rtlRow]}>
              <Text style={[styles.notifTitle, isRTL && styles.rtlText]}>
                {item.isLocked ? t("newNotification") : item.pharmacyName}
              </Text>
              {!item.isRead && <View style={styles.unreadDot} />}
            </View>
            {item.isLocked ? (
              isPending ? (
                <View style={[styles.pendingBadge, isRTL && styles.rtlRow]}>
                  <ActivityIndicator size={10} color={Colors.primary} />
                  <Text style={[styles.pendingBadgeText, isRTL && styles.rtlText]}>
                    {t("waitingConfirm")}
                  </Text>
                </View>
              ) : (
                <View style={[styles.lockedBadge, isRTL && styles.rtlRow]}>
                  <Ionicons name="lock-closed" size={11} color={Colors.warning} />
                  <Text style={[styles.lockedBadgeText, isRTL && styles.rtlText]}>{t("locked")}</Text>
                </View>
              )
            ) : (
              <Text style={[styles.notifAddress, isRTL && styles.rtlText]} numberOfLines={1}>
                {item.pharmacyAddress}
              </Text>
            )}
            <Text style={[styles.notifTime, isRTL && styles.rtlText]}>
              {formatTime(item.createdAt, language)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.light.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  const currentNotif = notifications.find((n) => n.id === selectedNotif?.id) ?? selectedNotif;
  const isRequestPending = currentNotif?.paymentPending && currentNotif?.isLocked;

  const bellRotate = bellAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-18deg", "18deg"],
  });

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        {/* أيقونة الجرس المتحركة */}
        <Animated.View
          style={[
            styles.bellWrap,
            lockedCount > 0 && styles.bellWrapActive,
            {
              transform: [
                { rotate: bellRotate },
                { scale: bellScale },
              ],
            },
          ]}
        >
          <Ionicons
            name={lockedCount > 0 ? "notifications" : "notifications-outline"}
            size={28}
            color={lockedCount > 0 ? Colors.warning : Colors.primary}
          />
          {lockedCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{lockedCount > 9 ? "9+" : lockedCount}</Text>
            </View>
          )}
        </Animated.View>

        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t("notifications")}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      ) : (
        <FlatList
          data={[...notifications].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={renderNotif}
          contentContainerStyle={[
            styles.list,
            notifications.length === 0 && styles.emptyList,
            { paddingBottom: Platform.OS === "web" ? 34 : 0 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={!!isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={64} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{t("noNotifications")}</Text>
              <Text style={[styles.emptySubtitle, isRTL && styles.rtlText]}>{t("noNotificationsSubtitle")}</Text>
            </View>
          }
        />
      )}

      {/* ====== نافذة الدفع ====== */}
      <Modal
        visible={paymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <DewyaBrand isRTL={isRTL} size="md" variant="bar" />

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

              {isRequestPending ? (
                /* ── حالة الانتظار: الكود صدر وفي انتظار المسؤول ── */
                <>
                  <View style={styles.paymentHeader}>
                    <View style={styles.waitingRing}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                    <Text style={[styles.paymentTitle, isRTL && styles.rtlText]}>
                      {isRTL ? "في انتظار التحقق من الدفع" : "Vérification du paiement en cours"}
                    </Text>
                    <Text style={[styles.paymentSubtitle, isRTL && styles.rtlText]}>
                      {isRTL
                        ? "أرسل 10 MRU مع ذكر الكود المرجعي. سيتحقق المسؤول ويُفتح الإشعار تلقائياً."
                        : "Envoyez 10 MRU avec le code de référence. Le responsable vérifiera et débloquera automatiquement."}
                    </Text>
                  </View>

                  {/* الكود المرجعي */}
                  <View style={styles.refCodeBox}>
                    <Text style={[styles.refCodeLabel, isRTL && styles.rtlText]}>
                      {isRTL ? "الكود المرجعي للدفع" : "Code de référence"}
                    </Text>
                    <View style={styles.refCodeRow}>
                      <Text style={styles.refCodeText}>{currentNotif?.paymentRef}</Text>
                      <TouchableOpacity
                        style={[styles.copyRefBtn, copiedId === "ref" && { backgroundColor: Colors.accent }]}
                        onPress={() => handleCopy(currentNotif?.paymentRef ?? "", "ref")}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={copiedId === "ref" ? "checkmark" : "copy-outline"} size={16} color="#fff" />
                        <Text style={styles.copyRefBtnText}>
                          {copiedId === "ref" ? (isRTL ? "تم!" : "Copié!") : (isRTL ? "نسخ" : "Copier")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.refCodeHint, isRTL && styles.rtlText]}>
                      {isRTL
                        ? "⚠️ اذكر هذا الكود في وصف تحويلك حتى يتمكن المسؤول من التحقق"
                        : "⚠️ Mentionnez ce code dans la description de votre virement pour que l'admin puisse vérifier"}
                    </Text>
                  </View>

                  {/* رقم الدفع الموحّد */}
                  {paymentNumber ? (
                    <View style={[styles.methodCard, { borderLeftColor: Colors.primary, borderLeftWidth: 4 }]}>
                      <View style={[styles.methodTop, isRTL && styles.rtlRow]}>
                        <View style={[styles.methodIconBg, { backgroundColor: Colors.primary + "18" }]}>
                          <FontAwesome5 name="mobile-alt" size={16} color={Colors.primary} />
                        </View>
                        <Text style={[styles.methodName, { color: Colors.primary }]}>
                          {isRTL ? "رقم الدفع" : "Numéro de paiement"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.numberRow, copiedId === "payment" && { backgroundColor: Colors.accent + "12" }, isRTL && styles.rtlRow]}
                        onPress={() => handleCopy(paymentNumber, "payment")}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.accountNumber, { color: Colors.primary }]}>{paymentNumber}</Text>
                        <View style={[styles.copyBtn, { backgroundColor: copiedId === "payment" ? Colors.accent : Colors.primary }]}>
                          <Ionicons name={copiedId === "payment" ? "checkmark" : "copy-outline"} size={14} color="#fff" />
                          <Text style={styles.copyBtnText}>
                            {copiedId === "payment" ? "✓" : (isRTL ? "نسخ" : "Copier")}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.noNumberBox}>
                      <Text style={[styles.noNumberText, isRTL && styles.rtlText]}>
                        {isRTL ? "سيتم إضافة رقم الدفع قريباً" : "Numéro de paiement bientôt disponible"}
                      </Text>
                    </View>
                  )}

                  <View style={styles.waitingFooter}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
                    <Text style={[styles.waitingFooterText, isRTL && styles.rtlText]}>
                      {isRTL
                        ? "سيُفتح الإشعار تلقائياً بعد تأكيد الدفع — لا حاجة لأي إجراء"
                        : "La notification s'ouvrira automatiquement après confirmation — aucune action requise"}
                    </Text>
                  </View>
                </>
              ) : (
                /* ── حالة البداية: لم يُطلب الفتح بعد ── */
                <>
                  <View style={styles.paymentHeader}>
                    <View style={styles.lockRing}>
                      <Ionicons name="lock-closed" size={32} color={Colors.warning} />
                    </View>
                    <Text style={[styles.paymentTitle, isRTL && styles.rtlText]}>
                      {isRTL ? "هذا الإشعار مؤمَّن" : "Notification verrouillée"}
                    </Text>
                    <Text style={[styles.paymentSubtitle, isRTL && styles.rtlText]}>
                      {isRTL
                        ? "لفتح هذا الإشعار، اضغط على «طلب فتح» لتحصل على كود مرجعي فريد، ثم أرسل 10 MRU مع ذكر الكود. سيتحقق المسؤول ويُفتح الإشعار تلقائياً في هاتفك."
                        : "Pour débloquer, appuyez sur «Demander déblocage» pour obtenir un code unique, puis envoyez 10 MRU avec ce code. Le responsable vérifiera et débloquera automatiquement."}
                    </Text>
                  </View>

                  <View style={styles.stepsBox}>
                    {[
                      { n: "1", ar: "اضغط «طلب فتح» لتحصل على كودك", fr: "Appuyez «Demander» pour obtenir votre code" },
                      { n: "2", ar: "أرسل 10 MRU وأذكر الكود في الوصف", fr: "Envoyez 10 MRU avec le code en description" },
                      { n: "3", ar: "سيُفتح الإشعار تلقائياً بعد التحقق", fr: "La notification s'ouvre automatiquement" },
                    ].map((step) => (
                      <View key={step.n} style={[styles.stepRow, isRTL && styles.rtlRow]}>
                        <View style={styles.stepNum}>
                          <Text style={styles.stepNumText}>{step.n}</Text>
                        </View>
                        <Text style={[styles.stepText, isRTL && styles.rtlText]}>
                          {isRTL ? step.ar : step.fr}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.amountRow}>
                    <MaterialCommunityIcons name="cash-multiple" size={20} color={Colors.accent} />
                    <Text style={styles.amountLabel}>
                      {isRTL ? "رسوم الخدمة:" : "Frais de service:"}
                    </Text>
                    <Text style={styles.amountValue}>10 MRU</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleRequestUnlock}
                    activeOpacity={0.85}
                    disabled={requestUnlockMutation.isPending}
                  >
                    {requestUnlockMutation.isPending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="key-outline" size={20} color="#fff" />
                        <Text style={styles.confirmBtnText}>
                          {isRTL ? "طلب فتح الإشعار" : "Demander le déblocage"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setPaymentModal(false); setCopiedId(null); }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>{t("close")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ====== نافذة تفاصيل الصيدلية ====== */}
      <Modal
        visible={detailModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setDetailModal(false); setSelectedNotif(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* شعار أدْواَيَ + أيقونة النجاح */}
            <View style={styles.resultHeaderWrap}>
              <View style={styles.successIconLarge}>
                <MaterialCommunityIcons name="check-circle" size={38} color={Colors.accent} />
              </View>
              <DewyaBrand isRTL={isRTL} size="sm" variant="badge" />
            </View>

            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>{t("pharmacyFound")}</Text>
            <Text style={[styles.modalSubtitle, isRTL && styles.rtlText]}>
              {isRTL ? "تم العثور على الدواء في الصيدلية التالية" : "Ce médicament est disponible dans la pharmacie suivante"}
            </Text>

            {selectedNotif && (
              <View style={styles.infoCard}>
                <InfoRow icon="business-outline" label={t("pharmacyName")} value={selectedNotif.pharmacyName} isRTL={isRTL} />
                <View style={styles.infoDivider} />
                <InfoRow icon="location-outline" label={t("pharmacyAddress")} value={selectedNotif.pharmacyAddress} isRTL={isRTL} />
                <View style={styles.infoDivider} />
                <InfoRow icon="call-outline" label={t("pharmacyPhone")} value={selectedNotif.pharmacyPhone} isRTL={isRTL} />
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => { setDetailModal(false); setSelectedNotif(null); }}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>{t("close")}</Text>
            </TouchableOpacity>

            <DewyaFooter isRTL={isRTL} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, label, value, isRTL }: { icon: string; label: string; value: string; isRTL: boolean }) {
  return (
    <View style={[styles.infoRow, isRTL && styles.rtlRow]}>
      <Ionicons name={icon as any} size={18} color={Colors.primary} />
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, isRTL && styles.rtlText]}>{label}</Text>
        <Text style={[styles.infoValue, isRTL && styles.rtlText]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.light.text },
  bellWrap: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: Colors.primary + "20",
  },
  bellWrapActive: {
    backgroundColor: Colors.warning + "18",
    borderColor: Colors.warning + "40",
  },
  bellBadge: {
    position: "absolute", top: -2, right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 10, minWidth: 18, height: 18,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: "#fff",
  },
  bellBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", lineHeight: 13 },
  list: { padding: 16, gap: 10 },
  emptyList: { flex: 1, justifyContent: "center" },
  notifCard: {
    backgroundColor: Colors.light.card, borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: Colors.light.border, marginBottom: 2,
  },
  unreadCard: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  pendingCard: { borderLeftWidth: 3, borderLeftColor: Colors.primary + "80" },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rtlRow: { flexDirection: "row-reverse" },
  notifIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  lockedIcon: { backgroundColor: Colors.warning + "18" },
  pendingIcon: { backgroundColor: Colors.primary + "15" },
  unlockedIcon: { backgroundColor: Colors.accent + "18" },
  notifContent: { flex: 1 },
  rtlContent: { alignItems: "flex-end" },
  notifHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  notifTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: 6 },
  lockedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  lockedBadgeText: { color: Colors.warning, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  pendingBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  pendingBadgeText: { color: Colors.primary, fontFamily: "Inter_500Medium", fontSize: 12 },
  notifAddress: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginBottom: 4 },
  notifTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textTertiary },
  rtlText: { textAlign: "right" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.light.text, textAlign: "center" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 21 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: Colors.light.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: Colors.light.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, maxHeight: "92%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.light.border, alignSelf: "center", marginBottom: 20 },

  paymentHeader: { alignItems: "center", marginBottom: 20 },
  lockRing: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.warning + "15",
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.warning + "30", marginBottom: 14,
  },
  waitingRing: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.primary + "25", marginBottom: 14,
  },
  paymentTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.light.text, textAlign: "center", marginBottom: 10 },
  paymentSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 21, paddingHorizontal: 4 },

  stepsBox: { backgroundColor: Colors.light.background, borderRadius: 14, padding: 16, marginBottom: 16, gap: 14, borderWidth: 1, borderColor: Colors.light.border },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepNumText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },
  stepText: { flex: 1, fontSize: 13.5, fontFamily: "Inter_400Regular", color: Colors.light.text, lineHeight: 20, paddingTop: 2 },

  refCodeBox: {
    backgroundColor: Colors.primary + "08", borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1.5, borderColor: Colors.primary + "30",
  },
  refCodeLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary, marginBottom: 10, textAlign: "center" },
  refCodeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 },
  refCodeText: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.primary, letterSpacing: 3 },
  copyRefBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  copyRefBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  refCodeHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 18 },

  methodsContainer: { gap: 10, marginBottom: 16 },
  noNumberBox: { backgroundColor: Colors.light.inputBackground, borderRadius: 12, padding: 14, marginBottom: 12, alignItems: "center" },
  noNumberText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, textAlign: "center" },
  methodCard: { backgroundColor: Colors.light.background, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.light.border, overflow: "hidden" },
  methodTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  methodIconBg: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  methodName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  numberRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.light.inputBackground, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12,
  },
  accountNumber: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  copyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 },

  waitingFooter: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.accentLight, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  waitingFooterText: { flex: 1, fontSize: 12.5, fontFamily: "Inter_400Regular", color: Colors.primary, lineHeight: 19 },

  amountRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginBottom: 18, backgroundColor: Colors.accentLight,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
  },
  amountLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.textSecondary },
  amountValue: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.accent },

  confirmBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 6,
  },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  cancelBtn: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: Colors.light.textSecondary, fontFamily: "Inter_500Medium", fontSize: 15 },

  resultHeaderWrap: { alignItems: "center", marginBottom: 12, position: "relative" },
  successIconLarge: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accentLight,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
    borderWidth: 2, borderColor: Colors.accent + "30",
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.light.text, textAlign: "center", marginBottom: 6 },
  modalSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", marginBottom: 16, lineHeight: 18 },
  infoCard: { width: "100%", backgroundColor: Colors.light.background, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.light.border },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 6 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.light.textTertiary, marginBottom: 2 },
  infoValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  infoDivider: { height: 1, backgroundColor: Colors.light.border, marginVertical: 4 },
  closeButton: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  closeButtonText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
});
