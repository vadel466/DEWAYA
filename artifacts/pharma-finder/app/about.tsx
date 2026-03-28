import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const VERSION = "1.0.0";
const EMAIL    = "vadel466@gmail.com";

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRTL && styles.rtl]}>
          {isRTL ? "عن دواية" : "À propos de Dewaya"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + App name */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <MaterialCommunityIcons name="pill" size={44} color={Colors.primary} />
          </View>
          <Text style={[styles.appName, isRTL && styles.rtl]}>أدْواَيَ — Dewaya</Text>
          <Text style={[styles.version, isRTL && styles.rtl]}>
            {isRTL ? `الإصدار ${VERSION}` : `Version ${VERSION}`}
          </Text>
        </View>

        {/* Initiative card */}
        <SectionCard icon="account-heart" color={Colors.primary}>
          <Text style={[styles.cardTitle, isRTL && styles.rtl]}>
            {isRTL ? "مبادرة شخصية" : "Initiative Personnelle"}
          </Text>
          <Text style={[styles.cardBody, isRTL && styles.rtl]}>
            {isRTL
              ? "دواية مبادرة شخصية لصالح المواطن الموريتاني، تُمكِّنك من معرفة السعر الرسمي للدواء، والعثور على أقرب صيدلية، ومتابعة صيدليات المداومة وطلب خدمة التمريض المنزلي — كل ذلك في مكان واحد."
              : "Dewaya est une initiative personnelle au service du citoyen mauritanien, vous permettant de connaître le prix officiel des médicaments, de trouver la pharmacie la plus proche, de suivre les pharmacies de garde et de demander des soins infirmiers à domicile — le tout en un seul endroit."}
          </Text>
        </SectionCard>

        {/* Pricing card */}
        <SectionCard icon="tag-heart-outline" color="#F59E0B">
          <Text style={[styles.cardTitle, isRTL && styles.rtl]}>
            {isRTL ? "خدمة شبه مجانية" : "Service Semi-Gratuit"}
          </Text>
          <Text style={[styles.cardBody, isRTL && styles.rtl]}>
            {isRTL
              ? "البحث عن أسعار الأدوية والعثور على الصيدليات مجاني تماماً. خدمة التمريض المنزلي رمزية لا تتجاوز 30 إلى 50 أوقية موريتانية، تُدفع مباشرةً لمزود الخدمة."
              : "La recherche de prix de médicaments et la localisation des pharmacies sont entièrement gratuites. Le service de soins infirmiers à domicile est symbolique — entre 30 et 50 MRU — payé directement au prestataire."}
          </Text>
          <View style={[styles.badge, { backgroundColor: "#FEF3C7" }]}>
            <MaterialCommunityIcons name="currency-usd-off" size={14} color="#92400E" />
            <Text style={[styles.badgeText, { color: "#92400E" }, isRTL && styles.rtl]}>
              {isRTL ? "البحث عن الأدوية والصيدليات: مجاني" : "Médicaments & pharmacies : gratuit"}
            </Text>
          </View>
        </SectionCard>

        {/* Data source card */}
        <SectionCard icon="shield-check" color="#059669">
          <Text style={[styles.cardTitle, isRTL && styles.rtl]}>
            {isRTL ? "مصدر البيانات" : "Source des données"}
          </Text>
          <Text style={[styles.cardBody, isRTL && styles.rtl]}>
            {isRTL
              ? "جميع أسعار الأدوية في هذا التطبيق مصدرها الرسمي وزارة الصحة الموريتانية (الريبرتوار الوطني للأدوية). هذه الأسعار موحَّدة ومعتمَدة قانونياً."
              : "Tous les prix des médicaments proviennent officiellement du Ministère de la Santé mauritanien (Répertoire National des Médicaments). Ces prix sont homologués et légalement opposables."}
          </Text>
          <View style={[styles.badge, { backgroundColor: "#D1FAE5" }]}>
            <MaterialCommunityIcons name="check-circle" size={14} color="#059669" />
            <Text style={[styles.badgeText, { color: "#059669" }, isRTL && styles.rtl]}>
              {isRTL ? "بيانات رسمية — وزارة الصحة الموريتانية" : "Données officielles — Ministère de la Santé"}
            </Text>
          </View>
        </SectionCard>

        {/* Offline card */}
        <SectionCard icon="cloud-off-outline" color="#7C3AED">
          <Text style={[styles.cardTitle, isRTL && styles.rtl]}>
            {isRTL ? "وضع بدون إنترنت" : "Mode hors connexion"}
          </Text>
          <Text style={[styles.cardBody, isRTL && styles.rtl]}>
            {isRTL
              ? "التطبيق يحفظ قاعدة بيانات الأدوية والصيدليات على هاتفك، ويمكنك البحث حتى بدون اتصال بالإنترنت. تُحدَّث البيانات تلقائياً كل 24 ساعة عند توفر الاتصال."
              : "L'application sauvegarde localement la base de données des médicaments et des pharmacies. Vous pouvez effectuer des recherches même sans connexion. Les données sont mises à jour automatiquement toutes les 24 heures."}
          </Text>
        </SectionCard>

        {/* Privacy Policy */}
        <SectionCard icon="lock-closed-outline" color="#0EA5E9">
          <Text style={[styles.cardTitle, isRTL && styles.rtl]}>
            {isRTL ? "سياسة الخصوصية" : "Politique de confidentialité"}
          </Text>
          <Text style={[styles.cardBody, isRTL && styles.rtl]}>
            {isRTL
              ? "لا نجمع أي بيانات شخصية تعريفية. في حال طلبت خدمة التمريض المنزلي صراحةً، تُشارَك معلومات الاتصال الخاصة بك فقط مع مزود الخدمة (الممرض المختص) لتنسيق الزيارة. لا تُشارَك أي بيانات مع أي طرف آخر."
              : "Nous ne collectons aucune donnée personnelle identifiable. Si vous demandez explicitement le service de soins infirmiers à domicile, vos coordonnées sont partagées uniquement avec le prestataire de soins (infirmier habilité) pour coordonner la visite. Aucune donnée n'est partagée avec un tiers quelconque."}
          </Text>
        </SectionCard>

        {/* Contact */}
        <SectionCard icon="mail-outline" color={Colors.warning}>
          <Text style={[styles.cardTitle, isRTL && styles.rtl]}>
            {isRTL ? "التواصل والاقتراحات" : "Contact & Suggestions"}
          </Text>
          <Text style={[styles.cardBody, isRTL && styles.rtl]}>
            {isRTL
              ? "للإبلاغ عن خطأ في البيانات، أو اقتراح تحسين، أو إدراج صيدليتك في الدليل، تواصل معنا عبر البريد الإلكتروني:"
              : "Pour signaler une erreur, proposer une amélioration ou référencer votre pharmacie, contactez-nous par e-mail :"}
          </Text>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => Linking.openURL(`mailto:${EMAIL}`)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="email" size={14} color={Colors.primary} />
            <Text style={[styles.linkText, isRTL && styles.rtl]}>{EMAIL}</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={[styles.disclaimerText, isRTL && styles.rtl]}>
            {isRTL
              ? "⚠️ هذا التطبيق للمعلومات فقط ولا يُغني عن استشارة الصيدلاني أو الطبيب المختص."
              : "⚠️ Cette application est à titre informatif uniquement et ne remplace pas l'avis d'un pharmacien ou médecin."}
          </Text>
        </View>

        {/* Footer */}
        <Text style={[styles.footer, isRTL && styles.rtl]}>
          {isRTL
            ? `© ${new Date().getFullYear()} دواية — موريتانيا`
            : `© ${new Date().getFullYear()} Dewaya — Mauritanie`}
        </Text>
      </ScrollView>
    </View>
  );
}

function SectionCard({ icon, color, children }: { icon: string; color: string; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={[styles.cardIcon, { backgroundColor: color + "18" }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      </View>
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  rtlRow: { flexDirection: "row-reverse" },
  rtl: { textAlign: "right", writingDirection: "rtl" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    flex: 1, fontFamily: "Inter_700Bold",
    fontSize: 17, color: Colors.light.text, textAlign: "center",
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  logoSection: { alignItems: "center", marginBottom: 24, marginTop: 8 },
  logoCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primary + "14",
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  appName: {
    fontFamily: "Inter_700Bold", fontSize: 22,
    color: Colors.light.text, textAlign: "center",
  },
  version: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: Colors.light.textSecondary, marginTop: 4, textAlign: "center",
  },

  card: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    backgroundColor: Colors.light.card,
    borderRadius: 14, padding: 14, marginBottom: 12,
    borderLeftWidth: 4, borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  cardContent: { flex: 1, gap: 6 },
  cardTitle: {
    fontFamily: "Inter_700Bold", fontSize: 14.5,
    color: Colors.light.text,
  },
  cardBody: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: Colors.light.textSecondary, lineHeight: 20,
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, alignSelf: "flex-start",
  },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11.5 },
  linkBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 4, alignSelf: "flex-start",
  },
  linkText: {
    fontFamily: "Inter_600SemiBold", fontSize: 13,
    color: Colors.primary, textDecorationLine: "underline",
  },

  disclaimer: {
    backgroundColor: "#FEF9EE",
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.warning + "40",
    marginBottom: 16,
  },
  disclaimerText: {
    fontFamily: "Inter_400Regular", fontSize: 12.5,
    color: "#78350F", lineHeight: 19, textAlign: "center",
  },
  footer: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: Colors.light.textTertiary, textAlign: "center",
  },
});
