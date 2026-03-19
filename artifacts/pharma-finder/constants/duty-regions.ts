export interface DutyRegion {
  id: string;
  ar: string;
  fr: string;
}

export const DUTY_REGIONS: DutyRegion[] = [
  { id: "nkc_sud",    ar: "نواكشوط الجنوبية",   fr: "Nouakchott Sud"   },
  { id: "nkc_nord",   ar: "انواكشوط الشمالية",   fr: "Nouakchott Nord"  },
  { id: "nkc_ouest",  ar: "أنواكشوط الغربية",    fr: "Nouakchott Ouest" },
  { id: "nouadhibou", ar: "أنواذيبُ",             fr: "Nouadhibou"       },
  { id: "nema",       ar: "النعمه",               fr: "Néma"             },
  { id: "rosso",      ar: "روصو",                 fr: "Rosso"            },
  { id: "laayoune",   ar: "لعيون",                fr: "Laâyoune"         },
  { id: "kiffa",      ar: "كيفه",                 fr: "Kiffa"            },
  { id: "selibaby",   ar: "سيلبابي",              fr: "Sélibaby"         },
  { id: "keleini",    ar: "كيليني",               fr: "Kéléiné"          },
  { id: "aleg",       ar: "ألاكْ",                fr: "Aleg"             },
];
