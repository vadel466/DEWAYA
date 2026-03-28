import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";

const DRUGS_KEY       = "@dewaya_drugs_v2";
const DRUGS_TS_KEY    = "@dewaya_drugs_ts_v2";
const PHARM_KEY       = "@dewaya_pharmacies_v2";
const PHARM_TS_KEY    = "@dewaya_pharmacies_ts_v2";

const DRUGS_TTL   = 24 * 60 * 60 * 1000;   // 24 hours
const PHARM_TTL   = 12 * 60 * 60 * 1000;   // 12 hours
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

/* ─── haversine ─────────────────────────────────────────────── */
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

/* ─── local drug search (case-insensitive, diacritic-tolerant) ─ */
export function localDrugSearch(
  drugs: CachedDrug[],
  query: string,
  limit = 20,
  offset = 0
): CachedDrug[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  const matched = drugs.filter(d =>
    d.name.toLowerCase().includes(q) ||
    (d.nameAr && d.nameAr.includes(q))
  );
  return matched.slice(offset, offset + limit);
}

/* ─── download ALL drugs (paginated) ───────────────────────── */
async function downloadAllDrugs(): Promise<CachedDrug[]> {
  const all: CachedDrug[] = [];
  let offset = 0;

  while (true) {
    const resp = await fetch(
      `${API_BASE}/drug-prices/export?limit=${PAGE_SIZE}&offset=${offset}`,
      { cache: "no-store" }
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

/* ─── download all pharmacies ───────────────────────────────── */
async function downloadAllPharmacies(): Promise<CachedPharmacy[]> {
  const resp = await fetch(`${API_BASE}/pharmacies`, { cache: "no-store" });
  if (!resp.ok) throw new Error("fetch failed");
  return resp.json();
}

/* ─── hook ──────────────────────────────────────────────────── */
type Status = "idle" | "downloading" | "ready" | "error";

export function useOfflineCache() {
  const [drugs,      setDrugs]      = useState<CachedDrug[]>([]);
  const [pharmacies, setPharmacies] = useState<CachedPharmacy[]>([]);
  const [drugStatus, setDrugStatus] = useState<Status>("idle");
  const [pharmStatus,setPharmStatus]= useState<Status>("idle");
  const [drugsCachedAt,  setDrugsCachedAt]  = useState<number | null>(null);
  const [pharmCachedAt,  setPharmCachedAt]  = useState<number | null>(null);

  /* load from storage on mount */
  useEffect(() => {
    (async () => {
      try {
        const [raw, ts] = await Promise.all([
          AsyncStorage.getItem(DRUGS_KEY),
          AsyncStorage.getItem(DRUGS_TS_KEY),
        ]);
        if (raw) {
          setDrugs(JSON.parse(raw));
          setDrugStatus("ready");
          if (ts) setDrugsCachedAt(Number(ts));
        }
      } catch { setDrugStatus("error"); }
    })();

    (async () => {
      try {
        const [raw, ts] = await Promise.all([
          AsyncStorage.getItem(PHARM_KEY),
          AsyncStorage.getItem(PHARM_TS_KEY),
        ]);
        if (raw) {
          setPharmacies(JSON.parse(raw));
          setPharmStatus("ready");
          if (ts) setPharmCachedAt(Number(ts));
        }
      } catch { setPharmStatus("error"); }
    })();
  }, []);

  /* sync drugs from server */
  const syncDrugs = useCallback(async (force = false) => {
    if (drugStatus === "downloading") return;
    const now = Date.now();
    if (!force && drugsCachedAt && now - drugsCachedAt < DRUGS_TTL && drugs.length > 0) return;

    setDrugStatus("downloading");
    try {
      const data = await downloadAllDrugs();
      if (data.length > 0) {
        await AsyncStorage.setItem(DRUGS_KEY, JSON.stringify(data));
        await AsyncStorage.setItem(DRUGS_TS_KEY, String(now));
        setDrugs(data);
        setDrugsCachedAt(now);
        setDrugStatus("ready");
      } else {
        setDrugStatus(drugs.length > 0 ? "ready" : "error");
      }
    } catch {
      setDrugStatus(drugs.length > 0 ? "ready" : "error");
    }
  }, [drugStatus, drugsCachedAt, drugs.length]);

  /* sync pharmacies from server */
  const syncPharmacies = useCallback(async (force = false) => {
    if (pharmStatus === "downloading") return;
    const now = Date.now();
    if (!force && pharmCachedAt && now - pharmCachedAt < PHARM_TTL && pharmacies.length > 0) return;

    setPharmStatus("downloading");
    try {
      const data = await downloadAllPharmacies();
      const ts = Date.now();
      await AsyncStorage.setItem(PHARM_KEY, JSON.stringify(data));
      await AsyncStorage.setItem(PHARM_TS_KEY, String(ts));
      setPharmacies(data);
      setPharmCachedAt(ts);
      setPharmStatus("ready");
    } catch {
      setPharmStatus(pharmacies.length > 0 ? "ready" : "error");
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
