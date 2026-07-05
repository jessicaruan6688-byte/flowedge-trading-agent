"use client";

import { createContext, useContext } from "react";
import type { AppLanguage, I18nKey } from "@/lib/i18n";

export interface AppActions {
  copiedKey: string;
  notify: (message: string) => void;
  copyText: (text: string, label: string) => Promise<void>;
  downloadJson: (filename: string, data: unknown) => void;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: I18nKey) => string;
  /** Paper-trading portfolio balance in HKD. */
  portfolioBalance: number;
  setPortfolioBalance: (balance: number) => void;
}

export const AppActionsContext = createContext<AppActions | null>(null);

export function useAppActions() {
  const context = useContext(AppActionsContext);
  if (!context) {
    throw new Error("useAppActions must be used inside AppShell");
  }
  return context;
}
