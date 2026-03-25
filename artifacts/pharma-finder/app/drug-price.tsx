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

/* ─── highlight matching text ───────────────────────────────── */
function Highlighted({ text, query, style, hl }: { text: string; query: string; style?: any; hl?: any }) {
  if (!query || query.trim().length === 0) return <Text style={style}>{text}</Text>;
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
  const [searched, setSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [searchError, setSearchError] = useState(false);
  const [dbEmpty, setDbEmpty] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  /* check if DB is empty on mount (silent) */
  useEffect(() => {
    fetch(`${API_BASE}/drug-prices/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.total === 0) setDbEmpty(true); })
      .catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 400);
  }, []);

  /* search function */
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
    } catch {
      if (!append) { setResults([]); setSearched(true); setSearchError(true); }
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  /* debounce */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]); setSearched(false); setLoading(false); setHasMore(false); setOffset(0);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query, 0, false), 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const loadMore = () => {
    if (!loadingMore && hasMore && query.trim().length >= 2) search(query, offset, true);
  };

  const clearQuery = () => {
    setQuery(""); setResults([]); setSearched(false);
    setHasMore(false); setOffset(0); setSearchError(false);
  };

  /* price display */
  const whole = (p: number) => Math.floor(p);
  const dec = (p: number) => p % 1 !== 0 ? `.${(p % 1).toFixed(1).slice(2)}` : "";

  /* ─── result card ──────────────────────────────────────────── */
  const renderItem = ({ item }: { item: Drug }) => {
    const mainName = isRTL && item.nameAr ? item.nameAr : item.name;
    const altName  = isRTL ? item.name : (item.nameAr ?? null);

    return (
      <View style={styles.card}>
        <View style={[styles.cardLeft, isRTL && styles.row]}>
          <View style={styles.pillWrap}>
            <MaterialCommunityIcons name="pill" size={20} color={Colors.warning} />
          </View>
          <View style={[styles.nameCol, isRTL && { alignItems: "flex-end" }]}>
            <Highlighted text={mainName} query={query} style={[styles.nameMain, isRTL && styles.rtl]} hl={styles.hl} />
            {altName ? (
              <Highlighted text={altName} query={query} style={[styles.nameSub, isRTL && styles.rtl]} hl={styles.hl} />
            ) : null}
            {item.unit ? (
              <Text style={[styles.unit, isRTL && styles.rtl]} numberOfLines={1}>{item.unit}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.priceBadge}>
          <Text style={styles.priceNum}>{whole(item.price)}{dec(item.price)}</Text>
          <Text style={styles.priceCur}>MRU</Text>
        </View>
      </View>
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  /* ─── render ─────────────────────────────────────────────── */
  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* ── Header ── */}
      <View style={[styles.header, isRTL && styles.row]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={[styles.headerTitles, isRTL && { alignItems: "flex-end" }]}>
          <Text style={[styles.headerTitle, isRTL && styles.rtl]}>
            {isRTL ? "سعر الدواء" : "Prix du médicament"}
          </Text>
          <Text style={[styles.headerSub, isRTL && styles.rtl]}>
            {isRTL ? "ابحث بالاسم للاطلاع على السعر" : "Recherchez par nom pour voir le prix"}
          </Text>
        </View>
        <View style={styles.tagCircle}>
          <MaterialCommunityIcons name="tag-outline" size={21} color={Colors.warning} />
        </View>
      </View>

      {/* ── Search bar ── */}
      <View style={[styles.searchRow, isRTL && styles.row]}>
        <Ionicons name="search-outline" size={20} color={Colors.light.textSecondary} />
        <TextInput
          ref={inputRef}
          style={[styles.input, isRTL && styles.rtl]}
          placeholder={isRTL ? "اكتب اسم الدواء..." : "Nom du médicament..."}
          placeholderTextColor={Colors.light.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          textAlign={isRTL ? "right" : "left"}
          onSubmitEditing={() => { if (query.trim().length >= 2) search(query, 0, false); }}
        />
        {loading && <ActivityIndicator size="small" color={Colors.primary} />}
        {!loading && query.length > 0 && (
          <TouchableOpacity onPress={clearQuery} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={19} color={Colors.light.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Content ── */}
      {query.trim().length < 2 ? (

        /* placeholder */
        <View style={styles.placeholder}>
          <View style={styles.placeholderIcon}>
            <MaterialCommunityIcons name="magnify" size={46} color={Colors.primary} />
          </View>
          <Text style={[styles.placeholderTitle, isRTL && styles.rtl]}>
            {isRTL ? "اكتب اسم الدواء" : "Tapez le nom du médicament"}
          </Text>
          {dbEmpty ? (
            <Text style={[styles.placeholderSub, { color: Colors.warning }, isRTL && styles.rtl]}>
              {isRTL ? "قاعدة البيانات فارغة — يُرجى مراجعة الإدارة" : "Base de données vide — contactez l'administrateur"}
            </Text>
          ) : (
            <Text style={[styles.placeholderSub, isRTL && styles.rtl]}>
              {isRTL ? "حرفان كافيان — بالعربية أو الفرنسية" : "2 caractères suffisent — arabe ou français"}
            </Text>
          )}
        </View>

      ) : loading ? (

        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>

      ) : searchError ? (

        <View style={styles.placeholder}>
          <View style={[styles.placeholderIcon, { backgroundColor: "#FEE2E2" }]}>
            <MaterialCommunityIcons name="wifi-off" size={46} color="#EF4444" />
          </View>
          <Text style={[styles.placeholderTitle, isRTL && styles.rtl]}>
            {isRTL ? "تعذّر الاتصال" : "Erreur de connexion"}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => search(query, 0, false)}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>{isRTL ? "إعادة المحاولة" : "Réessayer"}</Text>
          </TouchableOpacity>
        </View>

      ) : results.length === 0 ? (

        <View style={styles.placeholder}>
          <View style={[styles.placeholderIcon, { backgroundColor: "#FEF9EE" }]}>
            <MaterialCommunityIcons name="pill-off" size={46} color={Colors.warning} />
          </View>
          <Text style={[styles.placeholderTitle, isRTL && styles.rtl]}>
            {isRTL ? "لم يُعثر على هذا الدواء" : "Médicament introuvable"}
          </Text>
          <Text style={[styles.placeholderSub, isRTL && styles.rtl]}>
            {isRTL
              ? "جرّب الاسم التجاري أو العلمي أو المادة الفعّالة"
              : "Essayez le nom commercial, générique ou la DCI"}
          </Text>
        </View>

      ) : (

        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <Text style={[styles.countLabel, isRTL && styles.rtl]}>
              {isRTL
                ? `${results.length} نتيجة${hasMore ? "+" : ""} لـ "${query}"`
                : `${results.length} résultat${results.length > 1 ? "s" : ""}${hasMore ? "+" : ""} pour "${query}"`}
            </Text>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity style={styles.moreBtn} onPress={loadMore} disabled={loadingMore} activeOpacity={0.8}>
                {loadingMore
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Text style={styles.moreText}>{isRTL ? "تحميل المزيد" : "Charger plus"}</Text>}
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

/* ─── styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  row: { flexDirection: "row-reverse" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
  hl: { backgroundColor: Colors.warning + "35", color: Colors.warning, borderRadius: 3 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  /* header */
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  headerTitles: { flex: 1, alignItems: "flex-start" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.text },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  tagCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#FEF9EE", alignItems: "center", justifyContent: "center",
  },

  /* search */
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.light.card,
    borderWidth: 1.5, borderColor: Colors.light.border,
    borderRadius: 14, marginHorizontal: 16, marginTop: 14, marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 12 : 0,
    minHeight: 52,
  },
  input: {
    flex: 1, fontFamily: "Inter_400Regular",
    fontSize: 16, color: Colors.light.text, paddingVertical: 14,
  },

  /* placeholder */
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, gap: 10 },
  placeholderIcon: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: Colors.primary + "10",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  placeholderTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.text, textAlign: "center" },
  placeholderSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20 },

  /* retry */
  retryBtn: {
    marginTop: 8, backgroundColor: Colors.primary + "18",
    borderRadius: 10, paddingHorizontal: 22, paddingVertical: 10,
  },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.primary },

  /* list */
  list: { padding: 14, paddingTop: 6, gap: 10 },
  countLabel: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: Colors.light.textTertiary, marginBottom: 6,
  },

  /* result card */
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", borderRadius: 16,
    borderWidth: 1, borderColor: Colors.light.border,
    paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
    gap: 10,
  },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  pillWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.warning + "15",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  nameCol: { flex: 1, alignItems: "flex-start", gap: 2 },
  nameMain: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.text },
  nameSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  unit: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textTertiary, marginTop: 1 },

  /* price */
  priceBadge: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.warning + "12",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7,
    minWidth: 64, flexShrink: 0,
  },
  priceNum: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.warning },
  priceCur: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.warning + "AA", marginTop: -1 },

  /* load more */
  moreBtn: {
    alignSelf: "center", marginTop: 6, marginBottom: 20,
    paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: Colors.primary + "10", borderRadius: 20,
  },
  moreText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.primary },
});
