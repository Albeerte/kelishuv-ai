import uz from "@/locales/uz.json";
import uzCyrl from "@/locales/uz-Cyrl.json";
import ru from "@/locales/ru.json";
import type { Locale } from "./kelishuv-types";
import { toModernUzbek, toTraditionalUzbek } from "./uzbek-alphabet";

const dictionaries: Record<Locale, Record<string, string>> = {
  uz,
  "uz-Cyrl": uzCyrl,
  ru,
};

export function localeText(text: string, locale: Locale): string {
  const key = text.replace(/\s+/g, " ").trim();
  const translated = dictionaries[locale][key] || dictionaries[locale][toTraditionalUzbek(key)];
  const result = translated ? (
    (text.match(/^\s*/)?.[0] || "") +
    translated +
    (text.match(/\s*$/)?.[0] || "")
  ) : text;
  return locale === "uz" ? toModernUzbek(result) : result;
}
