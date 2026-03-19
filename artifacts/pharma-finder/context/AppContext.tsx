import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Vibration, Platform, AppState } from "react-native";
import * as Notifications from "expo-notifications";
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
    appTagline: "أقرب صيدلية إليك",

    nearestPharmacy: "أقرب صيدلية",
    nearestPharmacyDesc: "ابحث عن الصيدلية الأقرب إليك",
    searchDrug: "أبحث عن دواء",
    searchDrugDesc: "ابحث بالاسم أو صوّر العلبة",
    drugPrice: "سعر الدواء",
    drugPriceDesc: "تعرف على سعر دوائك",
    dutyPharmacies: "صيدليات المداومة",
    dutyPharmaciesDesc: "الصيدليات المفتوحة في منطقتك",
    dutyAndPrice: "صيدليات المداومة وسعر الدواء",
    dutyAndPriceDesc: "جداول المداومة وقاعدة بيانات الأسعار",
    findDoctor: "جِدْ طبيبك",
    findDoctorDesc: "أطباء، مصحات، ومستشفيات",

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
    uploadImage: "تصوير العلبة",
    requestSent: "تم إرسال طلبكم",
    requestSentSubtitle: "راقب الإشعارات، سنُعلمك فور العثور على الدواء",
    newSearch: "بحث جديد",
    notifications: "الإشعارات",
    noNotifications: "لا توجد إشعارات بعد",
    noNotificationsSubtitle: "ابحث عن دواء لتلقّي إشعارات",
    lockedNotification: "اضغط لفتح الإشعار مقابل 10 MRU",
    unlockFor: "فتح مقابل 10 MRU",
    pharmacyFound: "تم العثور على صيدلية",
    pharmacyName: "اسم الصيدلية",
    pharmacyAddress: "العنوان",
    pharmacyPhone: "الهاتف",
    adminPanel: "لوحة الإدارة",
    pendingRequests: "الطلبات المعلقة",
    noPendingRequests: "لا توجد طلبات معلقة",
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
    paymentInfo: "لفتح هذا الإشعار، يُرجى دفع رسوم الخدمة البسيطة وقدرها 10 MRU فقط",
    payNow: "ادفع الآن - 10 MRU",
    loading: "جارٍ التحميل...",
    error: "حدث خطأ",
    retry: "إعادة المحاولة",
    user: "مستخدم",
    requestedBy: "طلب بواسطة",
    unlock: "فتح",
    locked: "مقفل • 10 MRU",
    newNotification: "إشعار جديد",
    requestId: "رقم الطلب",
    notifAlertTitle: "🔔 وصل إشعار جديد!",
    notifAlertBody: "تم العثور على الدواء الذي بحثت عنه. اضغط للتفاصيل.",
    notifUnlockedTitle: "✅ تم فتح الإشعار",
    notifUnlockedBody: "يمكنك الآن رؤية تفاصيل الصيدلية.",
  },
  fr: {
    appName: "DEWAYA",
    appNameSub: "أدْواَيَ",
    appTagline: "La pharmacie la plus proche",

    nearestPharmacy: "Pharmacie proche",
    nearestPharmacyDesc: "Trouvez la pharmacie la plus proche",
    searchDrug: "Chercher un médicament",
    searchDrugDesc: "Par nom ou photo de la boîte",
    drugPrice: "Prix du médicament",
    drugPriceDesc: "Connaître le prix de votre médicament",
    dutyPharmacies: "Pharmacies de garde",
    dutyPharmaciesDesc: "Pharmacies ouvertes dans votre zone",
    dutyAndPrice: "Garde & Prix médicaments",
    dutyAndPriceDesc: "Tableaux de garde et base de données des prix",
    findDoctor: "Trouvez votre médecin",
    findDoctorDesc: "Médecins, cliniques, hôpitaux",

    regionLabel: "Votre région",
    regionPlaceholder: "Sélectionnez votre région...",
    detectLocation: "Ma position",
    locationDetecting: "Détection...",
    locationError: "Impossible de détecter",
    selectRegion: "Choisir la région",
    comingSoon: "Bientôt disponible",
    comingSoonMsg: "Ce service sera bientôt disponible",

    searchTitle: "Rechercher un médicament",
    searchPlaceholder: "Entrez le nom du médicament...",
    searchButton: "Envoyer la demande",
    orText: "OU",
    uploadImage: "Photographier la boîte",
    requestSent: "Demande envoyée",
    requestSentSubtitle: "Surveillez vos notifications, nous vous informerons dès que le médicament est trouvé",
    newSearch: "Nouvelle recherche",
    notifications: "Notifications",
    noNotifications: "Aucune notification pour l'instant",
    noNotificationsSubtitle: "Recherchez un médicament pour recevoir des notifications",
    lockedNotification: "Appuyez pour débloquer pour 10 MRU",
    unlockFor: "Débloquer pour 10 MRU",
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
    paymentInfo: "Pour débloquer cette notification, veuillez payer les frais de service modiques de 10 MRU seulement",
    payNow: "Payer maintenant - 10 MRU",
    loading: "Chargement...",
    error: "Une erreur s'est produite",
    retry: "Réessayer",
    user: "Utilisateur",
    requestedBy: "Demandé par",
    unlock: "Débloquer",
    locked: "Verrouillé • 10 MRU",
    newNotification: "Nouvelle notification",
    requestId: "ID de la demande",
    notifAlertTitle: "🔔 Nouvelle notification !",
    notifAlertBody: "Le médicament recherché a été trouvé. Appuyez pour les détails.",
    notifUnlockedTitle: "✅ Notification débloquée",
    notifUnlockedBody: "Vous pouvez maintenant voir les détails de la pharmacie.",
  },
};

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const AppContext = createContext<AppContextType | null>(null);

async function requestNotificationPermissions() {
  if (Platform.OS === "web") return;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
}

async function fireLocalNotification(title: string, body: string, lockedCount: number) {
  if (Platform.OS === "web") return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      badge: lockedCount,
      data: { screen: "notifications" },
    },
    trigger: null,
  });
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

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("language");
      if (saved === "ar" || saved === "fr") setLanguageSt(saved as Language);

      let uid = await AsyncStorage.getItem("userId");
      if (!uid) {
        uid = "user_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
        await AsyncStorage.setItem("userId", uid);
      }
      setUserId(uid);

      const adminSaved = await AsyncStorage.getItem("isAdmin");
      if (adminSaved === "true") setIsAdminSt(true);

      await requestNotificationPermissions();
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const poll = async () => {
      try {
        const resp = await fetch(`${API_BASE}/notifications/${userId}`);
        if (!resp.ok) return;
        const notifs: Array<{
          id: string;
          isLocked: boolean;
          isRead: boolean;
          paymentPending: boolean;
        }> = await resp.json();

        const locked = notifs.filter((n) => n.isLocked);
        setLockedCount(locked.length);

        await Notifications.setBadgeCountAsync(locked.length);

        for (const n of notifs) {
          if (!knownIdsRef.current.has(n.id)) {
            knownIdsRef.current.add(n.id);
            if (n.isLocked) {
              if (Platform.OS !== "web") {
                Vibration.vibrate([0, 400, 200, 400, 200, 400]);
              }
              await fireLocalNotification(
                translations[language].notifAlertTitle,
                translations[language].notifAlertBody,
                locked.length
              );
            }
          }
          if (knownUnlockedRef.current.has(n.id) && !n.isLocked) {
          } else if (!knownUnlockedRef.current.has(n.id) && !n.isLocked && knownIdsRef.current.has(n.id)) {
            knownUnlockedRef.current.add(n.id);
          }
          const wasLocked = !knownUnlockedRef.current.has(n.id);
          if (wasLocked && !n.isLocked && knownIdsRef.current.has(n.id)) {
            knownUnlockedRef.current.add(n.id);
            if (Platform.OS !== "web") {
              Vibration.vibrate([0, 300, 100, 300]);
            }
            await fireLocalNotification(
              translations[language].notifUnlockedTitle,
              translations[language].notifUnlockedBody,
              Math.max(0, locked.length - 1)
            );
          }
        }
      } catch {
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 6000);

    const sub = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;
      if (state === "active") poll();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [userId, language]);

  const setLanguage = async (lang: Language) => {
    setLanguageSt(lang);
    await AsyncStorage.setItem("language", lang);
  };

  const setRegion = (r: Region | null) => setRegionSt(r);

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
    <AppContext.Provider value={{ language, setLanguage, userId, t, lockedCount, region, setRegion, isAdmin, setIsAdmin, adminLogout }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
