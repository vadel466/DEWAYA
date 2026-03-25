import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  ScrollView,
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

/* ─── helpers ──────────────────────────────────────────────── */
function HighlightedText({
  text, query, style, highlightStyle,
}: { text: string; query: string; style?: any; highlightStyle?: any }) {
  if (!query || query.trim().length === 0) return <Text style={style}>{text}</Text>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <Text key={i} style={highlightStyle}>{part}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

/* ─── types ─────────────────────────────────────────────────── */
type DrugResult = {
  id: string;
  name: string;
  nameAr: string | null;
  price: number;
  unit: string | null;
  category: string | null;
  notes: string | null;
};

type Stats = {
  total: number;
  categories: { name: string; count: number }[];
};

const CATEGORY_ICONS: Record<string, string> = {
  "Antibiotiques": "bacteria-outline",
  "Antalgiques": "bandage-outline",
  "Gastro-entérologie": "medical-outline",
  "Diabète": "water-outline",
  "Cardiologie / Tension": "heart-outline",
  "Antiparasitaires": "bug-outline",
  "Allergie": "flower-outline",
  "Corticoïdes": "flask-outline",
  "Dermatologie": "body-outline",
  "Ophtalmologie": "eye-outline",
  "Vitamines / Suppléments": "nutrition-outline",
  "Perfusion / Soins": "medkit-outline",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Antibiotiques": "#2563EB",
  "Antalgiques": "#DC2626",
  "Gastro-entérologie": "#059669",
  "Diabète": "#D97706",
  "Cardiologie / Tension": "#E11D48",
  "Antiparasitaires": "#7C3AED",
  "Allergie": "#0891B2",
  "Corticoïdes": "#65A30D",
  "Dermatologie": "#EA580C",
  "Ophtalmologie": "#0284C7",
  "Vitamines / Suppléments": "#16A34A",
  "Perfusion / Soins": "#6B7280",
};

/* ─── main component ─────────────────────────────────────────── */
export default function DrugPriceScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DrugResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryResults, setCategoryResults] = useState<DrugResult[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const LIMIT = 20;

  /* load stats on mount */
  useEffect(() => {
    fetchStats();
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/drug-prices/stats`);
      if (r.ok) setStats(await r.json());
    } catch { /* silent */ }
    finally { setStatsLoading(false); }
  };

  /* main search */
  const search = useCallback(async (q: string, off = 0, append = false) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]); setSearched(false); setLoading(false); setHasMore(false); setOffset(0);
      return;
    }
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const url = `${API_BASE}/drug-prices/search?q=${encodeURIComponent(trimmed)}&limit=${LIMIT}&offset=${off}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error();
      const data: DrugResult[] = await resp.json();
      if (append) setResults(prev => [...prev, ...data]);
      else setResults(data);
      setHasMore(data.length === LIMIT);
      setOffset(off + data.length);
      setSearched(true);
    } catch {
      if (!append) { setResults([]); setSearched(true); }
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  /* debounced search */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSelectedCategory(null);
    if (query.trim().length < 2) {
      setResults([]); setSearched(false); setLoading(false); setHasMore(false); setOffset(0);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query, 0, false), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  /* browse by category */
  const browseCategory = async (cat: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(cat);
    setQuery("");
    setResults([]);
    setSearched(false);
    setCategoryLoading(true);
    try {
      const r = await fetch(`${API_BASE}/drug-prices/category/${encodeURIComponent(cat)}?limit=50`);
      if (r.ok) setCategoryResults(await r.json());
    } catch { setCategoryResults([]); }
    finally { setCategoryLoading(false); }
  };

  const clearCategory = () => {
    setSelectedCategory(null);
    setCategoryResults([]);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && query.trim().length >= 2) {
      search(query, offset, true);
    }
  };

  const priceWhole = (p: number) => Math.floor(p);
  const priceDec = (p: number) => p % 1 !== 0 ? `.${(p % 1).toFixed(1).slice(2)}` : "";

  const renderResult = ({ item }: { item: DrugResult }) => {
    const displayName = isRTL && item.nameAr ? item.nameAr : item.name;
    const subName = isRTL ? item.name : (item.nameAr || null);
    const catColor = item.category ? (CATEGORY_COLORS[item.category] ?? Colors.primary) : Colors.primary;

    return (
      <View style={styles.resultCard}>
        <View style={[styles.resultCardTop, isRTL && styles.rowReverse]}>
          <View style={[styles.pillIcon, { backgroundColor: catColor + "18" }]}>
            <MaterialCommunityIcons name="pill" size={22} color={catColor} />
          </View>
          <View style={[styles.resultNames, isRTL && { alignItems: "flex-end" }]}>
            <HighlightedText
              text={displayName}
              query={query}
              style={[styles.resultName, isRTL && styles.rtlText]}
              highlightStyle={styles.highlight}
            />
            {subName ? (
              <HighlightedText
                text={subName}
                query={query}
                style={[styles.resultNameAr, isRTL && styles.rtlText]}
                highlightStyle={styles.highlight}
              />
            ) : null}
            {item.category ? (
              <View style={[styles.catChipSmall, { backgroundColor: catColor + "15" }]}>
                <Text style={[styles.catChipSmallText, { color: catColor }]}>{item.category}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceLabel}>{isRTL ? "السعر" : "PRIX"}</Text>
            <Text style={styles.priceText}>{priceWhole(item.price)}{priceDec(item.price)}</Text>
            <Text style={styles.priceUnit}>MRU</Text>
          </View>
        </View>

        {(item.unit || item.notes) && (
          <View style={[styles.resultCardBottom, isRTL && styles.rowReverse]}>
            {item.unit && (
              <View style={[styles.metaChip, isRTL && styles.rowReverse]}>
                <Ionicons name="cube-outline" size={12} color={Colors.light.textSecondary} />
                <Text style={styles.metaChipText}>{item.unit}</Text>
              </View>
            )}
            {item.notes && (
              <Text style={[styles.resultNotes, isRTL && styles.rtlText]} numberOfLines={1}>
                {item.notes}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const activeResults = selectedCategory ? categoryResults : results;
  const isActiveLoading = selectedCategory ? categoryLoading : loading;

  /* ─── render ─────────────────────────────────────────────── */
  return (
    <View style={[styles.container, { paddingTop: topPad }]}>

      {/* Header */}
      <View style={[styles.header, isRTL && styles.rowReverse]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={[styles.headerCenter, isRTL && { alignItems: "flex-end" }]}>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
            {isRTL ? "سعر الدواء" : "Prix du médicament"}
          </Text>
          {stats && !statsLoading ? (
            <Text style={[styles.headerSub, isRTL && styles.rtlText]}>
              {isRTL
                ? `${stats.total.toLocaleString()} دواء متاح في القاعدة`
                : `${stats.total.toLocaleString()} médicament${stats.total > 1 ? "s" : ""} disponible${stats.total > 1 ? "s" : ""}`}
            </Text>
          ) : (
            <Text style={[styles.headerSub, isRTL && styles.rtlText]}>
              {isRTL ? "ابحث بالاسم للاطلاع على السعر" : "Recherchez par nom pour voir le prix"}
            </Text>
          )}
        </View>
        <View style={styles.tagIcon}>
          <MaterialCommunityIcons name="tag-outline" size={22} color={Colors.warning} />
        </View>
      </View>

      {/* Search box */}
      <View style={[styles.searchBox, isRTL && styles.rowReverse, selectedCategory && styles.searchBoxActive]}>
        <Ionicons name="search-outline" size={20} color={selectedCategory ? Colors.light.textTertiary : Colors.light.textSecondary} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, isRTL && styles.rtlText]}
          placeholder={isRTL ? "اكتب اسم الدواء بالعربية أو الفرنسية..." : "Nom du médicament en français ou en arabe..."}
          placeholderTextColor={Colors.light.textTertiary}
          value={query}
          onChangeText={(t) => { setQuery(t); clearCategory(); }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          textAlign={isRTL ? "right" : "left"}
          onSubmitEditing={() => { if (query.trim().length >= 2) search(query, 0, false); }}
        />
        {isActiveLoading && <ActivityIndicator size="small" color={Colors.primary} />}
        {!isActiveLoading && (query.length > 0 || selectedCategory) && (
          <TouchableOpacity
            onPress={() => { setQuery(""); setResults([]); setSearched(false); clearCategory(); }}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Active category pill */}
      {selectedCategory && (
        <TouchableOpacity
          style={[styles.activeCatPill, { backgroundColor: (CATEGORY_COLORS[selectedCategory] ?? Colors.primary) + "18" }]}
          onPress={clearCategory}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name={(CATEGORY_ICONS[selectedCategory] ?? "folder-outline") as any}
            size={14}
            color={CATEGORY_COLORS[selectedCategory] ?? Colors.primary}
          />
          <Text style={[styles.activeCatPillText, { color: CATEGORY_COLORS[selectedCategory] ?? Colors.primary }]}>
            {selectedCategory}
          </Text>
          <Ionicons name="close" size={14} color={CATEGORY_COLORS[selectedCategory] ?? Colors.primary} />
        </TouchableOpacity>
      )}

      {/* Content area */}
      {!searched && !selectedCategory && query.length < 2 ? (

        /* ── Empty / home state ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Stats badges */}
          {stats && stats.total > 0 && (
            <View style={[styles.statsBanner, isRTL && styles.rowReverse]}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="pill" size={20} color={Colors.primary} />
                <Text style={styles.statNumber}>{stats.total.toLocaleString()}</Text>
                <Text style={styles.statLabel}>{isRTL ? "دواء" : "Médicaments"}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="folder-outline" size={20} color={Colors.warning} />
                <Text style={styles.statNumber}>{stats.categories.length}</Text>
                <Text style={styles.statLabel}>{isRTL ? "فئة" : "Catégories"}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#16A34A" />
                <Text style={[styles.statNumber, { color: "#16A34A" }]}>
                  {isRTL ? "محدّثة" : "À jour"}
                </Text>
                <Text style={styles.statLabel}>{isRTL ? "القاعدة" : "Base"}  </Text>
              </View>
            </View>
          )}

          {stats && stats.total === 0 && (
            <View style={styles.emptyDbBanner}>
              <MaterialCommunityIcons name="database-off-outline" size={32} color={Colors.light.textTertiary} />
              <Text style={[styles.emptyDbText, isRTL && styles.rtlText]}>
                {isRTL
                  ? "قاعدة الأدوية فارغة — يُرجى مطالبة المسؤول باستيراد بيانات الأسعار"
                  : "Base de données vide — veuillez demander à l'administrateur d'importer les prix"}
              </Text>
            </View>
          )}

          {/* Search hint */}
          <View style={styles.hintBox}>
            <View style={styles.hintIconWrap}>
              <MaterialCommunityIcons name="magnify" size={42} color={Colors.primary} />
            </View>
            <Text style={[styles.hintTitle, isRTL && styles.rtlText]}>
              {isRTL ? "اكتب اسم الدواء" : "Tapez le nom du médicament"}
            </Text>
            <Text style={[styles.hintSub, isRTL && styles.rtlText]}>
              {isRTL
                ? "حرفان كافيان — يدعم الأسماء الفرنسية والعربية"
                : "2 caractères suffisent — français et arabe supportés"}
            </Text>
          </View>

          {/* Categories grid */}
          {stats && stats.categories.length > 0 && (
            <View style={styles.catSection}>
              <Text style={[styles.catSectionTitle, isRTL && styles.rtlText]}>
                {isRTL ? "تصفح حسب الفئة" : "Parcourir par catégorie"}
              </Text>
              <View style={styles.catGrid}>
                {stats.categories.map(cat => {
                  const color = CATEGORY_COLORS[cat.name] ?? Colors.primary;
                  const icon = (CATEGORY_ICONS[cat.name] ?? "folder-outline") as any;
                  return (
                    <TouchableOpacity
                      key={cat.name}
                      style={[styles.catCard, { borderColor: color + "30", backgroundColor: color + "08" }]}
                      onPress={() => browseCategory(cat.name)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.catIconCircle, { backgroundColor: color + "18" }]}>
                        <Ionicons name={icon} size={20} color={color} />
                      </View>
                      <Text style={[styles.catCardName, { color }, isRTL && styles.rtlText]} numberOfLines={2}>
                        {cat.name}
                      </Text>
                      <Text style={styles.catCardCount}>
                        {cat.count} {isRTL ? "دواء" : "méd."}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Tips */}
          <View style={styles.tipsBox}>
            <View style={[styles.tipRow, isRTL && styles.rowReverse]}>
              <Ionicons name="language-outline" size={15} color={Colors.primary} />
              <Text style={[styles.tipText, isRTL && styles.rtlText]}>
                {isRTL ? "البحث يدعم الأسماء بالفرنسية والعربية معاً" : "Recherche en français et en arabe"}
              </Text>
            </View>
            <View style={[styles.tipRow, isRTL && styles.rowReverse]}>
              <Ionicons name="cash-outline" size={15} color={Colors.primary} />
              <Text style={[styles.tipText, isRTL && styles.rtlText]}>
                {isRTL ? "الأسعار بالأوقية الموريتانية الجديدة (MRU)" : "Prix en Ouguiya mauritanienne (MRU)"}
              </Text>
            </View>
            <View style={[styles.tipRow, isRTL && styles.rowReverse]}>
              <Ionicons name="refresh-outline" size={15} color={Colors.primary} />
              <Text style={[styles.tipText, isRTL && styles.rtlText]}>
                {isRTL ? "الأسعار محدّثة دورياً من مرجع وزارة الصحة" : "Prix mis à jour périodiquement"}
              </Text>
            </View>
          </View>
        </ScrollView>

      ) : isActiveLoading ? (

        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
            {isRTL ? "جاري البحث..." : "Recherche en cours..."}
          </Text>
        </View>

      ) : activeResults.length === 0 ? (

        /* ── No results ── */
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: "#FEF9EE" }]}>
            <MaterialCommunityIcons name="pill-off" size={52} color={Colors.warning} />
          </View>
          <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
            {isRTL ? "لم يُعثر على هذا الدواء" : "Médicament introuvable"}
          </Text>
          <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
            {selectedCategory
              ? (isRTL ? `لا يوجد دواء في فئة "${selectedCategory}"` : `Aucun médicament dans "${selectedCategory}"`)
              : (isRTL ? `لا يوجد سعر مسجّل لـ "${query}"` : `Aucun prix enregistré pour "${query}"`)}
          </Text>
          <Text style={[styles.emptySub, isRTL && styles.rtlText, { marginTop: 4, fontSize: 12 }]}>
            {isRTL ? "جرّب الاسم التجاري أو العلمي أو اسم المادة الفعّالة" : "Essayez le nom commercial, générique ou la DCI"}
          </Text>
        </View>

      ) : (

        /* ── Results list ── */
        <FlatList
          data={activeResults}
          keyExtractor={(item) => item.id}
          renderItem={renderResult}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={!selectedCategory ? loadMore : undefined}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <View style={[styles.resultsHeader, isRTL && styles.rowReverse]}>
              <Text style={[styles.resultsCount, isRTL && styles.rtlText]}>
                {isRTL
                  ? `${activeResults.length} نتيجة${hasMore && !selectedCategory ? "+" : ""}`
                  : `${activeResults.length} résultat${activeResults.length > 1 ? "s" : ""}${hasMore && !selectedCategory ? "+" : ""}`}
              </Text>
              {!selectedCategory && (
                <Text style={styles.resultsHint}>
                  {isRTL ? `"${query}"` : `"${query}"`}
                </Text>
              )}
            </View>
          }
          ListFooterComponent={
            !selectedCategory && hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore} activeOpacity={0.8}>
                {loadingMore
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <>
                    <Ionicons name="chevron-down" size={16} color={Colors.primary} />
                    <Text style={styles.loadMoreText}>
                      {isRTL ? "تحميل المزيد" : "Charger plus"}
                    </Text>
                  </>}
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
  container: { flex: 1, backgroundColor: Colors.light.background },
  rowReverse: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "flex-start" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.text },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  tagIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#FEF9EE", alignItems: "center", justifyContent: "center",
  },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.light.card,
    borderWidth: 1.5, borderColor: Colors.light.border,
    borderRadius: 14, marginHorizontal: 16, marginTop: 14, marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 12 : 0,
    gap: 10, minHeight: 52,
  },
  searchBoxActive: { borderColor: Colors.light.textTertiary },
  searchInput: {
    flex: 1, fontFamily: "Inter_400Regular",
    fontSize: 16, color: Colors.light.text, paddingVertical: 14,
  },

  activeCatPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", marginHorizontal: 16, marginBottom: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  activeCatPillText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },

  /* stats banner */
  statsBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    backgroundColor: Colors.primary + "08",
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1, borderColor: Colors.primary + "15",
  },
  statItem: { alignItems: "center", gap: 4, flex: 1 },
  statNumber: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.text },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.light.border },

  /* empty DB */
  emptyDbBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#FEF9EE",
    marginHorizontal: 16, marginTop: 14, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.warning + "30",
  },
  emptyDbText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, lineHeight: 18 },

  /* hint / hero */
  hintBox: { alignItems: "center", paddingHorizontal: 32, paddingTop: 24, gap: 8 },
  hintIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary + "10",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  hintTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.text, textAlign: "center" },
  hintSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20 },

  /* categories */
  catSection: { marginTop: 20, paddingHorizontal: 16 },
  catSectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.text, marginBottom: 12 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catCard: {
    width: "47%", borderRadius: 14, padding: 14,
    borderWidth: 1, gap: 8, alignItems: "flex-start",
  },
  catIconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  catCardName: { fontFamily: "Inter_600SemiBold", fontSize: 12, lineHeight: 17 },
  catCardCount: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textTertiary },

  /* tips */
  tipsBox: {
    backgroundColor: Colors.primary + "06",
    borderRadius: 14, marginHorizontal: 16, marginTop: 16,
    padding: 14, gap: 10,
    borderWidth: 1, borderColor: Colors.primary + "12",
  },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tipText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.primary, lineHeight: 19, flex: 1 },

  /* results */
  list: { padding: 16, paddingTop: 8, gap: 10 },
  resultsHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 8,
  },
  resultsCount: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.textSecondary },
  resultsHint: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textTertiary },

  /* result card */
  resultCard: {
    backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden",
    borderWidth: 1, borderColor: Colors.primary + "18",
    shadowColor: "#000", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09, shadowRadius: 14, elevation: 7,
  },
  resultCardTop: {
    backgroundColor: Colors.primary + "06",
    borderLeftWidth: 5, borderLeftColor: Colors.primary,
    padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
  },
  resultCardBottom: {
    paddingHorizontal: 14, paddingTop: 9, paddingBottom: 11,
    borderTopWidth: 1, borderTopColor: Colors.light.border,
    flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center",
  },
  pillIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  resultNames: { flex: 1, alignItems: "flex-start", gap: 2 },
  resultName: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.light.text, lineHeight: 19 },
  highlight: { backgroundColor: "#FEF08A", color: "#92400E", fontFamily: "Inter_700Bold", borderRadius: 3 },
  resultNameAr: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, textAlign: "right", writingDirection: "rtl" },
  catChipSmall: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3 },
  catChipSmallText: { fontFamily: "Inter_500Medium", fontSize: 10 },
  priceBadge: {
    backgroundColor: "#0D9488", borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8,
    alignItems: "center", justifyContent: "center", minWidth: 82,
    shadowColor: "#0D9488", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  priceLabel: { fontFamily: "Inter_400Regular", fontSize: 9, color: "rgba(255,255,255,0.8)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 1 },
  priceText: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff", letterSpacing: 0.2, lineHeight: 24 },
  priceUnit: { fontFamily: "Inter_500Medium", fontSize: 10, color: "rgba(255,255,255,0.85)", marginTop: 1 },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.light.background,
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  metaChipText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary },
  resultNotes: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textTertiary, flex: 1, lineHeight: 16 },

  /* load more */
  loadMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 8, marginBottom: 20,
    paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.primary + "40",
    backgroundColor: Colors.primary + "06",
  },
  loadMoreText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.primary },

  /* empty state */
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.text, textAlign: "center" },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, textAlign: "center", lineHeight: 22 },
});
