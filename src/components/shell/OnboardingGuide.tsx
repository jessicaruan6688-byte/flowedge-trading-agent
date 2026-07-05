"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { BookOpenCheck, CheckCircle2, ChevronRight, Scale, Shield, TrendingUp, X } from "lucide-react";
import { useAppActions } from "./AppContext";

const STORAGE_KEY = "flowedge:onboarding-dismissed";

interface Step {
  icon: typeof TrendingUp;
  color: string;
  iconBg: string;
  titleEn: string;
  titleZh: string;
  descEn: string;
  descZh: string;
}

const steps: Step[] = [
  {
    icon: TrendingUp,
    color: "from-[#007acc] to-[#5e61e7]",
    iconBg: "bg-[#007acc]/10 text-[#007acc] ring-[#007acc]/20",
    titleEn: "Submit Idea",
    titleZh: "提交想法",
    descEn: "Input a HK stock ticker and your investment thesis.",
    descZh: "输入港股代码与投资想法，启动 5 位大师的分析流程。",
  },
  {
    icon: Scale,
    color: "from-[#4f46e5] to-[#7c3aed]",
    iconBg: "bg-indigo-50 text-indigo-600 ring-indigo-200",
    titleEn: "5 Masters Analyze",
    titleZh: "五位大师分析",
    descEn: "Buffett, Soros, Dalio, Lynch, Livermore independently assess.",
    descZh: "巴菲特、索罗斯、达利欧、林奇、利弗莫尔各自独立研判。",
  },
  {
    icon: Shield,
    color: "from-emerald-500 to-emerald-600",
    iconBg: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    titleEn: "Risk-Verified Verdict",
    titleZh: "风控裁决",
    descEn: "Risk manager checks volatility, PM renders final decision.",
    descZh: "风控官审查波动与仓位，组合经理给出最终裁决。",
  },
  {
    icon: BookOpenCheck,
    color: "from-violet-500 to-purple-600",
    iconBg: "bg-violet-50 text-violet-600 ring-violet-200",
    titleEn: "Track Record Evolves",
    titleZh: "战绩进化",
    descEn: "Each outcome updates master weights, improving future verdicts.",
    descZh: "每次结果更新大师权重，持续进化未来裁决。",
  },
];

export function OnboardingGuide() {
  const { language } = useAppActions();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const isZh = language === "zh";

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        const id = window.setTimeout(() => setVisible(true), 800);
        return () => window.clearTimeout(id);
      }
    } catch {
      // localStorage not available (test environment)
    }
  }, []);

  function dismiss(dontShowAgain = true) {
    setVisible(false);
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }

  function next() {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss(true);
    }
  }

  if (!visible) return null;

  const currentStep = steps[step];
  const Icon = currentStep.icon;
  const isLast = step === steps.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={() => dismiss(false)}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isZh ? "新手引导" : "Getting started guide"}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="animate-guide w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-[#E5E5E5]">
          {/* Header gradient bar */}
          <div
            className={clsx("h-1.5 w-full bg-gradient-to-r", currentStep.color)}
          />

          <div className="p-6">
            {/* Close */}
            <div className="flex items-start justify-between gap-3">
              <div className={clsx("grid h-12 w-12 place-items-center rounded-xl ring-1", currentStep.iconBg)}>
                <Icon aria-hidden className="h-6 w-6" />
              </div>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#F5F5F5] hover:text-[#0A0A0A]"
                onClick={() => dismiss(false)}
                aria-label={isZh ? "关闭" : "Close"}
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="mt-4 animate-step-in">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#737373]">
                {isZh ? `步骤 ${step + 1} / ${steps.length}` : `Step ${step + 1} of ${steps.length}`}
              </p>
              <h2 className="mt-1 text-xl font-bold text-[#0A0A0A]">
                {isZh ? currentStep.titleZh : currentStep.titleEn}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#444]">
                {isZh ? currentStep.descZh : currentStep.descEn}
              </p>
            </div>

            {/* Step dots */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStep(i)}
                    className={clsx(
                      "h-2 rounded-full transition-all duration-200",
                      i === step ? "w-6 bg-[#007acc]" : "w-2 bg-[#E5E5E5] hover:bg-[#D4D4D4]",
                    )}
                    aria-label={`${isZh ? "步骤" : "Step"} ${i + 1}`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-1.5 text-sm font-medium text-[#444] hover:bg-[#F5F5F5]"
                    onClick={() => setStep((s) => s - 1)}
                  >
                    {isZh ? "上一步" : "Back"}
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#171717] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#0A0A0A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007acc]/40"
                  onClick={next}
                >
                  {isLast ? (
                    <>
                      <CheckCircle2 aria-hidden className="h-4 w-4" />
                      {isZh ? "开始使用" : "Get started"}
                    </>
                  ) : (
                    <>
                      {isZh ? "下一步" : "Next"}
                      <ChevronRight aria-hidden className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Skip */}
            <button
              type="button"
              className="mt-4 w-full text-center text-xs text-[#737373] hover:text-[#0A0A0A]"
              onClick={() => dismiss(true)}
            >
              {isZh ? "不再显示" : "Don't show this again"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
