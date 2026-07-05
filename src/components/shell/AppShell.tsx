"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppActionsContext, type AppActions } from "./AppContext";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { OnboardingGuide } from "./OnboardingGuide";
import { Sidebar } from "./Sidebar";
import { Toast } from "@/components/ui/Toast";
import { defaultLanguage, parseLanguage, translate, type AppLanguage, type I18nKey } from "@/lib/i18n";

export { useAppActions } from "./AppContext";

const STORAGE_PREFIX = "flowedge:";
const DEFAULT_PORTFOLIO_BALANCE = 1_000_000;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [language, setLanguageState] = useState<AppLanguage>(defaultLanguage);
  const [portfolioBalance, setPortfolioBalanceState] = useState<number>(DEFAULT_PORTFOLIO_BALANCE);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLanguageState(parseLanguage(readLocalStorage(`${STORAGE_PREFIX}language`)));
      const savedBalance = readLocalStorage(`${STORAGE_PREFIX}portfolioBalance`);
      const parsed = savedBalance ? Number(savedBalance) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) {
        setPortfolioBalanceState(parsed);
      } else {
        const envBalance = Number(process.env.NEXT_PUBLIC_INITIAL_BALANCE_HKD);
        setPortfolioBalanceState(
          Number.isFinite(envBalance) && envBalance > 0 ? envBalance : DEFAULT_PORTFOLIO_BALANCE,
        );
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";
    writeLocalStorage(`${STORAGE_PREFIX}language`, nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "zh" : "en");
  }, [language, setLanguage]);

  const t = useCallback((key: I18nKey) => translate(language, key), [language]);

  const setPortfolioBalance = useCallback((balance: number) => {
    setPortfolioBalanceState(balance);
    writeLocalStorage(`${STORAGE_PREFIX}portfolioBalance`, String(balance));
  }, []);

  const copyText = useCallback(
    async (text: string, label: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        }
      } catch {
        // Clipboard may be unavailable in preview and test contexts.
      }
      setCopiedKey(label);
      notify("Copied");
      window.setTimeout(() => setCopiedKey(""), 1600);
    },
    [notify],
  );

  const downloadJson = useCallback(
    (filename: string, data: unknown) => {
      try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        notify("JSON exported");
      } catch {
        notify("JSON export prepared");
      }
    },
    [notify],
  );

  const actions = useMemo<AppActions>(
    () => ({
      copiedKey,
      notify,
      copyText,
      downloadJson,
      language,
      setLanguage,
      toggleLanguage,
      t,
      portfolioBalance,
      setPortfolioBalance,
    }),
    [
      copiedKey,
      copyText,
      downloadJson,
      language,
      notify,
      portfolioBalance,
      setLanguage,
      setPortfolioBalance,
      t,
      toggleLanguage,
    ],
  );

  return (
    <AppActionsContext.Provider value={actions}>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[#0A0A0A] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow focus:ring-1 focus:ring-[#0A0A0A]/20"
        href="#main-content"
      >
        {t("shell.skip")}
      </a>
      <div className="min-h-[100dvh] bg-[#F0F0F0] text-[#0A0A0A] lg:grid lg:grid-cols-[260px_1fr]">
        <Sidebar />
        <div className="flex min-w-0 flex-col">
          <Header />
          <main
            id="main-content"
            className="min-w-0 flex-1 px-4 py-6 text-[#0A0A0A] sm:px-6 lg:px-8"
            tabIndex={-1}
          >
            <div className="mx-auto max-w-[1400px] animate-panel">{children}</div>
          </main>
          <Footer />
        </div>
        {toast ? <Toast message={toast} /> : null}
        <OnboardingGuide />
      </div>
    </AppActionsContext.Provider>
  );
}

function readLocalStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    return typeof storage?.getItem === "function" ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    if (typeof storage?.setItem === "function") storage.setItem(key, value);
  } catch {
    // Local storage can be unavailable in embedded preview and test contexts.
  }
}
