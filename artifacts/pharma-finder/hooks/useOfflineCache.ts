import { useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";

const DRUGS_KEY     = "@dewaya_drugs_v2";
const DRUGS_TS_KEY  = "@dewaya_drugs_ts_v2";
const PHARM_KEY     = "@dewaya_pharmacies_v2";
const PHARM_TS_KEY  = "@dewaya_pharmacies_ts_v2";

const DRUGS_TTL   = 24 * 60 * 60 * 1000;   // 24 h
const PHARM_TTL   = 12 * 60 * 60 * 1000;   // 12 h
const PAGE_SIZE   = 500;

export type CachedDrug = {
  id: string;
  name: string;
  nameAr: string | null;
  price: number;
  unit: string | null;
  category: string | null;
  notes: string | null;
};

export type CachedPharmacy = {
  id: string;
  name: string;
  nameAr: string | null;
  address: string;
  addressAr: string | null;
  phone: string;
  lat: number | null;
  lon: number | null;
  region: string | null;
};

/* ─── haversine ──────────────────────────────────────────────────── */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dO = ((lon2 - lon1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ─── local drug search — with simple 1-entry memo cache ─────────── */
type SearchCache = { query: string; limit: number; offset: number; results: CachedDrug[] };
const _searchCache: SearchCache | null = null;
let _lastSearchCache: SearchCache | null = _searchCache;

export function localDrugSearch(
  drugs: CachedDrug[],
  query: string,
  limit = 20,
  offset = 0
): CachedDrug[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  /* Return cached result when nothing changed */
  if (
    _lastSearchCache &&
    _lastSearchCache.query === q &&
    _lastSearchCache.limit === limit &&
    _lastSearchCache.offset === offset
  ) {
    return _lastSearchCache.results;
  }

  const matched = drugs.filter(d =>
    d.name.toLowerCase().includes(q) ||
    (d.nameAr && d.nameAr.includes(q))
  );
  const results = matched.slice(offset, offset + limit);

  _lastSearchCache = { query: q, limit, offset, results };
  return results;
}

/* ─── download ALL drugs (paginated, with abort support) ─────────── */
async function downloadAllDrugs(signal?: AbortSignal): Promise<CachedDrug[]> {
  const all: CachedDrug[] = [];
  let offset = 0;

  while (true) {
    if (signal?.aborted) break;
    const resp = await fetch(
      `${API_BASE}/drug-prices/export?limit=${PAGE_SIZE}&offset=${offset}`,
      { cache: "no-store", signal }
    );
    if (!resp.ok) break;
    const page: CachedDrug[] = await resp.json();
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

/* ─── download all pharmacies (with abort support) ───────────────── */
async function downloadAllPharmacies(signal?: AbortSignal): Promise<CachedPharmacy[]> {
  const resp = await fetch(`${API_BASE}/pharmacies`, { cache: "no-store", signal });
  if (!resp.ok) throw new Error("fetch failed");
  return resp.json();
}

/* ─── hook ───────────────────────────────────────────────────────── */
type Status = "idle" | "downloading" | "ready" | "error";

export function useOfflineCache() {
  const [drugs,      setDrugs]      = useState<CachedDrug[]>([]);
  const [pharmacies, setPharmacies] = useState<CachedPharmacy[]>([]);
  const [drugStatus, setDrugStatus] = useState<Status>("idle");
  const [pharmStatus,setPharmStatus]= useState<Status>("idle");
  const [drugsCachedAt,  setDrugsCachedAt]  = useState<number | null>(null);
  const [pharmCachedAt,  setPharmCachedAt]  = useState<number | null>(null);

  /* Track alive state to avoid setState after unmount */
  const mountedRef = useRef(true);
  /* AbortControllers for in-flight requests */
  const drugAbortRef  = useRef<AbortController | null>(null);
  const pharmAbortRef = useRef<AbortController | null>(null);

  /* ── load from storage on mount ── */
  useEffect(() => {
    mountedRef.current = true;

    /* Batch both reads in one call */
    AsyncStorage.multiGet([DRUGS_KEY, DRUGS_TS_KEY, PHARM_KEY, PHARM_TS_KEY])
      .then((pairs) => {
        if (!mountedRef.current) return;

        const [drugsRaw, drugsTsRaw, pharmRaw, pharmTsRaw] = pairs.map(p => p[1]);

        if (drugsRaw) {
          try {
            setDrugs(JSON.parse(drugsRaw));
            setDrugStatus("ready");
            if (drugsTsRaw) setDrugsCachedAt(Number(drugsTsRaw));
          } catch { setDrugStatus("error"); }
        }

        if (pharmRaw) {
          try {
            setPharmacies(JSON.parse(pharmRaw));
            setPharmStatus("ready");
            if (pharmTsRaw) setPharmCachedAt(Number(pharmTsRaw));
          } catch { setPharmStatus("error"); }
        }
      })
      .catch(() => {
        /* Silent — keep idle status */
      });

    return () => {
      mountedRef.current = false;
      /* Cancel any in-flight downloads */
      drugAbortRef.current?.abort();
      pharmAbortRef.current?.abort();
    };
  }, []);

  /* ── sync drugs from server ── */
  const syncDrugs = useCallback(async (force = false) => {
    if (!mountedRef.current) return;
    if (drugStatus === "downloading") return;
    const now = Date.now();
    if (!force && drugsCachedAt && now - drugsCachedAt < DRUGS_TTL && drugs.length > 0) return;

    drugAbortRef.current?.abort();
    const controller = new AbortController();
    drugAbortRef.current = controller;

    if (mountedRef.current) setDrugStatus("downloading");
    try {
      const data = await downloadAllDrugs(controller.signal);
      if (controller.signal.aborted || !mountedRef.current) return;
      if (data.length > 0) {
        const ts = Date.now();
        await AsyncStorage.multiSet([
          [DRUGS_KEY, JSON.stringify(data)],
          [DRUGS_TS_KEY, String(ts)],
        ]);
        if (!mountedRef.current) return;
        setDrugs(data);
        setDrugsCachedAt(ts);
        setDrugStatus("ready");
        /* Invalidate search cache when drugs update */
        _lastSearchCache = null;
      } else {
        if (mountedRef.current) setDrugStatus(drugs.length > 0 ? "ready" : "error");
      }
    } catch {
      if (mountedRef.current && !controller.signal.aborted) {
        setDrugStatus(drugs.length > 0 ? "ready" : "error");
      }
    }
  }, [drugStatus, drugsCachedAt, drugs.length]);

  /* ── sync pharmacies from server ── */
  const syncPharmacies = useCallback(async (force = false) => {
    if (!mountedRef.current) return;
    if (pharmStatus === "downloading") return;
    const now = Date.now();
    if (!force && pharmCachedAt && now - pharmCachedAt < PHARM_TTL && pharmacies.length > 0) return;

    pharmAbortRef.current?.abort();
    const controller = new AbortController();
    pharmAbortRef.current = controller;

    if (mountedRef.current) setPharmStatus("downloading");
    try {
      const data = await downloadAllPharmacies(controller.signal);
      if (controller.signal.aborted || !mountedRef.current) return;
      const ts = Date.now();
      await AsyncStorage.multiSet([
        [PHARM_KEY, JSON.stringify(data)],
        [PHARM_TS_KEY, String(ts)],
      ]);
      if (!mountedRef.current) return;
      setPharmacies(data);
      setPharmCachedAt(ts);
      setPharmStatus("ready");
    } catch {
      if (mountedRef.current && !controller.signal.aborted) {
        setPharmStatus(pharmacies.length > 0 ? "ready" : "error");
      }
    }
  }, [pharmStatus, pharmCachedAt, pharmacies.length]);

  const isDrugsStale = drugsCachedAt
    ? Date.now() - drugsCachedAt > DRUGS_TTL
    : true;

  return {
    drugs,
    pharmacies,
    drugStatus,
    pharmStatus,
    drugsCachedAt,
    pharmCachedAt,
    isDrugsStale,
    syncDrugs,
    syncPharmacies,
    localDrugSearch,
    haversineKm,
  };
}
