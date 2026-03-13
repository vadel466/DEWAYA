import React, { useState } from "react";
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

type DrugRequest = {
  id: string;
  userId: string;
  drugName: string;
  status: "pending" | "responded";
  createdAt: string;
  respondedAt: string | null;
  pharmacyName: string | null;
  pharmacyAddress: string | null;
  pharmacyPhone: string | null;
};

function formatTime(dateStr: string, lang = "ar") {
  const date = new Date(dateStr);
  const locale = lang === "ar" ? "ar-SA" : "fr-FR";
  return date.toLocaleString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useApp();
  const isRTL = language === "ar";
  const qc = useQueryClient();

  const [selectedRequest, setSelectedRequest] = useState<DrugRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyAddress, setPharmacyAddress] = useState("");
  const [pharmacyPhone, setPharmacyPhone] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "responded">("pending");

  const { data: requests = [], isLoading, refetch, isRefetching } = useQuery<DrugRequest[]>({
    queryKey: ["admin-requests"],
    queryFn: async () => {
      const resp = await fetch(`${API_BASE}/requests`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    refetchInterval: 5000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: object }) => {
      const resp = await fetch(`${API_BASE}/requests/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
      setShowModal(false);
      setSelectedRequest(null);
      setPharmacyName("");
      setPharmacyAddress("");
      setPharmacyPhone("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const respondedRequests = requests.filter((r) => r.status === "responded");
  const displayRequests = activeTab === "pending" ? pendingRequests : respondedRequests;

  const handleRespond = () => {
    if (!selectedRequest || !pharmacyName || !pharmacyAddress || !pharmacyPhone) return;
    respondMutation.mutate({
      id: selectedRequest.id,
      body: { pharmacyName, pharmacyAddress, pharmacyPhone },
    });
  };

  const renderRequest = ({ item }: { item: DrugRequest }) => (
    <TouchableOpacity
      style={[styles.requestCard, item.status === "responded" && styles.respondedCard]}
      onPress={() => {
        if (item.status === "pending") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedRequest(item);
          setShowModal(true);
        }
      }}
      activeOpacity={item.status === "pending" ? 0.8 : 1}
    >
      <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
        <View style={[styles.requestIcon, item.status === "responded" ? styles.respondedIcon : styles.pendingIcon]}>
          <MaterialCommunityIcons
            name={item.status === "responded" ? "check-circle" : "clock-outline"}
            size={22}
            color={item.status === "responded" ? Colors.accent : Colors.warning}
          />
        </View>
        <View style={[styles.requestInfo, isRTL && styles.rtlInfo]}>
          <Text style={[styles.drugName, isRTL && styles.rtlText]}>{item.drugName}</Text>
          <Text style={[styles.userId, isRTL && styles.rtlText]}>
            {t("requestedBy")}: {item.userId.substring(0, 16)}...
          </Text>
          <Text style={[styles.requestTime, isRTL && styles.rtlText]}>{formatTime(item.createdAt, language)}</Text>
          {item.status === "responded" && item.pharmacyName && (
            <View style={[styles.responseBadge, isRTL && styles.rtlRow]}>
              <Ionicons name="business-outline" size={12} color={Colors.accent} />
              <Text style={styles.responseText}>{item.pharmacyName}</Text>
            </View>
          )}
        </View>
        {item.status === "pending" && (
          <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerLeft, isRTL && styles.rtlRow]}>
          <View style={styles.adminBadge}>
            <Ionicons name="shield" size={18} color={Colors.primary} />
          </View>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t("adminPanel")}</Text>
        </View>
        <View style={styles.statsBadge}>
          <Text style={styles.statsText}>{pendingRequests.length}</Text>
          <Text style={styles.statsLabel}>{t("pending")}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "pending" && styles.tabBtnActive]}
          onPress={() => setActiveTab("pending")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === "pending" && styles.tabTextActive]}>
            {t("pending")} ({pendingRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "responded" && styles.tabBtnActive]}
          onPress={() => setActiveTab("responded")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === "responded" && styles.tabTextActive]}>
            {t("responded")} ({respondedRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      ) : (
        <FlatList
          data={displayRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
          contentContainerStyle={[
            styles.list,
            displayRequests.length === 0 && styles.emptyList,
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
              <MaterialCommunityIcons name="inbox-remove-outline" size={64} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{t("noPendingRequests")}</Text>
            </View>
          }
        />
      )}

      {/* Respond Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
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

                <View style={styles.formGroup}>
                  <Text style={[styles.label, isRTL && styles.rtlText]}>{t("pharmacyName")}</Text>
                  <View style={[styles.inputRow, isRTL && styles.rtlRow]}>
                    <Ionicons name="business-outline" size={18} color={Colors.light.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isRTL && styles.rtlInput]}
                      placeholder={t("respondPlaceholder")}
                      placeholderTextColor={Colors.light.textTertiary}
                      value={pharmacyName}
                      onChangeText={setPharmacyName}
                      textAlign={isRTL ? "right" : "left"}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, isRTL && styles.rtlText]}>{t("pharmacyAddress")}</Text>
                  <View style={[styles.inputRow, isRTL && styles.rtlRow]}>
                    <Ionicons name="location-outline" size={18} color={Colors.light.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isRTL && styles.rtlInput]}
                      placeholder={t("addressPlaceholder")}
                      placeholderTextColor={Colors.light.textTertiary}
                      value={pharmacyAddress}
                      onChangeText={setPharmacyAddress}
                      textAlign={isRTL ? "right" : "left"}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, isRTL && styles.rtlText]}>{t("pharmacyPhone")}</Text>
                  <View style={[styles.inputRow, isRTL && styles.rtlRow]}>
                    <Ionicons name="call-outline" size={18} color={Colors.light.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isRTL && styles.rtlInput]}
                      placeholder={t("phonePlaceholder")}
                      placeholderTextColor={Colors.light.textTertiary}
                      value={pharmacyPhone}
                      onChangeText={setPharmacyPhone}
                      keyboardType="phone-pad"
                      textAlign={isRTL ? "right" : "left"}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!pharmacyName || !pharmacyAddress || !pharmacyPhone) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleRespond}
                  activeOpacity={0.85}
                  disabled={!pharmacyName || !pharmacyAddress || !pharmacyPhone || respondMutation.isPending}
                >
                  {respondMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#fff" />
                      <Text style={styles.sendButtonText}>{t("sendResponse")}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)} activeOpacity={0.7}>
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
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  adminBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  statsBadge: {
    backgroundColor: Colors.primary + "15",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
  },
  statsText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  statsLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  tabsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: Colors.light.inputBackground,
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: Colors.light.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    padding: 16,
    gap: 10,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },
  requestCard: {
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
  respondedCard: {
    opacity: 0.85,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rtlRow: {
    flexDirection: "row-reverse",
  },
  requestIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingIcon: {
    backgroundColor: Colors.warning + "18",
  },
  respondedIcon: {
    backgroundColor: Colors.accent + "18",
  },
  requestInfo: {
    flex: 1,
    gap: 3,
  },
  rtlInfo: {
    alignItems: "flex-end",
  },
  drugName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  userId: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
  },
  requestTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  responseBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  responseText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  rtlText: {
    textAlign: "right",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    textAlign: "center",
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
    padding: 24,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: "center",
  },
  requestSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 20,
    alignSelf: "center",
  },
  requestSummaryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.primary,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  rtlInput: {
    textAlign: "right",
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.light.textTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    color: Colors.light.textSecondary,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
});
