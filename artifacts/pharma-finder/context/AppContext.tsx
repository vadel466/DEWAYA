import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Language = "ar" | "en";

type AppContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  userId: string;
  t: (key: string) => string;
};

const translations: Record<Language, Record<string, string>> = {
  ar: {
    appName: "صيدليتي",
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
    changeLanguage: "English",
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
  en: {
    appName: "Saydaliyati",
    appTagline: "Nearest Pharmacy to You",
    searchTitle: "Find a Medicine",
    searchPlaceholder: "Enter medicine name...",
    searchButton: "Search",
    orText: "OR",
    uploadImage: "Upload Package Photo",
    requestSent: "Request Submitted",
    requestSentSubtitle: "Watch your notifications — we'll notify you as soon as we find the medicine",
    newSearch: "New Search",
    notifications: "Notifications",
    noNotifications: "No notifications yet",
    noNotificationsSubtitle: "Search for a medicine to receive notifications",
    lockedNotification: "Tap to unlock for 1 MRU",
    unlockFor: "Unlock for 1 MRU",
    pharmacyFound: "Pharmacy Found",
    pharmacyName: "Pharmacy Name",
    pharmacyAddress: "Address",
    pharmacyPhone: "Phone",
    adminPanel: "Admin Panel",
    pendingRequests: "Pending Requests",
    noPendingRequests: "No pending requests",
    drugName: "Medicine Name",
    requestTime: "Request Time",
    respondToRequest: "Respond to Request",
    respondPlaceholder: "Pharmacy name",
    addressPlaceholder: "Full address",
    phonePlaceholder: "Phone number",
    sendResponse: "Send Response",
    cancel: "Cancel",
    changeLanguage: "عربي",
    home: "Home",
    admin: "Admin",
    close: "Close",
    responded: "Responded",
    pending: "Pending",
    paymentInfo: "To unlock this notification, please pay the small service fee of 1 MRU only",
    payNow: "Pay Now - 1 MRU",
    loading: "Loading...",
    error: "An error occurred",
    retry: "Retry",
    user: "User",
    requestedBy: "Requested by",
    unlock: "Unlock",
    locked: "Locked • 1 MRU",
    newNotification: "New Notification",
    requestId: "Request ID",
  },
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageSt] = useState<Language>("ar");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("language");
      if (saved === "ar" || saved === "en") setLanguageSt(saved);

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
