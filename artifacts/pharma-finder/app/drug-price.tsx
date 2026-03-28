import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

/* ─── API base — uses Replit dev domain for both native & web ── */
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

/* ─── highlight matching text ───────────────────────────────── */
function Highlighted({
  text, query, style, hl,
}: { text: string; query: string; style?: any; hl?: any }) {
  if (!query || !query.trim()) return <Text style={style}>{text}</Text>;
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${esc})`, "gi"));
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <Text key={i} style={hl}>{p}</Text>
          : <Text key={i}>{p}</Text>
      )}
    </Text>
  );
}

/* ─── types ─────────────────────────────────────────────────── */
type Drug = {
  id: string;
  name: string;
  nameAr: string | null;
  price: number;
  unit: string | null;
  category: string | null;
  notes: string | null;
};

const LIMIT = 20;

/* ─── main ───────────────────────────────────────────────────── */
export default function DrugPriceScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [searchError, setSearchError] = useState(false);
  const [dbEmpty, setDbEmpty] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetch(`${API_BASE}/drug-prices/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.total === 0) setDbEmpty(true); })
      .catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  /* core search */
  const search = useCallback(async (q: string, off = 0, append = false) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]); setSearched(false); setLoading(false);
      setHasMore(false); setOffset(0); setSearchError(false);
      return;
    }
    if (append) setLoadingMore(true);
    else { setLoading(true); setSearchError(false); }

    try {
      const url = `${API_BASE}/drug-prices/search?q=${encodeURIComponent(trimmed)}&limit=${LIMIT}&offset=${off}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: Drug[] = await resp.json();
      if (append) setResults(prev => [...prev, ...data]);
      else setResults(data);
      setHasMore(data.length === LIMIT);
      setOffset(off + data.length);
      setSearched(true);
      setSearchError(false);
    } catch (err) {
      console.error("[drug search error]", String(err));
      if (!append) { setResults([]); setSearched(true); setSearchError(true); }
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  /* debounce — 2 chars minimum */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]); setSearched(false); setLoading(false);
      setHasMore(false); setOffset(0); setSearchError(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query, 0, false), 240);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const loadMore = () => {
    if (!loadingMore && hasMore && query.trim().length >= 2) search(query, offset, true);
  };

  const clearQuery = () => {
    setQuery(""); setResults([]); setSearched(false);
    setHasMore(false); setOffset(0); setSearchError(false);
  };

  const whole = (p: number) => Math.floor(p);
  const dec   = (p: number) => p % 1 !== 0 ? `.${(p % 1).toFixed(1).slice(2)}` : "";

  const isTyping      = query.trim().length >= 2;
  const showResults   = isTyping && !searchError && results.length > 0;
  const showLoading   = isTyping && loading && results.length === 0;
  const showError     = isTyping && searchError;
  const showNotFound  = isTyping && searched && !loading && results.length === 0 && !searchError;
  const showIdle      = !isTyping;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  /* ─── suggestion row ─────────────────────────────────────── */
  const renderRow = ({ item, index }: { item: Drug; index: number }) => {
    const mainName = isRTL && item.nameAr ? item.nameAr : item.name;
    const altName  = isRTL ? item.name : (item.nameAr ?? null);
    const isLast   = index === results.length - 1;

    return (
      <View style={[styles.row, !isLast && styles.rowBorder, isRTL && styles.rtlRow]}>
        <View style={styles.rowPill}>
          <MaterialCommunityIcons name="pill" size={14} color={Colors.warning} />
        </View>
        <View style={[styles.rowNames, isRTL && { alignItems: "flex-end" }]}>
          <Highlighted text={mainName} query={query} style={[styles.rowMain, isRTL && styles.rtl]} hl={styles.hl} />
          {altName
            ? <Highlighted text={altName} query={query} style={[styles.rowAlt, isRTL && styles.rtl]} hl={styles.hl} />
            : null}
          {item.unit
            ? <Text style={[styles.rowUnit, isRTL && styles.rtl]} numberOfLines={1}>{item.unit}</Text>
            : null}
        </View>
        <View style={styles.rowPriceBadge}>
          <Text style={styles.rowPrice}>{whole(item.price)}{dec(item.price)}</Text>
          <Text style={styles.rowCur}>MRU</Text>
        </View>
      </View>
    );
  };

  /* ─── render ─────────────────────────────────────────────── */
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.root, { paddingTop: topPad }]}>

        {/* ════════════════════════════════════════════
            HEADER
           ════════════════════════════════════════════ */}
        <View style={[styles.header, isRTL && styles.rtlRow]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={[styles.headerTitles, isRTL && { alignItems: "flex-end" }]}>
            <Text style={[styles.headerTitle, isRTL && styles.rtl]}>
              {isRTL ? "سعر الدواء" : "Prix du médicament"}
            </Text>
            <Text style={[styles.headerSub, isRTL && styles.rtl]}>
              {isRTL ? "ابحث للاطلاع على السعر الرسمي" : "Recherchez le prix officiel"}
            </Text>
          </View>
          <View style={styles.tagCircle}>
            <MaterialCommunityIcons name="tag-outline" size={20} color={Colors.warning} />
          </View>
        </View>

        {/* ════════════════════════════════════════════
            تنبيهات ثابتة — فوق البحث
            Bandeaux fixes — AU-DESSUS de la recherche
           ════════════════════════════════════════════ */}

        {/* تنبيه رسمي — أصفر */}
        <View style={[styles.bannerAmber, isRTL && { borderLeftWidth: 0, borderRightWidth: 3, borderRightColor: "#B45309", flexDirection: "row-reverse" }]}>
          <MaterialCommunityIcons name="shield-check" size={13} color="#92400E" />
          <Text style={[styles.bannerAmberText, isRTL && styles.rtl]} numberOfLines={2}>
            {isRTL
              ? "أسعار موحَّدة ومعتمَدة من وزارة الصحة الموريتانية — أي زيادة في السعر قد تُعدّ غشّاً"
              : "Prix homologués par le Ministère de la Santé mauritanien — toute hausse peut constituer une fraude"}
          </Text>
        </View>

        {/* توجيه DCI — أزرق */}
        <View style={[styles.bannerBlue, isRTL && { borderLeftWidth: 0, borderRightWidth: 3, borderRightColor: "#2563EB", flexDirection: "row-reverse" }]}>
          <MaterialCommunityIcons name="flask-outline" size={13} color="#2563EB" />
          <Text style={[styles.bannerBlueText, isRTL && styles.rtl]} numberOfLines={2}>
            {isRTL
              ? "لم تجده؟ ابحث بالاسم العلمي (DCI) على العلبة — مثال: Paracétamol"
              : "Introuvable ? Cherchez le DCI sur la boîte — Ex. : Paracétamol"}
          </Text>
        </View>

        {/* ════════════════════════════════════════════
            حقل البحث
            Champ de recherche
           ════════════════════════════════════════════ */}
        <View style={[styles.searchBar, isRTL && styles.rtlRow]}>
          <Ionicons name="search-outline" size={20} color={Colors.primary} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, isRTL && styles.rtl]}
            placeholder={isRTL ? "اكتب اسم الدواء (حرفان كافيان)..." : "Nom du médicament (2 lettres suffisent)..."}
            placeholderTextColor={Colors.light.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            textAlign={isRTL ? "right" : "left"}
            onSubmitEditing={() => { if (query.trim().length >= 2) search(query, 0, false); }}
          />
          {loading
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : query.length > 0
              ? <TouchableOpacity onPress={clearQuery} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={19} color={Colors.light.textTertiary} />
                </TouchableOpacity>
              : null}
        </View>

        {/* ════════════════════════════════════════════
            قائمة الأدوية — ملتصقة بحقل البحث من الأسفل
            Liste des médicaments — collée sous le champ
           ════════════════════════════════════════════ */}

        {/* 1. نتائج البحث */}
        {showResults && (
          <View style={styles.resultsCard}>
            <View style={[styles.resultsHeader, isRTL && styles.rtlRow]}>
              <Text style={[styles.resultsCount, isRTL && styles.rtl]}>
                {isRTL
                  ? `${results.length} نتيجة${hasMore ? "+" : ""} لـ «${query}»`
                  : `${results.length} résultat${results.length > 1 ? "s" : ""}${hasMore ? "+" : ""} pour «${query}»`}
              </Text>
            </View>
            <FlatList
              data={results}
              keyExtractor={item => item.id}
              renderItem={renderRow}
              style={styles.resultsList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onEndReached={loadMore}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                hasMore
                  ? <TouchableOpacity style={styles.moreBtn} onPress={loadMore} disabled={loadingMore} activeOpacity={0.8}>
                      {loadingMore
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Text style={styles.moreText}>{isRTL ? "تحميل المزيد" : "Charger plus"}</Text>}
                    </TouchableOpacity>
                  : null
              }
            />
          </View>
        )}

        {/* 2. Loading */}
        {showLoading && (
          <View style={[styles.inlineBox, isRTL && styles.rtlRow]}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={[styles.inlineText, isRTL && styles.rtl]}>
              {isRTL ? "جاري البحث..." : "Recherche en cours..."}
            </Text>
          </View>
        )}

        {/* 3. خطأ اتصال */}
        {showError && (
          <View style={[styles.errorBox, isRTL && styles.rtlRow]}>
            <MaterialCommunityIcons name="wifi-off" size={18} color="#DC2626" />
            <Text style={[styles.errorText, isRTL && styles.rtl]}>
              {isRTL ? "تعذّر الاتصال بالخادم" : "Erreur de connexion au serveur"}
            </Text>
            <TouchableOpacity onPress={() => search(query, 0, false)} activeOpacity={0.8} style={styles.retryBtn}>
              <Text style={styles.retryText}>{isRTL ? "إعادة" : "Réessayer"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 4. لم يُعثر */}
        {showNotFound && (
          <View style={[styles.notFoundBox, isRTL && styles.rtlRow]}>
            <MaterialCommunityIcons name="pill-off" size={22} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.notFoundTitle, isRTL && styles.rtl]}>
                {isRTL ? "لم يُعثر على هذا الدواء" : "Médicament introuvable"}
              </Text>
              <Text style={[styles.notFoundSub, isRTL && styles.rtl]}>
                {isRTL
                  ? "ابحث بالاسم العلمي (DCI) مثل: Paracétamol، Amoxicillin"
                  : "Cherchez le DCI, ex. : Paracétamol, Amoxicillin"}
              </Text>
            </View>
          </View>
        )}

        {/* 5. Placeholder — حالة الخمول */}
        {showIdle && (
          <View style={styles.placeholder}>
            <View style={styles.placeholderIcon}>
              <MaterialCommunityIcons name="magnify" size={44} color={Colors.primary} />
            </View>
            <Text style={[styles.placeholderTitle, isRTL && styles.rtl]}>
              {dbEmpty
                ? (isRTL ? "قاعدة البيانات فارغة" : "Base de données vide")
                : (isRTL ? "ابدأ الكتابة للبحث" : "Commencez à taper")}
            </Text>
            <Text style={[styles.placeholderSub, isRTL && styles.rtl]}>
              {dbEmpty
                ? (isRTL ? "يُرجى مراجعة الإدارة" : "Contactez l'administrateur")
                : (isRTL ? "ستظهر الاقتراحات فور كتابة حرفين" : "Les suggestions s'affichent dès 2 caractères")}
            </Text>
          </View>
        )}

      </View>
    </KeyboardAvoidingView>
  );
}

/* ─── styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  rtlRow: { flexDirection: "row-reverse" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
  hl: { backgroundColor: Colors.warning + "40", color: "#92400E", borderRadius: 3 },

  /* header */
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  headerTitles: { flex: 1, alignItems: "flex-start" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.text },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  tagCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#FEF9EE", alignItems: "center", justifyContent: "center",
  },

  /* ── التنبيهات فوق البحث ── */
  bannerAmber: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "#FFFBEB",
    borderLeftWidth: 3, borderLeftColor: "#B45309",
    marginHorizontal: 14, marginTop: 10, marginBottom: 3,
    paddingHorizontal: 11, paddingVertical: 8,
    borderRadius: 10,
  },
  bannerAmberText: {
    flex: 1, fontFamily: "Inter_400Regular",
    fontSize: 11.5, color: "#78350F", lineHeight: 17,
  },
  bannerBlue: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "#EFF6FF",
    borderLeftWidth: 3, borderLeftColor: "#2563EB",
    marginHorizontal: 14, marginTop: 0, marginBottom: 8,
    paddingHorizontal: 11, paddingVertical: 8,
    borderRadius: 10,
  },
  bannerBlueText: {
    flex: 1, fontFamily: "Inter_400Regular",
    fontSize: 11.5, color: "#1E40AF", lineHeight: 17,
  },

  /* ── حقل البحث ── */
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 2, borderColor: Colors.primary + "60",
    borderRadius: 14,
    marginHorizontal: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 12 : 0,
    minHeight: 52,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1, fontFamily: "Inter_400Regular",
    fontSize: 15, color: Colors.light.text, paddingVertical: 13,
  },

  /* ── قائمة النتائج — ملتصقة بحقل البحث ── */
  resultsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginHorizontal: 14,
    marginTop: 4,                  /* ← ملتصقة بحقل البحث */
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
    overflow: "hidden",
    maxHeight: 360,
  },
  resultsHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.light.backgroundSecondary ?? "#F8FAFC",
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  resultsCount: {
    fontFamily: "Inter_400Regular", fontSize: 11.5,
    color: Colors.light.textTertiary,
  },
  resultsList: { maxHeight: 312 },

  /* صف نتيجة واحدة */
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 11, gap: 10,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  rowPill: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.warning + "15",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  rowNames: { flex: 1, alignItems: "flex-start", gap: 2 },
  rowMain: { fontFamily: "Inter_600SemiBold", fontSize: 13.5, color: Colors.light.text },
  rowAlt: { fontFamily: "Inter_400Regular", fontSize: 11.5, color: Colors.light.textSecondary },
  rowUnit: { fontFamily: "Inter_400Regular", fontSize: 10.5, color: Colors.light.textTertiary },
  rowPriceBadge: {
    alignItems: "center",
    backgroundColor: Colors.warning + "12",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    minWidth: 56, flexShrink: 0,
  },
  rowPrice: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.warning },
  rowCur: { fontFamily: "Inter_400Regular", fontSize: 9.5, color: Colors.warning + "AA" },

  /* تحميل المزيد */
  moreBtn: {
    alignSelf: "center", marginVertical: 10,
    paddingHorizontal: 22, paddingVertical: 8,
    backgroundColor: Colors.primary + "10", borderRadius: 18,
  },
  moreText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.primary },

  /* loading / error / not-found inline */
  inlineBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 14, marginTop: 4,
    backgroundColor: Colors.light.card,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  inlineText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 14, marginTop: 4,
    backgroundColor: "#FEE2E2",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: "#DC2626" },
  retryBtn: {
    backgroundColor: "#DC2626" + "18",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
  },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#DC2626" },

  notFoundBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 14, marginTop: 4,
    backgroundColor: "#FEF9EE",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.warning + "30",
  },
  notFoundTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13.5, color: Colors.light.text, marginBottom: 2 },
  notFoundSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },

  /* placeholder حالة الخمول */
  placeholder: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 10,
  },
  placeholderIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary + "10",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  placeholderTitle: {
    fontFamily: "Inter_700Bold", fontSize: 17,
    color: Colors.light.text, textAlign: "center",
  },
  placeholderSub: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: Colors.light.textSecondary, textAlign: "center", lineHeight: 19,
  },
});
