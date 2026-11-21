import uz from "@/locales/uz.json";
import uzCyrl from "@/locales/uz-Cyrl.json";
import ru from "@/locales/ru.json";
import type { Locale } from "./kelishuv-types";

const dictionaries: Record<Locale, Record<string, string>> = {
  uz,
  "uz-Cyrl": uzCyrl,
  ru,
};

export function localeText(text: string, locale: Locale): string {
  const translated = dictionaries[locale][text.replace(/\s+/g, " ").trim()];
  if (!translated) return text;
  return (
    (text.match(/^\s*/)?.[0] || "") +
    translated +
    (text.match(/\s*$/)?.[0] || "")
  );
}
