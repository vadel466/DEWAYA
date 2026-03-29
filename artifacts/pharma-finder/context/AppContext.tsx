import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Vibration, Platform, AppState, InteractionManager } from "react-native";
import * as Notifications from "expo-notifications";
import { Audio } from "expo-av";
import type { Region } from "@/constants/regions";

type Language = "ar" | "fr";

type AppContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  userId: string;
  t: (key: string) => string;
  lockedCount: number;
  region: Region | null;
  setRegion: (r: Region | null) => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => Promise<void>;
  adminLogout: () => Promise<void>;
};

const translations: Record<Language, Record<string, string>> = {
  ar: {
    appName: "أدْواَيَ",
    appNameSub: "DEWAYA",
    appTagline: "أقرب صيدلية لدوائك",
    nearestPharmacy: "أقرب صيدلية",
    nearestPharmacyDesc: "ابحث عن أقرب صيدلية في منطقتك",
    searchDrug: "ابحث عن دواء",
    searchDrugDesc: "ابحث بالاسم أو صوّر العلبة",
    drugPrice: "سعر الدواء",
    drugPriceDesc: "اطّلع على سعر دوائك بسرعة",
    dutyPharmacies: "صيدليات المداومة",
    dutyPharmaciesDesc: "الصيدليات المناوبة في منطقتك",
    dutyAndPrice: "صيدليات المداومة وسعر الدواء",
    dutyAndPriceDesc: "جداول المناوبة وقاعدة بيانات الأسعار",
    findDoctor: "التمريض المنزلي",
    findDoctorDesc: "طلب ممرض في المنزل ورعاية صحية",
    otherServices: "خدمات أخرى",
    otherServicesDesc: "خدمات متنوعة إضافية",
    regionLabel: "اختر منطقتك",
    regionPlaceholder: "حدد منطقتك...",
    detectLocation: "تحديد موقعي",
    locationDetecting: "جارٍ التحديد...",
    locationError: "تعذّر تحديد الموقع",
    selectRegion: "اختر المنطقة",
    comingSoon: "قريباً",
    comingSoonMsg: "هذه الخدمة ستكون متاحة قريباً",
    searchTitle: "البحث عن دواء",
    searchPlaceholder: "أدخل اسم الدواء...",
    searchButton: "إرسال الطلب",
    orText: "أو",
    uploadImage: "تصوير علبة الدواء",
    imageDrug: "صورة علبة دواء",
    requestSent: "تم إرسال طلبك",
    requestSentSubtitle: "تابع الإشعارات، سنُبلّغك فور العثور على الدواء",
    newSearch: "بحث جديد",
    notifications: "الإشعارات",
    noNotifications: "لا توجد إشعارات بعد",
    noNotificationsSubtitle: "ابحث عن دواء لتلقّي إشعارات",
    lockedNotification: "اضغط لفتح الإشعار مقابل 50 MRU",
    unlockFor: "فتح مقابل 50 MRU",
    pharmacyFound: "تم العثور على صيدلية",
    pharmacyName: "اسم الصيدلية",
    pharmacyAddress: "العنوان",
    pharmacyPhone: "الهاتف",
    adminPanel: "لوحة الإدارة",
    pendingRequests: "الطلبات المعلّقة",
    noPendingRequests: "لا توجد طلبات معلّقة",
    drugName: "اسم الدواء",
    requestTime: "وقت الطلب",
    respondToRequest: "الرد على الطلب",
    respondPlaceholder: "اسم الصيدلية",
    addressPlaceholder: "العنوان الكامل",
    phonePlaceholder: "رقم الهاتف",
    sendResponse: "إرسال الرد",
    cancel: "إلغاء",
    changeLanguage: "Français",
    home: "الرئيسية",
    admin: "الإدارة",
    close: "إغلاق",
    responded: "تم الرد",
    pending: "قيد الانتظار",
    paymentInfo: "لفتح هذا الإشعار، أرسل 50 MRU عبر وسيلة الدفع أدناه",
    payNow: "ادفع الآن — 50 MRU",
    loading: "جارٍ التحميل...",
    error: "حدث خطأ، حاول مجدداً",
    retry: "إعادة المحاولة",
    user: "مستخدم",
    requestedBy: "طلب بواسطة",
    unlock: "فتح",
    locked: "مقفل • 50 MRU",
    newNotification: "إشعار جديد",
    requestId: "رقم الطلب",
    notifAlertTitle: "🔔 وصل إشعار جديد!",
    notifAlertBody: "تم العثور على الدواء الذي بحثت عنه. اضغط للاطلاع على التفاصيل.",
    notifUnlockedTitle: "✅ تم فتح الإشعار",
    notifUnlockedBody: "يمكنك الآن رؤية تفاصيل الصيدلية.",
    directionsLabel: "الاتجاهات",
    locatingLabel: "جارٍ تحديد الموقع...",
    locationDetectedLabel: "تم تحديد موقعك • مرتّب حسب القرب",
    noPharmaciesRegion: "لا توجد صيدليات مسجّلة في منطقتك",
    contactToAdd: "تواصل معنا لإدراج صيدليتك في الدليل",
    selectRegionTitle: "اختر منطقتك",
    waitingConfirm: "في انتظار تأكيد المسؤول...",
    pharmacyPortalTab: "مخزوني",
    noScheduleAdded: "لم يُضَف جدول بعد",
    scheduleTitle: "جدول الدوام",
    appDescription: "خدمة صحية متكاملة",
  },
  fr: {
    appName: "DEWAYA",
    appNameSub: "أدْواَيَ",
    appTagline: "La pharmacie la plus proche",
    nearestPharmacy: "Pharmacie la plus proche",
    nearestPharmacyDesc: "Trouvez la pharmacie la plus proche de vous",
    searchDrug: "Chercher un médicament",
    searchDrugDesc: "Par nom ou en photographiant la boîte",
    drugPrice: "Prix du médicament",
    drugPriceDesc: "Consultez rapidement le prix de votre médicament",
    dutyPharmacies: "Pharmacies de garde",
    dutyPharmaciesDesc: "Pharmacies de permanence dans votre zone",
    dutyAndPrice: "Garde & Prix des médicaments",
    dutyAndPriceDesc: "Tableaux de permanence et base de données des prix",
    findDoctor: "Soins infirmiers à domicile",
    findDoctorDesc: "Demander un infirmier ou une aide soignante",
    otherServices: "Autres services",
    otherServicesDesc: "Prix médicaments & plus",
    regionLabel: "Votre région",
    regionPlaceholder: "Sélectionnez votre région...",
    detectLocation: "Ma position",
    locationDetecting: "Localisation...",
    locationError: "Impossible de détecter la position",
    selectRegion: "Choisir la région",
    comingSoon: "Bientôt disponible",
    comingSoonMsg: "Ce service sera disponible prochainement",
    searchTitle: "Rechercher un médicament",
    searchPlaceholder: "Entrez le nom du médicament...",
    searchButton: "Envoyer la demande",
    orText: "OU",
    uploadImage: "Photographier la boîte",
    imageDrug: "Image de médicament",
    requestSent: "Demande envoyée",
    requestSentSubtitle: "Surveillez vos notifications, nous vous préviendrons dès que le médicament est trouvé",
    newSearch: "Nouvelle recherche",
    notifications: "Notifications",
    noNotifications: "Aucune notification pour l'instant",
    noNotificationsSubtitle: "Recherchez un médicament pour recevoir des notifications",
    lockedNotification: "Appuyez pour débloquer — 50 MRU",
    unlockFor: "Débloquer — 50 MRU",
    pharmacyFound: "Pharmacie trouvée",
    pharmacyName: "Nom de la pharmacie",
    pharmacyAddress: "Adresse",
    pharmacyPhone: "Téléphone",
    adminPanel: "Panneau d'administration",
    pendingRequests: "Demandes en attente",
    noPendingRequests: "Aucune demande en attente",
    drugName: "Nom du médicament",
    requestTime: "Heure de la demande",
    respondToRequest: "Répondre à la demande",
    respondPlaceholder: "Nom de la pharmacie",
    addressPlaceholder: "Adresse complète",
    phonePlaceholder: "Numéro de téléphone",
    sendResponse: "Envoyer la réponse",
    cancel: "Annuler",
    changeLanguage: "عربي",
    home: "Accueil",
    admin: "Admin",
    close: "Fermer",
    responded: "Répondu",
    pending: "En attente",
    paymentInfo: "Pour débloquer cette notification, envoyez 50 MRU via le moyen de paiement ci-dessous",
    payNow: "Payer maintenant — 50 MRU",
    loading: "Chargement...",
    error: "Une erreur s'est produite, réessayez",
    retry: "Réessayer",
    user: "Utilisateur",
    requestedBy: "Demandé par",
    unlock: "Débloquer",
    locked: "Verrouillé • 50 MRU",
    newNotification: "Nouvelle notification",
    requestId: "N° de demande",
    notifAlertTitle: "🔔 Nouvelle notification !",
    notifAlertBody: "Le médicament recherché a été trouvé. Appuyez pour voir les détails.",
    notifUnlockedTitle: "✅ Notification débloquée",
    notifUnlockedBody: "Vous pouvez maintenant consulter les détails de la pharmacie.",
    directionsLabel: "Itinéraire",
    locatingLabel: "Localisation en cours...",
    locationDetectedLabel: "Position détectée • Triées par distance",
    noPharmaciesRegion: "Aucune pharmacie enregistrée dans votre région",
    contactToAdd: "Contactez-nous pour référencer votre pharmacie",
    selectRegionTitle: "Choisissez votre région",
    waitingConfirm: "En attente de confirmation...",
    pharmacyPortalTab: "Mon stock",
    noScheduleAdded: "Aucun horaire disponible",
    scheduleTitle: "Horaires de consultation",
    appDescription: "Service de santé complet",
  },
};

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

/* Polling interval — 15s instead of 6s to save battery & network */
const POLL_INTERVAL_MS = 15_000;
/* Delay before first poll — let the UI settle first */
const POLL_STARTUP_DELAY_MS = 3_000;

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  /* expo-notifications may not be available on all platforms/configs */
}

const AppContext = createContext<AppContextType | null>(null);

async function requestNotificationPermissions() {
  if (Platform.OS === "web") return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing !== "granted") {
      await Notifications.requestPermissionsAsync();
    }
  } catch {}
}

async function fireLocalNotification(title: string, body: string, count: number) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        badge: count,
        data: { screen: "notifications" },
      },
      trigger: null,
    });
  } catch {}
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageSt] = useState<Language>("ar");
  const [userId, setUserId] = useState<string>("");
  const [lockedCount, setLockedCount] = useState(0);
  const [region, setRegionSt] = useState<Region | null>(null);
  const [isAdmin, setIsAdminSt] = useState(false);

  const knownIdsRef = useRef<Set<string>>(new Set());
  const knownUnlockedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const softSoundRef = useRef<Audio.Sound | null>(null);
  const languageRef = useRef<Language>(language);
  languageRef.current = language;

  /* ── Load sound AFTER interactions settle — non-blocking ── */
  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(async () => {
      if (cancelled) return;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
        const { sound } = await Audio.Sound.createAsync(
          require("../assets/sounds/bell-soft.mp3"),
          { volume: 0.55, shouldPlay: false }
        );
        if (!cancelled) {
          softSoundRef.current = sound;
        } else {
          sound.unloadAsync();
        }
      } catch {}
    });

    return () => {
      cancelled = true;
      task.cancel();
      softSoundRef.current?.unloadAsync().catch(() => {});
      softSoundRef.current = null;
    };
  }, []);

  const playSoftBell = async () => {
    if (!softSoundRef.current) return;
    try {
      await softSoundRef.current.setPositionAsync(0);
      await softSoundRef.current.playAsync();
    } catch {}
  };

  /* ── Batch-load all stored prefs in ONE AsyncStorage call ── */
  useEffect(() => {
    let cancelled = false;

    AsyncStorage.multiGet(["language", "userId", "isAdmin"])
      .then(async (pairs) => {
        if (cancelled) return;

        const langVal   = pairs[0][1];
        const userIdVal = pairs[1][1];
        const adminVal  = pairs[2][1];

        if (langVal === "ar" || langVal === "fr") setLanguageSt(langVal as Language);
        if (adminVal === "true") setIsAdminSt(true);

        let uid = userIdVal;
        if (!uid) {
          uid = "user_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
          await AsyncStorage.setItem("userId", uid);
        }
        if (!cancelled) setUserId(uid);

        /* Request permissions after prefs are loaded */
        requestNotificationPermissions();
      })
      .catch(() => {
        /* Fallback: generate userId if storage fails */
        if (!cancelled) {
          const uid = "user_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
          setUserId(uid);
        }
      });

    return () => { cancelled = true; };
  }, []);

  /* ── Notification polling — starts after delay, pauses in background ── */
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled || appStateRef.current === "background") return;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(`${API_BASE}/notifications/${userId}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!resp.ok || cancelled) return;

        const notifs: Array<{
          id: string;
          isLocked: boolean;
          isRead: boolean;
          paymentPending: boolean;
        }> = await resp.json();

        if (cancelled) return;

        const newCount = notifs.filter((n) => !n.isLocked && !n.isRead).length;
        setLockedCount(newCount);

        /* Only update badge on native */
        if (Platform.OS !== "web") {
          Notifications.setBadgeCountAsync(newCount).catch(() => {});
        }

        for (const n of notifs) {
          if (!knownIdsRef.current.has(n.id)) {
            knownIdsRef.current.add(n.id);
            if (n.isLocked) {
              if (Platform.OS !== "web") {
                Vibration.vibrate([0, 400, 200, 400, 200, 400]);
              }
              playSoftBell();
              fireLocalNotification(
                translations[languageRef.current].notifAlertTitle,
                translations[languageRef.current].notifAlertBody,
                newCount
              );
            }
          }
          if (!knownUnlockedRef.current.has(n.id) && !n.isLocked && knownIdsRef.current.has(n.id)) {
            knownUnlockedRef.current.add(n.id);
            if (Platform.OS !== "web") {
              Vibration.vibrate([0, 300, 100, 300]);
            }
            playSoftBell();
            fireLocalNotification(
              translations[languageRef.current].notifUnlockedTitle,
              translations[languageRef.current].notifUnlockedBody,
              Math.max(0, newCount - 1)
            );
          }
        }
      } catch {
        /* Network errors are silent */
      }
    };

    /* Delay first poll so the home screen renders before network activity */
    const startDelay = setTimeout(() => {
      if (cancelled) return;
      poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    }, POLL_STARTUP_DELAY_MS);

    const sub = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;
      if (state === "active" && intervalRef.current) poll();
    });

    return () => {
      cancelled = true;
      clearTimeout(startDelay);
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [userId]);

  const setLanguage = async (lang: Language) => {
    setLanguageSt(lang);
    AsyncStorage.setItem("language", lang).catch(() => {});
  };

  const setRegion = (r: Region | null) => setRegionSt(r);

  /* ── Register admin push token when admin logs in ── */
  useEffect(() => {
    if (!isAdmin || Platform.OS === "web") return;
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") return;
        const tokenData = await Notifications.getExpoPushTokenAsync();
        if (cancelled) return;
        await fetch(`${API_BASE}/notifications/admin/register-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tokenData.data }),
        });
      } catch {
        /* non-critical */
      }
    })();

    return () => { cancelled = true; };
  }, [isAdmin]);

  const setIsAdmin = async (v: boolean) => {
    setIsAdminSt(v);
    await AsyncStorage.setItem("isAdmin", v ? "true" : "false");
  };

  const adminLogout = async () => {
    setIsAdminSt(false);
    await AsyncStorage.setItem("isAdmin", "false");
  };

  const t = (key: string) => translations[language][key] ?? key;

  return (
    <AppContext.Provider
      value={{ language, setLanguage, userId, t, lockedCount, region, setRegion, isAdmin, setIsAdmin, adminLogout }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
