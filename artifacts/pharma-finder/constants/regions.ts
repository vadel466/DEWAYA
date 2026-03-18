export interface Region {
  id: string;
  ar: string;
  fr: string;
  lat: number;
  lon: number;
}

export const REGIONS: Region[] = [
  { id: "tevragh_zeina", ar: "تيفراغ زينة", fr: "Tevragh-Zeina", lat: 18.1021, lon: -15.9782 },
  { id: "ksar", ar: "كصر", fr: "Ksar", lat: 18.0903, lon: -15.9713 },
  { id: "riyadh", ar: "الرياض", fr: "Riyadh", lat: 18.082, lon: -15.9652 },
  { id: "dar_naim", ar: "دار النعيم", fr: "Dar Naim", lat: 18.107, lon: -15.958 },
  { id: "arafat", ar: "العرفات", fr: "Arafat", lat: 18.0752, lon: -15.943 },
  { id: "toujounine", ar: "توجنين", fr: "Toujounine", lat: 18.0652, lon: -15.9513 },
  { id: "sebkha", ar: "سبخة", fr: "Sebkha", lat: 18.094, lon: -15.978 },
  { id: "el_mina", ar: "الميناء", fr: "El Mina", lat: 18.0873, lon: -15.9893 },
  { id: "teyarett", ar: "تيارت", fr: "Teyarett", lat: 18.0987, lon: -15.9876 },
  { id: "dhahab", ar: "الذهب", fr: "Dhahab", lat: 18.072, lon: -15.96 },
  { id: "nouadhibou", ar: "نواذيبو", fr: "Nouadhibou", lat: 20.933, lon: -17.033 },
  { id: "rosso", ar: "روصو", fr: "Rosso", lat: 16.513, lon: -15.805 },
  { id: "kiffa", ar: "كيفة", fr: "Kiffa", lat: 16.621, lon: -11.404 },
  { id: "atar", ar: "أطار", fr: "Atar", lat: 20.517, lon: -13.05 },
  { id: "kaedi", ar: "كيهيدي", fr: "Kaédi", lat: 16.15, lon: -13.5 },
  { id: "selibaby", ar: "سيليبابي", fr: "Sélibaby", lat: 15.15, lon: -12.183 },
  { id: "nema", ar: "نيمي", fr: "Néma", lat: 16.617, lon: -7.267 },
  { id: "tidjikja", ar: "تيجيكجة", fr: "Tidjikja", lat: 18.55, lon: -11.417 },
  { id: "aleg", ar: "ألاك", fr: "Aleg", lat: 17.05, lon: -13.917 },
  { id: "akjoujt", ar: "أكجوجت", fr: "Akjoujt", lat: 19.75, lon: -14.383 },
  { id: "zouerate", ar: "زويرات", fr: "Zouerate", lat: 22.733, lon: -12.467 },
];

export function getNearestRegion(lat: number, lon: number): Region {
  let nearest = REGIONS[0];
  let minDist = Infinity;
  for (const r of REGIONS) {
    const d = Math.sqrt((r.lat - lat) ** 2 + (r.lon - lon) ** 2);
    if (d < minDist) {
      minDist = d;
      nearest = r;
    }
  }
  return nearest;
}
