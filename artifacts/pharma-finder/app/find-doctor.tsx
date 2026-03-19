import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, FlatList, Image, Linking, Modal, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DOCTOR_GREEN = "#1BB580";

type Doctor = {
  id: string;
  doctorName: string;
  doctorNameAr: string | null;
  specialty: string | null;
  specialtyAr: string | null;
  clinicName: string;
  clinicNameAr: string | null;
  address: string;
  addressAr: string | null;
  phone: string;
  scheduleText: string | null;
  scheduleAr: string | null;
  region: string | null;
  isActive: boolean;
};

export default function FindDoctorScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [query, setQuery] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleImageUri, setScheduleImageUri] = useState<string | null>(null);
  const [scheduleImageLoading, setScheduleImageLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const fetchDoctors = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const url = q && q.trim().length > 1
        ? `${API_BASE}/doctors?q=${encodeURIComponent(q.trim())}`
        : `${API_BASE}/doctors`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error();
      const data: Doctor[] = await resp.json();
      setDoctors(data);
      setFetched(true);
    } catch {
      setDoctors([]);
      setFetched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchDoctors(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const openSchedule = async (doc: Doctor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDoctor(doc);
    setShowScheduleModal(true);
    setScheduleImageUri(null);
    setScheduleImageLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/doctors/${doc.id}/image`);
      if (resp.ok) {
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onloadend = () => setScheduleImageUri(reader.result as string);
        reader.readAsDataURL(blob);
      } else {
        setScheduleImageUri(null);
      }
    } catch {
      setScheduleImageUri(null);
    } finally {
      setScheduleImageLoading(false);
    }
  };

  const callPhone = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${phone}`);
  };

  const renderDoctor = ({ item }: { item: Doctor }) => {
    const name = isRTL && item.doctorNameAr ? item.doctorNameAr : item.doctorName;
    const clinic = isRTL && item.clinicNameAr ? item.clinicNameAr : item.clinicName;
    const specialty = isRTL && item.specialtyAr ? item.specialtyAr : item.specialty;
    const address = isRTL && item.addressAr ? item.addressAr : item.address;
    const hasSchedule = !!(item.scheduleText || item.scheduleAr);

    return (
      <View style={styles.doctorCard}>
        <View style={[styles.cardTop, isRTL && styles.rowReverse]}>
          <View style={styles.avatarWrap}>
            <MaterialCommunityIcons name="doctor" size={28} color={DOCTOR_GREEN} />
          </View>
          <View style={[styles.doctorInfo, isRTL && { alignItems: "flex-end" }]}>
            <Text style={[styles.doctorName, isRTL && styles.rtlText]}>{name}</Text>
            {specialty && (
              <View style={[styles.specialtyBadge, isRTL && { alignSelf: "flex-end" }]}>
                <Text style={styles.specialtyText}>{specialty}</Text>
              </View>
            )}
            <Text style={[styles.clinicName, isRTL && styles.rtlText]}>{clinic}</Text>
          </View>
        </View>

        <View style={[styles.cardDivider]} />

        <View style={[styles.detailsWrap, isRTL && { alignItems: "flex-end" }]}>
          <View style={[styles.detailRow, isRTL && styles.rowReverse]}>
            <Ionicons name="location-outline" size={14} color={Colors.light.textSecondary} />
            <Text style={[styles.detailText, isRTL && styles.rtlText]} numberOfLines={2}>{address}</Text>
          </View>
          {item.region && (
            <View style={[styles.detailRow, isRTL && styles.rowReverse]}>
              <Ionicons name="map-outline" size={14} color={Colors.light.textSecondary} />
              <Text style={[styles.detailText, isRTL && styles.rtlText]}>{item.region}</Text>
            </View>
          )}
        </View>

        <View style={[styles.actionsRow, isRTL && styles.rowReverse]}>
          <TouchableOpacity
            style={[styles.callBtn, isRTL && styles.rowReverse]}
            onPress={() => callPhone(item.phone)}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={15} color="#fff" />
            <Text style={styles.callBtnText}>{item.phone}</Text>
          </TouchableOpacity>
          {hasSchedule && (
            <TouchableOpacity
              style={[styles.scheduleBtn, isRTL && styles.rowReverse]}
              onPress={() => openSchedule(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={15} color={DOCTOR_GREEN} />
              <Text style={styles.scheduleBtnText}>
                {isRTL ? "جدول الدوام" : "Horaires"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.rowReverse]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={[styles.headerCenter, isRTL && { alignItems: "flex-end" }]}>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
            {isRTL ? "جِدْ طبيبك" : "Trouvez votre médecin"}
          </Text>
          <Text style={[styles.headerSub, isRTL && styles.rtlText]}>
            {isRTL ? "أطباء، مصحات، مستشفيات" : "Médecins, cliniques, hôpitaux"}
          </Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: DOCTOR_GREEN + "15" }]}>
          <MaterialCommunityIcons name="doctor" size={22} color={DOCTOR_GREEN} />
        </View>
      </View>

      {/* Search box */}
      <View style={[styles.searchBox, isRTL && styles.rowReverse]}>
        <Ionicons name="search-outline" size={20} color={Colors.light.textSecondary} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, isRTL && styles.rtlText]}
          placeholder={isRTL ? "ابحث عن طبيب أو مصحة..." : "Rechercher un médecin ou clinique..."}
          placeholderTextColor={Colors.light.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          textAlign={isRTL ? "right" : "left"}
        />
        {loading && <ActivityIndicator size="small" color={DOCTOR_GREEN} />}
        {!loading && query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading && !fetched ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={DOCTOR_GREEN} />
        </View>
      ) : fetched && doctors.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: DOCTOR_GREEN + "12" }]}>
            <MaterialCommunityIcons name="doctor" size={52} color={DOCTOR_GREEN} />
          </View>
          <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
            {isRTL ? "لا توجد نتائج" : "Aucun résultat"}
          </Text>
          <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
            {isRTL
              ? "لم يتم إضافة أطباء بعد، تابع التحديثات"
              : "Aucun médecin enregistré pour le moment"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(item) => item.id}
          renderItem={renderDoctor}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            doctors.length > 0 ? (
              <Text style={[styles.countLabel, isRTL && styles.rtlText]}>
                {isRTL
                  ? `${doctors.length} طبيب/مصحة`
                  : `${doctors.length} médecin${doctors.length > 1 ? "s" : ""}`}
              </Text>
            ) : null
          }
        />
      )}

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowScheduleModal(false); setSelectedDoctor(null); setScheduleImageUri(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={[styles.modalHeader, isRTL && styles.rowReverse]}>
              <View>
                <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "جدول الدوام" : "Horaires de consultation"}
                </Text>
                {selectedDoctor && (
                  <Text style={[styles.modalSubtitle, isRTL && styles.rtlText]}>
                    {isRTL && selectedDoctor.doctorNameAr
                      ? selectedDoctor.doctorNameAr
                      : selectedDoctor.doctorName}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => { setShowScheduleModal(false); setSelectedDoctor(null); setScheduleImageUri(null); }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              {scheduleImageLoading ? (
                <ActivityIndicator size="large" color={DOCTOR_GREEN} style={{ marginVertical: 32 }} />
              ) : scheduleImageUri ? (
                <Image
                  source={{ uri: scheduleImageUri }}
                  style={styles.scheduleImage}
                  resizeMode="contain"
                />
              ) : null}
              {selectedDoctor && (selectedDoctor.scheduleAr || selectedDoctor.scheduleText) && (
                <View style={styles.scheduleTextBox}>
                  <Text style={[styles.scheduleTextContent, isRTL && styles.rtlText]}>
                    {isRTL && selectedDoctor.scheduleAr
                      ? selectedDoctor.scheduleAr
                      : selectedDoctor.scheduleText}
                  </Text>
                </View>
              )}
              {selectedDoctor && !scheduleImageUri && !selectedDoctor.scheduleText && !selectedDoctor.scheduleAr && !scheduleImageLoading && (
                <View style={styles.noSchedule}>
                  <Ionicons name="calendar-outline" size={40} color={Colors.light.textTertiary} />
                  <Text style={[styles.noScheduleText, isRTL && styles.rtlText]}>
                    {isRTL ? "لم يُضَف جدول بعد" : "Aucun horaire disponible"}
                  </Text>
                </View>
              )}
            </ScrollView>
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
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "flex-start" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.text },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  headerIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.light.cardBackground,
    borderWidth: 1.5, borderColor: Colors.light.border,
    borderRadius: 14, marginHorizontal: 16, marginTop: 14, marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 12 : 0,
    gap: 10, minHeight: 52,
  },
  searchInput: {
    flex: 1, fontFamily: "Inter_400Regular",
    fontSize: 15, color: Colors.light.text, paddingVertical: 14,
  },

  list: { padding: 16, paddingTop: 8, gap: 12 },
  countLabel: {
    fontFamily: "Inter_500Medium", fontSize: 13,
    color: Colors.light.textSecondary, marginBottom: 4,
  },

  doctorCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: Colors.light.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: DOCTOR_GREEN + "15",
    alignItems: "center", justifyContent: "center",
  },
  doctorInfo: { flex: 1, gap: 4 },
  doctorName: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.text },
  specialtyBadge: {
    backgroundColor: DOCTOR_GREEN + "18",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: "flex-start",
  },
  specialtyText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: DOCTOR_GREEN },
  clinicName: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textSecondary },
  cardDivider: { height: 1, backgroundColor: Colors.light.border },
  detailsWrap: { gap: 5 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  detailText: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: Colors.light.textSecondary, flex: 1, lineHeight: 18,
  },
  actionsRow: {
    flexDirection: "row", gap: 10, flexWrap: "wrap",
  },
  callBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9, flex: 1, justifyContent: "center",
  },
  callBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  scheduleBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: DOCTOR_GREEN + "15",
    borderWidth: 1.5, borderColor: DOCTOR_GREEN + "40",
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
    justifyContent: "center",
  },
  scheduleBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: DOCTOR_GREEN },

  emptyState: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 12,
  },
  emptyIcon: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.text, textAlign: "center" },
  emptySub: {
    fontFamily: "Inter_400Regular", fontSize: 14,
    color: Colors.light.textSecondary, textAlign: "center", lineHeight: 22,
  },

  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: "85%", paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.light.border, alignSelf: "center",
    marginTop: 12, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.text },
  modalSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  modalContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  scheduleImage: { width: "100%", minHeight: 200, borderRadius: 12 },
  scheduleTextBox: {
    backgroundColor: DOCTOR_GREEN + "08",
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: DOCTOR_GREEN + "25",
  },
  scheduleTextContent: {
    fontFamily: "Inter_400Regular", fontSize: 14,
    color: Colors.light.text, lineHeight: 22,
  },
  noSchedule: {
    alignItems: "center", justifyContent: "center",
    paddingVertical: 40, gap: 12,
  },
  noScheduleText: {
    fontFamily: "Inter_400Regular", fontSize: 14,
    color: Colors.light.textTertiary, textAlign: "center",
  },
});
