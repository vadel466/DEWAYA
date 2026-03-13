import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Language = "ar" | "fr";

type AppContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  userId: string;
  t: (key: string) => string;
};

const translations: Record<Language, Record<string, string>> = {
  ar: {
    appName: "أدْواَيَ",
    appNameSub: "DEWAYA",
    appTagline: "أقرب صيدلية إليك",
    searchTitle: "البحث عن دواء",
    searchPlaceholder: "أدخل اسم الدواء...",
    searchButton: "بحث",
    orText: "أو",
    uploadImage: "رفع صورة العلبة",
    requestSent: "تم إرسال طلبكم",
    requestSentSubtitle: "راقب الإشعارات، سنُعلمك فور العثور على الدواء",
    newSearch: "بحث جديد",
    notifications: "الإشعارات",
    noNotifications: "لا توجد إشعارات بعد",
    noNotificationsSubtitle: "ابحث عن دواء لتلقّي إشعارات",
    lockedNotification: "اضغط لفتح الإشعار مقابل 1 MRU",
    unlockFor: "فتح مقابل 1 MRU",
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
    paymentInfo: "لفتح هذا الإشعار، يُرجى دفع رسوم الخدمة البسيطة وقدرها 1 MRU فقط",
    payNow: "ادفع الآن - 1 MRU",
    loading: "جارٍ التحميل...",
    error: "حدث خطأ",
    retry: "إعادة المحاولة",
    user: "مستخدم",
    requestedBy: "طلب بواسطة",
    unlock: "فتح",
    locked: "مقفل • 1 MRU",
    newNotification: "إشعار جديد",
    requestId: "رقم الطلب",
  },
  fr: {
    appName: "DEWAYA",
    appNameSub: "أدْواَيَ",
    appTagline: "La pharmacie la plus proche",
    searchTitle: "Rechercher un médicament",
    searchPlaceholder: "Entrez le nom du médicament...",
    searchButton: "Rechercher",
    orText: "OU",
    uploadImage: "Importer une photo de la boîte",
    requestSent: "Demande envoyée",
    requestSentSubtitle: "Surveillez vos notifications, nous vous informerons dès que le médicament est trouvé",
    newSearch: "Nouvelle recherche",
    notifications: "Notifications",
    noNotifications: "Aucune notification pour l'instant",
    noNotificationsSubtitle: "Recherchez un médicament pour recevoir des notifications",
    lockedNotification: "Appuyez pour débloquer pour 1 MRU",
    unlockFor: "Débloquer pour 1 MRU",
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
    paymentInfo: "Pour débloquer cette notification, veuillez payer les frais de service modiques de 1 MRU seulement",
    payNow: "Payer maintenant - 1 MRU",
    loading: "Chargement...",
    error: "Une erreur s'est produite",
    retry: "Réessayer",
    user: "Utilisateur",
    requestedBy: "Demandé par",
    unlock: "Débloquer",
    locked: "Verrouillé • 1 MRU",
    newNotification: "Nouvelle notification",
    requestId: "ID de la demande",
  },
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageSt] = useState<Language>("ar");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("language");
      if (saved === "ar" || saved === "fr") setLanguageSt(saved);

      let uid = await AsyncStorage.getItem("userId");
      if (!uid) {
        uid = "user_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
        await AsyncStorage.setItem("userId", uid);
      }
      setUserId(uid);
    })();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageSt(lang);
    await AsyncStorage.setItem("language", lang);
  };

  const t = (key: string) => translations[language][key] ?? key;

  return (
    <AppContext.Provider value={{ language, setLanguage, userId, t }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
