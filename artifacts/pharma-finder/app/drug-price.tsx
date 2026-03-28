import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, FlatList,
  Platform, KeyboardAvoidingView, LogBox,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineCache, localDrugSearch, type CachedDrug } from "@/hooks/useOfflineCache";

LogBox.ignoreLogs(["[drug search error]", "[search timeout]"]);

/* ── For web: use relative path (same origin, routed by Replit proxy)
   For native: use absolute URL to reach the API server            ── */
const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";

const LIMIT = 20;

/* ─── highlight ─────────────────────────────────────────────── */
function Highlighted({ text, query, style, hl }: { text: string; query: string; style?: any; hl?: any }) {
  if (!query?.trim()) return <Text style={style}>{text}</Text>;
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

/* ─── main ───────────────────────────────────────────────────── */
export default function DrugPriceScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";
  const { isOnline } = useNetworkStatus();
  const { drugs, drugStatus, syncDrugs } = useOfflineCache();

  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState<CachedDrug[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [offset, setOffset]           = useState(0);
  const [searchError, setSearchError] = useState(false);
  const [searched, setSearched]       = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [syncing, setSyncing]         = useState(false);

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef     = useRef<TextInput>(null);
  /* keep a ref to latest drugs so async callbacks always see fresh data */
  const drugsRef     = useRef<CachedDrug[]>(drugs);
  useEffect(() => { drugsRef.current = drugs; }, [drugs]);

  /* on mount: focus; defer cache sync so UI appears instantly */
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    /* sync cache after short delay so it doesn't block first paint */
    const s = setTimeout(() => { if (isOnline) syncDrugs(); }, 800);
    return () => { clearTimeout(t); clearTimeout(s); };
  }, []);

  /* ── core search: always hit API, fall back to local cache ── */
  const doSearch = useCallback(async (q: string, off: number, append: boolean) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;

    if (append) setLoadingMore(true);
    else { setLoading(true); setSearchError(false); }

    try {
      const url = `${API_BASE}/drug-prices/search?q=${encodeURIComponent(trimmed)}&limit=${LIMIT}&offset=${off}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000); // 15s timeout
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: CachedDrug[] = await resp.json();

      if (!Array.isArray(data)) throw new Error("bad response");
      if (append) setResults(prev => [...prev, ...data]);
      else setResults(data);
      setHasMore(data.length === LIMIT);
      setOffset(off + data.length);
      setSearched(true);
      setSearchError(false);
    } catch (err: any) {
      if (err?.name === "AbortError") console.warn("[search timeout]");
      else console.warn("[drug search error]", String(err));
      if (!append) {
        /* fall back to local cache */
        const cached = drugsRef.current;
        if (cached.length > 0) {
          const local = localDrugSearch(cached, trimmed, LIMIT, off);
          setResults(local);
          setHasMore(false);
          setOffset(local.length);
          setSearched(true);
          setSearchError(false);
        } else {
          setResults([]);
          setSearched(true);
          setSearchError(true);
        }
      }
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResults([]); setSearched(false); setLoading(false);
    setHasMore(false); setOffset(0); setSearchError(false);
  }, []);

  /* زر تحديث قاعدة البيانات المحلية */
  const handleRefresh = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try { await syncDrugs(); } catch {}
    finally { setSyncing(false); }
  }, [syncing, syncDrugs]);

  /* debounce search — stable effect with no stale closure */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { reset(); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => { doSearch(q, 0, false); }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch, reset]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && query.trim().length >= 2) {
      doSearch(query.trim(), offset, true);
    }
  }, [loadingMore, hasMore, query, offset, doSearch]);

  const clearQuery = () => {
    setQuery(""); reset();
  };

  const whole = (p: number) => Math.floor(p);
  const dec   = (p: number) => p % 1 !== 0 ? `.${(p % 1).toFixed(1).slice(2)}` : "";

  const isTyping      = query.trim().length >= 2;
  const showResults   = isTyping && !searchError && results.length > 0;
  const showLoading   = isTyping && loading && results.length === 0;
  const showError     = isTyping && searchError;
  const showNotFound  = isTyping && searched && !loading && results.length === 0 && !searchError;
  const showIdle      = !isTyping;
  const hasCacheData  = drugs.length > 0;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  /* ─── row ────────────────────────────────────────────────── */
  const renderRow = ({ item, index }: { item: CachedDrug; index: number }) => {
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

        {/* ══════════════════════════════════════════════════════
            صف البحث — يسكن في أعلى نقطة من الشاشة
            [ ← رجوع ]  [ 🔍  ابحث عن الدواء...  ↻ ]
        ══════════════════════════════════════════════════════ */}
        <View style={[styles.searchRow, isRTL && styles.rtlRow]}>
          {/* زر الرجوع */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={22} color={Colors.primary} />
          </TouchableOpacity>

          {/* حقل البحث */}
          <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
            <Ionicons name="search-outline" size={19} color={Colors.primary} />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, isRTL && styles.rtl]}
              placeholder={isRTL ? "ابحث عن سعر الدواء..." : "Rechercher le prix du médicament..."}
              placeholderTextColor={Colors.light.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              textAlign={isRTL ? "right" : "left"}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onSubmitEditing={() => {
                if (query.trim().length >= 2) doSearch(query.trim(), 0, false);
              }}
            />
            {loading
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : query.length > 0
                ? <TouchableOpacity onPress={clearQuery} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
                  </TouchableOpacity>
                : null}
          </View>

          {/* زر التحديث / المزامنة */}
          <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} activeOpacity={0.75} disabled={syncing}>
            {syncing
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Ionicons name="refresh-outline" size={20} color={isOnline ? Colors.primary : Colors.light.textTertiary} />}
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════════════════════════
            منطقة المحتوى المتوسطة
        ══════════════════════════════════════════════════════ */}
        <View style={styles.content}>

          {/* ── قائمة الأدوية ────────────────────────────────── */}
          {showResults && (
            <View style={styles.resultsCard}>
              <View style={[styles.resultsHeader, isRTL && styles.rtlRow]}>
                <Text style={[styles.resultsCount, isRTL && styles.rtl]}>
                  {isRTL
                    ? `${results.length} نتيجة${hasMore ? "+" : ""} لـ «${query}»`
                    : `${results.length} résultat${results.length > 1 ? "s" : ""}${hasMore ? "+" : ""} pour «${query}»`}
                </Text>
                {!isOnline && (
                  <View style={styles.offlinePill}>
                    <MaterialCommunityIcons name="cloud-off-outline" size={11} color="#7C3AED" />
                    <Text style={styles.offlinePillText}>{isRTL ? "محلي" : "local"}</Text>
                  </View>
                )}
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

          {showLoading && (
            <View style={[styles.inlineBox, isRTL && styles.rtlRow]}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={[styles.inlineText, isRTL && styles.rtl]}>
                {isRTL ? "جاري البحث..." : "Recherche en cours..."}
              </Text>
            </View>
          )}

          {showError && (
            <View style={styles.errorBoxWrap}>
              <View style={[styles.errorBox, isRTL && styles.rtlRow]}>
                <MaterialCommunityIcons name="wifi-off" size={18} color="#DC2626" />
                <Text style={[styles.errorText, isRTL && styles.rtl]}>
                  {isRTL ? "تعذّر الاتصال بالخادم" : "Erreur de connexion au serveur"}
                </Text>
                <TouchableOpacity onPress={() => doSearch(query.trim(), 0, false)} activeOpacity={0.8} style={styles.retryBtn}>
                  <Text style={styles.retryText}>{isRTL ? "إعادة" : "Réessayer"}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={handleRefresh}
                disabled={syncing || drugStatus === "downloading"}
                activeOpacity={0.8}
                style={styles.syncCacheBtn}
              >
                {(syncing || drugStatus === "downloading")
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <MaterialCommunityIcons name="cloud-download-outline" size={16} color={Colors.primary} />}
                <Text style={[styles.syncCacheText, isRTL && styles.rtl]}>
                  {(syncing || drugStatus === "downloading")
                    ? (isRTL ? "جارٍ تحميل قاعدة البيانات..." : "Téléchargement en cours...")
                    : (isRTL ? "تحميل قاعدة البيانات للعمل بدون إنترنت" : "Télécharger la base pour mode hors ligne")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

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

          {showIdle && (
            <View style={styles.placeholder}>
              <View style={styles.placeholderIcon}>
                <MaterialCommunityIcons name="magnify" size={44} color={Colors.primary} />
              </View>
              <Text style={[styles.placeholderTitle, isRTL && styles.rtl]}>
                {isRTL ? "ابدأ الكتابة للبحث" : "Commencez à taper"}
              </Text>
              <Text style={[styles.placeholderSub, isRTL && styles.rtl]}>
                {isRTL
                  ? `${hasCacheData ? `${drugs.length.toLocaleString()} دواء مخزّن محلياً • ` : ""}ستظهر الاقتراحات فور كتابة حرفين`
                  : `${hasCacheData ? `${drugs.length.toLocaleString()} médicaments en cache • ` : ""}Suggestions dès 2 caractères`}
              </Text>
              {/* background sync indicator */}
              {(drugStatus === "downloading" || syncing) && (
                <View style={[styles.syncRow, isRTL && styles.rtlRow]}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={[styles.syncText, isRTL && styles.rtl]}>
                    {isRTL ? "تحميل قاعدة البيانات للاستخدام بدون إنترنت..." : "Téléchargement pour mode hors connexion..."}
                  </Text>
                </View>
              )}
            </View>
          )}

        </View>{/* /content */}

        {/* ══════════════════════════════════════════════════════
            بطاقة المعلومات — ثابتة في أسفل الشاشة دائماً
            تحت النص التوجيهي لأيقونة البحث
        ══════════════════════════════════════════════════════ */}
        {!searchFocused && (
          <View style={[styles.infoCard, isRTL && { borderRightWidth: 3, borderLeftWidth: 0, borderRightColor: Colors.primary + "60" }]}>
            <View style={[styles.infoRow, isRTL && styles.rtlRow]}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#059669" style={{ marginTop: 1 }} />
              <Text style={[styles.infoText, isRTL && styles.rtl]}>
                {isRTL
                  ? "الأسعار المعروضة رسميّة وموحَّدة — أي ارتفاع ملحوظ عن السعر المذكور هنا قد يُشكّل مخالفة تجارية"
                  : "Les prix affichés sont officiels et uniformes — tout écart significatif peut constituer une infraction commerciale"}
              </Text>
            </View>
            <View style={styles.infoSep} />
            <View style={[styles.infoRow, isRTL && styles.rtlRow]}>
              <MaterialCommunityIcons name="flask-outline" size={14} color="#2563EB" style={{ marginTop: 1 }} />
              <Text style={[styles.infoText, styles.infoTextBlue, isRTL && styles.rtl]}>
                {isRTL
                  ? "إن لم تجد الدواء فهو غير معتمد — ابحث بالاسم العلمي (DCI) المكتوب تحت الاسم التجاري على العلبة، مثل: Paracétamol"
                  : "Médicament introuvable = non homologué — cherchez son DCI inscrit sous le nom commercial sur la boîte, ex. : Paracétamol"}
              </Text>
            </View>
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

  /* صف البحث الرئيسي — أعلى الشاشة */
  searchRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 8, gap: 8,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },

  /* منطقة المحتوى المتوسطة */
  content: { flex: 1 },

  /* بطاقة معلومات — ثابتة في أسفل الشاشة */
  infoCard: {
    marginHorizontal: 12, marginBottom: 10, marginTop: 4,
    borderRadius: 12, overflow: "hidden",
    backgroundColor: "#F8FFFE",
    borderWidth: 1, borderColor: Colors.primary + "30",
    borderLeftWidth: 3, borderLeftColor: Colors.primary + "60",
  },
  infoRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  infoSep: { height: 1, backgroundColor: Colors.primary + "15", marginHorizontal: 12 },
  infoText: {
    flex: 1, fontFamily: "Inter_400Regular",
    fontSize: 11.5, lineHeight: 17, color: "#065F46",
  },
  infoTextBlue: { color: "#1E40AF" },

  /* حقل البحث — داخل searchRow */
  searchBar: {
    flex: 1,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 2, borderColor: Colors.primary + "40",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 10 : 0,
    minHeight: 46,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  searchBarFocused: {
    borderColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  searchInput: {
    flex: 1, fontFamily: "Inter_400Regular",
    fontSize: 15, color: Colors.light.text, paddingVertical: 11,
  },

  /* results */
  resultsCard: {
    backgroundColor: "#FFFFFF", borderRadius: 14,
    marginHorizontal: 14, marginTop: 4,
    borderWidth: 1, borderColor: Colors.light.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 5,
    overflow: "hidden", flex: 1,
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
  offlinePill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#EDE9FE", borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  offlinePillText: {
    fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#7C3AED",
  },
  resultsList: { flex: 1 },

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
  rowAlt:  { fontFamily: "Inter_400Regular", fontSize: 11.5, color: Colors.light.textSecondary },
  rowUnit: { fontFamily: "Inter_400Regular", fontSize: 10.5, color: Colors.light.textTertiary },
  rowPriceBadge: {
    alignItems: "center", backgroundColor: Colors.warning + "12",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    minWidth: 56, flexShrink: 0,
  },
  rowPrice: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.warning },
  rowCur:  { fontFamily: "Inter_400Regular", fontSize: 9.5, color: Colors.warning + "AA" },

  moreBtn: {
    alignSelf: "center", marginVertical: 10,
    paddingHorizontal: 22, paddingVertical: 8,
    backgroundColor: Colors.primary + "10", borderRadius: 18,
  },
  moreText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.primary },

  inlineBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 14, marginTop: 4,
    backgroundColor: Colors.light.card,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  inlineText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },

  errorBoxWrap: { gap: 6 },
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
  syncCacheBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 14,
    backgroundColor: Colors.primary + "12",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  syncCacheText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.primary },

  notFoundBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 14, marginTop: 4,
    backgroundColor: "#FEF9EE", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.warning + "30",
  },
  notFoundTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13.5, color: Colors.light.text, marginBottom: 2 },
  notFoundSub:   { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },

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
  syncRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 14, opacity: 0.7,
  },
  syncText: {
    fontFamily: "Inter_400Regular", fontSize: 11.5,
    color: Colors.light.textSecondary,
  },
});
