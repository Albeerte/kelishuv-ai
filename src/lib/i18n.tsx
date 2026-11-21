import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  type ReactNode,
  type ReactElement,
} from "react";
import { create } from "zustand";
import { localeText } from "./locale-text";

export type Locale = "uz" | "uz-Cyrl" | "ru";
const useLocaleStore = create<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>((set) => ({
  locale: "uz",
  setLocale(locale) {
    set({ locale });
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kelishuv-locale", locale);
      document.cookie = `kelishuv-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      document.documentElement.lang = locale;
    }
  },
}));
let initialized = false;

export function translate(
  text: string,
  locale: Locale = useLocaleStore.getState().locale,
): string {
  if (!text || typeof text !== "string") return text;
  return localeText(text, locale);
}

export function useI18n() {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  useEffect(() => {
    if (initialized) return;
    initialized = true;
    const stored =
      window.localStorage.getItem("kelishuv-locale") ||
      document.cookie.match(/(?:^|; )kelishuv-locale=([^;]+)/)?.[1];
    if (stored === "uz" || stored === "uz-Cyrl" || stored === "ru")
      setLocale(stored);
  }, [setLocale]);
  const t = useCallback((text: string) => translate(text, locale), [locale]);
  return { locale, setLocale, t };
}

export function translateChildren(
  children: ReactNode,
  locale?: Locale,
): ReactNode {
  if (typeof children === "string") return translate(children, locale);
  if (Array.isArray(children))
    return Children.map(children, (child) => translateChildren(child, locale));
  if (isValidElement(children)) {
    const element = children as ReactElement<{ children?: ReactNode }>;
    if (element.props.children !== undefined)
      return cloneElement(
        element,
        {},
        translateChildren(element.props.children, locale),
      );
  }
  return children;
}

export function T({ text, children }: { text?: string; children?: ReactNode }) {
  const { locale } = useI18n();
  return (
    <>
      {text !== undefined
        ? translate(text, locale)
        : translateChildren(children, locale)}
    </>
  );
}

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="locale-switch">
      <span className="sr-only">{t("Interfeys tili")}</span>
      <select
        value={locale}
        aria-label={t("Interfeys tili")}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        <option value="uz">Özbekça</option>
        <option value="uz-Cyrl">Ўзбекча</option>
        <option value="ru">Русский</option>
      </select>
    </label>
  );
}
