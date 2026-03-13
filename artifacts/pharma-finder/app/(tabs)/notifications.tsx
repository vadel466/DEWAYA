import React, { useState, useCallback } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
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
  createdAt: string;
};

function formatTime(dateStr: string, lang: string) {
  const date = new Date(dateStr);
  return date.toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { t, userId, language } = useApp();
  const isRTL = language === "ar";
  const qc = useQueryClient();

  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const [paymentModal, setPaymentModal] = useState(false);

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

  const unlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch(`${API_BASE}/notifications/${id}/unlock`, { method: "POST" });
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
      setPaymentModal(false);
      if (selectedNotif) {
        const updated = { ...selectedNotif, isLocked: false, isRead: true };
        setSelectedNotif(updated);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleNotifPress = useCallback((notif: Notification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedNotif(notif);
    if (notif.isLocked) {
      setPaymentModal(true);
    }
  }, []);

  const handlePay = () => {
    if (selectedNotif) {
      unlockMutation.mutate(selectedNotif.id);
    }
  };

  const lockedCount = notifications.filter((n) => n.isLocked).length;

  const renderNotif = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notifCard, !item.isRead && styles.unreadCard]}
      onPress={() => handleNotifPress(item)}
      activeOpacity={0.85}
    >
      <View style={[styles.notifRow, isRTL && styles.rtlRow]}>
        <View style={[styles.notifIcon, item.isLocked ? styles.lockedIcon : styles.unlockedIcon]}>
          <Ionicons
            name={item.isLocked ? "lock-closed" : "checkmark-circle"}
            size={22}
            color={item.isLocked ? Colors.warning : Colors.accent}
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
            <View style={[styles.lockedBadge, isRTL && styles.rtlRow]}>
              <Ionicons name="lock-closed" size={12} color={Colors.warning} />
              <Text style={[styles.lockedBadgeText, isRTL && styles.rtlText]}>{t("locked")}</Text>
            </View>
          ) : (
            <Text style={[styles.notifAddress, isRTL && styles.rtlText]} numberOfLines={1}>
              {item.pharmacyAddress}
            </Text>
          )}
          <Text style={[styles.notifTime, isRTL && styles.rtlText]}>
            {formatTime(item.createdAt, language)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t("notifications")}</Text>
        {lockedCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{lockedCount}</Text>
          </View>
        )}
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

      {/* Payment Modal */}
      <Modal visible={paymentModal} transparent animationType="slide" onRequestClose={() => setPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.lockIconLarge}>
              <Ionicons name="lock-closed" size={40} color={Colors.warning} />
            </View>

            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>{t("lockedNotification")}</Text>
            <Text style={[styles.modalSubtitle, isRTL && styles.rtlText]}>{t("paymentInfo")}</Text>

            <View style={styles.priceTag}>
              <MaterialCommunityIcons name="cash" size={20} color={Colors.accent} />
              <Text style={styles.priceText}>1 MRU</Text>
            </View>

            <TouchableOpacity style={styles.payButton} onPress={handlePay} activeOpacity={0.85} disabled={unlockMutation.isPending}>
              {unlockMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="lock-open-outline" size={20} color="#fff" />
                  <Text style={styles.payButtonText}>{t("payNow")}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setPaymentModal(false)} activeOpacity={0.7}>
              <Text style={styles.cancelText}>{t("cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pharmacy Detail Modal */}
      {selectedNotif && !selectedNotif.isLocked && (
        <Modal
          visible={!selectedNotif.isLocked && !paymentModal && !!selectedNotif}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedNotif(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />

              <View style={styles.successIconLarge}>
                <Ionicons name="medical" size={36} color={Colors.primary} />
              </View>

              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>{t("pharmacyFound")}</Text>

              <View style={styles.infoCard}>
                <InfoRow icon="business-outline" label={t("pharmacyName")} value={selectedNotif.pharmacyName} isRTL={isRTL} />
                <View style={styles.infoDivider} />
                <InfoRow icon="location-outline" label={t("pharmacyAddress")} value={selectedNotif.pharmacyAddress} isRTL={isRTL} />
                <View style={styles.infoDivider} />
                <InfoRow icon="call-outline" label={t("pharmacyPhone")} value={selectedNotif.pharmacyPhone} isRTL={isRTL} />
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedNotif(null)} activeOpacity={0.8}>
                <Text style={styles.closeButtonText}>{t("close")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  isRTL,
}: {
  icon: string;
  label: string;
  value: string;
  isRTL: boolean;
}) {
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
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },
  notifCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 2,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rtlRow: {
    flexDirection: "row-reverse",
  },
  notifIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedIcon: {
    backgroundColor: Colors.warning + "18",
  },
  unlockedIcon: {
    backgroundColor: Colors.accent + "18",
  },
  notifContent: {
    flex: 1,
  },
  rtlContent: {
    alignItems: "flex-end",
  },
  notifHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 6,
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  lockedBadgeText: {
    color: Colors.warning,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  notifAddress: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
  },
  rtlText: {
    textAlign: "right",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: Colors.light.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.light.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
    alignItems: "center",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    marginBottom: 24,
  },
  lockIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.warning + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.warning + "30",
  },
  successIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.accent + "30",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  priceTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accentLight,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 24,
  },
  priceText: {
    color: Colors.accent,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  payButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  payButtonText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  cancelText: {
    color: Colors.light.textSecondary,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  infoCard: {
    width: "100%",
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 6,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textTertiary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 4,
  },
  closeButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
});
