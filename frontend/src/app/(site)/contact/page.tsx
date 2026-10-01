import ContactForm from "@/components/ContactForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: `${t(locale, "nav.contact")} | Colección Reyes-Veray`,
    description: t(locale, "contact.metaDescription"),
  };
}

export default async function Contact() {
  return <ContactForm locale={await getLocale()} />;
}
