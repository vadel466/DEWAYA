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

function HighlightedText({ text, query, style, highlightStyle }: { text: string; query: string; style?: any; highlightStyle?: any }) {
  if (!query || query.trim().length === 0) {
    return <Text style={style}>{text}</Text>;
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <Text key={i} style={[highlightStyle]}>{part}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

type DrugResult = {
  id: string;
  name: string;
  nameAr: string | null;
  price: number;
  unit: string | null;
  category: string | null;
  notes: string | null;
};

export default function DrugPriceScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DrugResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/drug-prices/search?q=${encodeURIComponent(trimmed)}`);
      if (!resp.ok) throw new Error();
      const data: DrugResult[] = await resp.json();
      setResults(data);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 300); }, []);

  const formatPrice = (price: number) =>
    price % 1 === 0 ? `${price} MRU` : `${price.toFixed(1)} MRU`;

  const renderResult = ({ item }: { item: DrugResult }) => {
    const displayName = isRTL && item.nameAr ? item.nameAr : item.name;
    const subName = isRTL ? item.name : (item.nameAr || null);
    const priceNum = item.price;
    const priceWhole = Math.floor(priceNum);
    const priceDec = priceNum % 1 !== 0 ? `.${(priceNum % 1).toFixed(1).slice(2)}` : "";
    return (
    <View style={styles.resultCard}>
      {/* Top section: pill icon + names + price badge */}
      <View style={[styles.resultCardTop, isRTL && styles.rowReverse]}>
        <View style={styles.pillIcon}>
          <MaterialCommunityIcons name="pill" size={22} color={Colors.primary} />
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
        </View>
        {/* Price badge — teal background, large bold price */}
        <View style={styles.priceBadge}>
          <Text style={styles.priceLabel}>{isRTL ? "السعر" : "PRIX"}</Text>
          <Text style={styles.priceText}>
            {priceWhole}{priceDec}
          </Text>
          <Text style={styles.priceUnit}>MRU</Text>
        </View>
      </View>

      {/* Bottom meta chips */}
      {(item.unit || item.category || item.notes) && (
        <View style={[styles.resultCardBottom, isRTL && styles.rowReverse]}>
          {item.category && (
            <View style={[styles.metaChip, isRTL && styles.rowReverse]}>
              <Ionicons name="folder-outline" size={12} color={Colors.light.textSecondary} />
              <Text style={styles.metaChipText}>{item.category}</Text>
            </View>
          )}
          {item.unit && (
            <View style={[styles.metaChip, isRTL && styles.rowReverse]}>
              <Ionicons name="cube-outline" size={12} color={Colors.light.textSecondary} />
              <Text style={styles.metaChipText}>{item.unit}</Text>
            </View>
          )}
          {item.notes && (
            <Text style={[styles.resultNotes, isRTL && styles.rtlText]} numberOfLines={2}>
              {item.notes}
            </Text>
          )}
        </View>
      )}
    </View>
  );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

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
          <Text style={[styles.headerSub, isRTL && styles.rtlText]}>
            {isRTL ? "ابحث بالاسم للاطلاع على السعر" : "Recherchez par nom pour voir le prix"}
          </Text>
        </View>
        <View style={styles.tagIcon}>
          <MaterialCommunityIcons name="tag-outline" size={22} color={Colors.warning} />
        </View>
      </View>

      {/* Search box */}
      <View style={[styles.searchBox, isRTL && styles.rowReverse]}>
        <Ionicons name="search-outline" size={20} color={Colors.light.textSecondary} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, isRTL && styles.rtlText]}
          placeholder={isRTL ? "ابحث عن دواء..." : "Rechercher un médicament..."}
          placeholderTextColor={Colors.light.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          textAlign={isRTL ? "right" : "left"}
        />
        {loading && <ActivityIndicator size="small" color={Colors.primary} />}
        {!loading && query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(""); setResults([]); setSearched(false); }} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results or empty states */}
      {!searched && query.length < 2 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="magnify" size={52} color={Colors.warning} />
          </View>
          <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
            {isRTL ? "اكتب اسم الدواء" : "Tapez le nom du médicament"}
          </Text>
          <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
            {isRTL
              ? "يكفي حرفان للبدء في البحث، ستظهر النتائج تلقائياً"
              : "2 caractères suffisent pour lancer la recherche automatique"}
          </Text>
          <View style={styles.tipsBox}>
            <Text style={[styles.tipText, isRTL && styles.rtlText]}>
              {isRTL ? "• البحث يدعم الأسماء بالفرنسية والعربية" : "• Recherche en français et en arabe"}
            </Text>
            <Text style={[styles.tipText, isRTL && styles.rtlText]}>
              {isRTL ? "• الأسعار بالأوقية الموريتانية (MRU)" : "• Prix en Ouguiya mauritanienne (MRU)"}
            </Text>
          </View>
        </View>
      ) : searched && results.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: "#FEF9EE" }]}>
            <MaterialCommunityIcons name="pill-off" size={52} color={Colors.warning} />
          </View>
          <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
            {isRTL ? "لم يُعثر على هذا الدواء" : "Médicament introuvable"}
          </Text>
          <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
            {isRTL
              ? `لا يوجد سعر مسجّل لـ "${query}"`
              : `Aucun prix enregistré pour "${query}"`}
          </Text>
          <Text style={[styles.emptySub, isRTL && styles.rtlText, { marginTop: 6, fontSize: 12 }]}>
            {isRTL ? "جرّب كتابة الاسم التجاري أو العلمي" : "Essayez le nom commercial ou générique"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResult}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={[styles.resultsCount, isRTL && styles.rtlText]}>
                {isRTL
                  ? `${results.length} نتيجة`
                  : `${results.length} résultat${results.length > 1 ? "s" : ""}`}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  rowReverse: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "flex-start" },
  headerTitle: {
    fontFamily: "Inter_700Bold", fontSize: 17,
    color: Colors.light.text,
  },
  headerSub: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: Colors.light.textSecondary, marginTop: 1,
  },
  tagIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#FEF9EE",
    alignItems: "center", justifyContent: "center",
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 12 : 0,
    gap: 10,
    minHeight: 52,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.light.text,
    paddingVertical: 14,
  },

  list: { padding: 16, paddingTop: 8, gap: 10 },
  resultsCount: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },

  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.primary + "20",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 10,
  },
  resultCardTop: {
    backgroundColor: Colors.primary + "08",
    borderLeftWidth: 6,
    borderLeftColor: Colors.primary,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  resultCardBottom: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pillIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.primary + "18",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  resultNames: { flex: 1, alignItems: "flex-start" },
  resultName: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 20,
  },
  highlight: {
    backgroundColor: "#FEF08A",
    color: "#92400E",
    fontFamily: "Inter_700Bold",
    borderRadius: 3,
  },
  resultNameAr: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  resultNameSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 1,
  },
  priceBadge: {
    backgroundColor: "#0D9488",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 88,
    shadowColor: "#0D9488",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 10,
    elevation: 8,
  },
  priceLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  priceText: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#fff",
    letterSpacing: 0.3,
    lineHeight: 26,
  },
  priceUnit: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    marginTop: 1,
  },
  resultMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  metaChipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  resultNotes: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textTertiary,
    flex: 1,
    lineHeight: 18,
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.primary + "10",
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  tipsBox: {
    backgroundColor: Colors.primary + "08",
    borderRadius: 12,
    padding: 14,
    gap: 6,
    width: "100%",
    marginTop: 8,
  },
  tipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 20,
  },
});
