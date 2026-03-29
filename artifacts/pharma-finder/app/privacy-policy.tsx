import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const isRTL = language === "ar";
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [tab, setTab] = useState<"privacy" | "terms">("privacy");

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>{title}</Text>
      {children}
    </View>
  );

  const Paragraph = ({ text }: { text: string }) => (
    <Text style={[styles.paragraph, isRTL && styles.rtl]}>{text}</Text>
  );

  const Bullet = ({ text }: { text: string }) => (
    <View style={[styles.bulletRow, isRTL && styles.rtlRow]}>
      <Text style={styles.dot}>{isRTL ? "•" : "•"}</Text>
      <Text style={[styles.bulletText, isRTL && styles.rtl]}>{text}</Text>
    </View>
  );

  const privacyAr = (
    <>
      <Section title="مقدمة">
        <Paragraph text="تطبيق أدْوَايَ (DEWAYA) ملتزم بحماية خصوصية مستخدميه. توضح هذه السياسة كيفية جمع معلوماتك واستخدامها وحمايتها." />
      </Section>
      <Section title="المعلومات التي نجمعها">
        <Bullet text="رقم الهاتف: يُستخدم فقط لإعلامك بنتائج بحثك عن الدواء." />
        <Bullet text="اسم الدواء أو صورة العلبة: لإيجاد الدواء المطلوب لدى الصيدليات." />
        <Bullet text="منطقتك الجغرافية: لتحديد الصيدليات الأقرب إليك." />
        <Bullet text="موقعك (إذا أذنت): لعرض الصيدليات الأقرب إليك فحسب." />
        <Bullet text="معرف جهاز مجهول الهوية: لربط إشعاراتك دون تسجيل حساب." />
      </Section>
      <Section title="كيف نستخدم معلوماتك">
        <Bullet text="البحث عن الدواء لدى الصيدليات الشريكة وإبلاغك بالنتائج." />
        <Bullet text="توجيه طلبات التمريض المنزلي إلى الممرضين المسجلين." />
        <Bullet text="إرسال إشعارات داخل التطبيق بنتائج بحثك." />
        <Bullet text="لا نبيع بياناتك ولا نشاركها مع أطراف ثالثة لأغراض تجارية." />
      </Section>
      <Section title="الاحتفاظ بالبيانات">
        <Paragraph text="تُحفظ الطلبات لمدة أقصاها 30 يوماً ثم تُحذف تلقائياً. رقم هاتفك لا يُخزَّن لأغراض تسويقية." />
      </Section>
      <Section title="أمان البيانات">
        <Paragraph text="تنتقل بياناتك عبر اتصال مشفر (HTTPS). نحن لا نحفظ كلمات مرور ولا بيانات دفع بشكل مباشر. عمليات الدفع تتم عبر شبكات بنكيلي/مصرفي المستقلة." />
      </Section>
      <Section title="حقوقك">
        <Bullet text="يمكنك حذف إشعاراتك في أي وقت من داخل التطبيق." />
        <Bullet text="يمكنك سحب إذن الموقع من إعدادات هاتفك." />
        <Bullet text="للاستفسارات: vadel466@gmail.com" />
      </Section>
      <Section title="التحديثات">
        <Paragraph text="قد تتغير هذه السياسة. سنُبلغك بأي تغيير جوهري عبر التطبيق. آخر تحديث: مارس 2026." />
      </Section>
    </>
  );

  const privacyFr = (
    <>
      <Section title="Introduction">
        <Paragraph text="L'application أدْوَايَ (DEWAYA) s'engage à protéger la vie privée de ses utilisateurs. Cette politique explique comment vos informations sont collectées, utilisées et protégées." />
      </Section>
      <Section title="Informations collectées">
        <Bullet text="Numéro de téléphone : utilisé uniquement pour vous informer des résultats de votre recherche." />
        <Bullet text="Nom du médicament ou photo de la boîte : pour localiser le médicament dans les pharmacies partenaires." />
        <Bullet text="Votre région : pour identifier les pharmacies les plus proches." />
        <Bullet text="Votre localisation (si autorisée) : uniquement pour afficher les pharmacies proches." />
        <Bullet text="Identifiant anonyme de l'appareil : pour relier vos notifications sans création de compte." />
      </Section>
      <Section title="Utilisation de vos données">
        <Bullet text="Recherche du médicament auprès des pharmacies partenaires et notification des résultats." />
        <Bullet text="Transmission des demandes de soins à domicile aux infirmiers enregistrés." />
        <Bullet text="Envoi de notifications internes sur les résultats de votre recherche." />
        <Bullet text="Nous ne vendons ni ne partageons vos données avec des tiers à des fins commerciales." />
      </Section>
      <Section title="Conservation des données">
        <Paragraph text="Les demandes sont conservées pendant 30 jours maximum, puis supprimées automatiquement. Votre numéro de téléphone n'est pas stocké à des fins marketing." />
      </Section>
      <Section title="Sécurité">
        <Paragraph text="Vos données transitent via une connexion chiffrée (HTTPS). Nous ne stockons ni mots de passe ni données de paiement directement. Les paiements s'effectuent via les réseaux indépendants Bankily/Masrafi." />
      </Section>
      <Section title="Vos droits">
        <Bullet text="Vous pouvez supprimer vos notifications à tout moment depuis l'application." />
        <Bullet text="Vous pouvez révoquer l'accès à la localisation depuis les paramètres de votre téléphone." />
        <Bullet text="Contact : vadel466@gmail.com" />
      </Section>
    </>
  );

  const termsAr = (
    <>
      <Section title="قبول الشروط">
        <Paragraph text="باستخدام تطبيق أدْوَايَ، فإنك تقبل هذه الشروط. إذا كنت لا توافق عليها، يُرجى التوقف عن استخدام التطبيق." />
      </Section>
      <Section title="طبيعة الخدمة">
        <Paragraph text="أدْوَايَ خدمة بحثية بشرية تعمل على ربط المستخدمين بالصيدليات. نحن لسنا صيدلية ولا نبيع أدوية مباشرة. نتائج البحث تُقدَّم كمعلومات استرشادية فحسب." />
      </Section>
      <Section title="رسوم الخدمة">
        <Bullet text="رسوم البحث عن الدواء: 50 أوقية موريتانية جديدة لفتح نتائج البحث." />
        <Bullet text="رسوم طلب ممرض: 100 أوقية موريتانية جديدة." />
        <Bullet text="الدفع عبر شبكات بنكيلي أو مصرفي الموريتاني." />
        <Bullet text="لا يُضمن استرداد الرسوم في حال عدم توفر الدواء، لأن الخدمة بحثية لا ضمان فيها." />
      </Section>
      <Section title="الاستخدام المقبول">
        <Bullet text="الاستخدام الشخصي فحسب، وليس لإعادة البيع." />
        <Bullet text="عدم إرسال طلبات وهمية أو مزيفة." />
        <Bullet text="عدم إساءة استخدام منصة الصيدليات أو منصة الممرضين." />
      </Section>
      <Section title="المسؤولية">
        <Paragraph text="أدْوَايَ غير مسؤولة عن جودة الأدوية أو المنتجات التي تقدمها الصيدليات. نحن وسيط معلوماتي فحسب. يبقى قرار الشراء مسؤولية المستخدم الكاملة." />
      </Section>
      <Section title="إنهاء الخدمة">
        <Paragraph text="نحتفظ بحق تعليق أي حساب يُسيء استخدام الخدمة. تحديث: مارس 2026." />
      </Section>
    </>
  );

  const termsFr = (
    <>
      <Section title="Acceptation des conditions">
        <Paragraph text="En utilisant l'application أدْوَايَ, vous acceptez ces conditions. Si vous n'êtes pas d'accord, veuillez cesser d'utiliser l'application." />
      </Section>
      <Section title="Nature du service">
        <Paragraph text="أدْوَايَ est un service de recherche humaine mettant en relation les utilisateurs avec les pharmacies. Nous ne sommes pas une pharmacie et ne vendons pas de médicaments directement. Les résultats sont fournis à titre indicatif uniquement." />
      </Section>
      <Section title="Frais du service">
        <Bullet text="Recherche de médicament : 50 MRU pour débloquer les résultats." />
        <Bullet text="Demande d'infirmier à domicile : 100 MRU." />
        <Bullet text="Paiement via Bankily ou Masrafi." />
        <Bullet text="Le remboursement n'est pas garanti si le médicament est introuvable." />
      </Section>
      <Section title="Utilisation acceptable">
        <Bullet text="Usage personnel uniquement, pas de revente." />
        <Bullet text="Ne pas soumettre de demandes fictives ou frauduleuses." />
        <Bullet text="Ne pas abuser du portail pharmacies ou infirmiers." />
      </Section>
      <Section title="Responsabilité">
        <Paragraph text="أدْوَايَ n'est pas responsable de la qualité des médicaments fournis par les pharmacies. Nous sommes uniquement un intermédiaire informatif. La décision d'achat relève entièrement de l'utilisateur." />
      </Section>
    </>
  );

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRTL && styles.rtl]}>
          {isRTL ? "الخصوصية والشروط" : "Confidentialité & Conditions"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.tabRow, isRTL && styles.rtlRow]}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "privacy" && styles.tabBtnActive]}
          onPress={() => setTab("privacy")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === "privacy" && styles.tabTextActive]}>
            {isRTL ? "سياسة الخصوصية" : "Confidentialité"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "terms" && styles.tabBtnActive]}
          onPress={() => setTab("terms")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === "terms" && styles.tabTextActive]}>
            {isRTL ? "شروط الاستخدام" : "Conditions d'utilisation"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.updated, isRTL && styles.rtl]}>
          {isRTL ? "آخر تحديث: مارس 2026" : "Dernière mise à jour : mars 2026"}
        </Text>

        {tab === "privacy" ? (isRTL ? privacyAr : privacyFr) : (isRTL ? termsAr : termsFr)}

        <View style={styles.footer}>
          <Ionicons name="mail-outline" size={14} color="#90A4AE" />
          <Text style={styles.footerText}>vadel466@gmail.com</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0F4F8" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEF2F7",
  },
  rtlRow: { flexDirection: "row-reverse" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1A237E", flex: 1, textAlign: "center" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
  tabRow: {
    flexDirection: "row", backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#EEF2F7",
    paddingHorizontal: 16, gap: 8,
  },
  tabBtn: {
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: "#1A237E" },
  tabText: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#90A4AE" },
  tabTextActive: { color: "#1A237E", fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 48 },
  updated: { fontFamily: "Inter_400Regular", fontSize: 11, color: "#90A4AE", marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontFamily: "Inter_700Bold", fontSize: 15, color: "#1A237E",
    marginBottom: 8,
  },
  paragraph: { fontFamily: "Inter_400Regular", fontSize: 13.5, color: "#455A64", lineHeight: 22 },
  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 6, alignItems: "flex-start" },
  dot: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#1A237E", lineHeight: 22 },
  bulletText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13.5, color: "#455A64", lineHeight: 22 },
  footer: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24, justifyContent: "center" },
  footerText: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#90A4AE" },
});
