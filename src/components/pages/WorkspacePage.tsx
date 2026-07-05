"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  Play,
  BarChart3,
  CalendarRange,
  Zap,
  MessageSquare,
  TrendingUp,
  Wallet,
  Target,
  Users,
  Gavel,
  ShieldCheck,
  Layers,
  ReceiptText,
  CircleDollarSign,
} from "lucide-react";
import { hkStockSymbols, modeOptions } from "@/lib/navigation";
import type { AnalysisMode } from "@/lib/types";
import { PRESET_CASES } from "@/lib/server/preset-cases";
import { PageHeading } from "@/components/ui/PageHeading";
import { StatCard } from "@/components/ui/StatCard";
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/ui/styles";

const DEFAULT_THESES: Record<string, string> = {
  "0700.HK":
    "腾讯游戏版号常态化 + AI 大模型（混元）落地，视频号广告持续兑现，短期有突破前高动能，关注逢低做多机会。",
  "3690.HK":
    "美团核心本地商业利润率持续改善，即时零售规模扩大；竞争格局缓和后估值有望修复，观察 60 日线支撑。",
  "9988.HK":
    "阿里电商主业企稳，云业务 AI 相关收入加速，回购力度加大；估值处于历史低位，存在均值回归机会。",
  "1211.HK":
    "比亚迪海外销量与高端品牌（仰望/方程豹）放量，电池外供比例提升，新能源龙头溢价有望继续体现。",
  "0981.HK":
    "中芯国际受益国产替代与先进制程突破，半导体周期上行叠加政策催化；注意美国出口管制风险。",
  "9618.HK":
    "京东零售利润率改善，即时零售与低价策略初见成效，PLUS 用户增长稳定；关注业绩催化。",
  "1810.HK":
    "小米手机高端化 + 汽车业务 SU7 交付超预期，人车家全生态闭环推进；估值向成长股切换。",
  "0005.HK":
    "汇丰控股净息差维持高位，回购与分红收益率具有吸引力，地缘风险缓和后外资配置价值凸显。",
};

const MODE_ICONS: Record<AnalysisMode, React.ComponentType<{ className?: string }>> = {
  Spot: BarChart3,
  Swing: CalendarRange,
  Event: Zap,
  Sentiment: MessageSquare,
};

const PIPELINE_STEPS = [
  {
    title: "数据采集",
    desc: "拉取 K 线、技术指标、资金面与市场数据",
    icon: Layers,
  },
  {
    title: "大师分析",
    desc: "Buffett / Soros / Dalio / Lynch / Livermore 独立陈词",
    icon: Users,
  },
  {
    title: "风控审核",
    desc: "波动率、仓位上限、熔断规则三重校验",
    icon: ShieldCheck,
  },
  {
    title: "加权裁决",
    desc: "组合经理按历史权重聚合五位大师投票",
    icon: Gavel,
  },
  {
    title: "模拟执行",
    desc: "生成模拟订单，带止损/止盈并跟踪结算",
    icon: ReceiptText,
  },
];

const MASTERS = [
  { color: "#22C55E", nameZh: "巴菲特", nameEn: "Buffett", framework: "价值投资 · 安全边际" },
  { color: "#EF4444", nameZh: "索罗斯", nameEn: "Soros", framework: "反身性 · 泡沫识别" },
  { color: "#F59E0B", nameZh: "达利欧", nameEn: "Dalio", framework: "风险平价 · 原则" },
  { color: "#007acc", nameZh: "林奇", nameEn: "Lynch", framework: "GARP 成长 · 十倍股" },
  { color: "#8B5CF6", nameZh: "利弗莫尔", nameEn: "Livermore", framework: "动量 · 关键点" },
];

export function WorkspacePage() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("0700.HK");
  const defaultThesis = DEFAULT_THESES[symbol] ?? DEFAULT_THESES["0700.HK"];
  const [userIdea, setUserIdea] = useState<string>(defaultThesis);
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>("Spot");
  const [isStarting, setIsStarting] = useState(false);
  const [decisionDate, setDecisionDate] = useState<string>(""); // YYYY-MM-DD，空=实时模式

  // when user changes symbol quickly and hasn't manually edited the thesis,
  // swap the thesis to match. We track "touched" by comparing to current default.
  const isIdeaTouched = useMemo(
    () => userIdea !== DEFAULT_THESES[symbol] && userIdea !== "",
    [userIdea, symbol],
  );

  function handlePickStock(sym: string) {
    setSymbol(sym);
    if (!isIdeaTouched) {
      setUserIdea(DEFAULT_THESES[sym] ?? "");
    }
  }

  function handlePreset(presetId: string) {
    const preset = PRESET_CASES.find(p => p.id === presetId);
    if (!preset) return;
    setSymbol(preset.symbol);
    setUserIdea(preset.userIdea);
    setSelectedMode(preset.mode as AnalysisMode);
    setDecisionDate(preset.decisionDate);
  }

  function handleStart() {
    const trimmed = symbol.trim();
    if (!trimmed) return;
    setIsStarting(true);
    let url = `/court?symbol=${encodeURIComponent(trimmed)}&idea=${encodeURIComponent(
      userIdea.trim(),
    )}&mode=${encodeURIComponent(selectedMode)}`;
    if (decisionDate) {
      url += `&decisionDate=${encodeURIComponent(decisionDate)}`;
    }
    router.push(url);
  }

  return (
    <section className="space-y-6">
      <PageHeading
        eyebrow="Trading Desk"
        title="交易台 · 提交分析"
        description="输入港股代码和投资想法，5位投资大师将独立分析、加权投票、风控审核后给出裁决。"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* ============== LEFT: Main form ============== */}
        <div className={clsx(cardClass, "p-6")}>
          {/* 1. Ticker */}
          <div className="grid gap-2">
            <label className={labelClass} htmlFor="ticker">
              股票代码 Ticker
            </label>
            <input
              id="ticker"
              className={clsx(inputClass, "h-11 font-mono text-[15px]")}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="0700.HK"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {hkStockSymbols.map((s) => {
                const active = symbol === s.symbol;
                return (
                  <button
                    key={s.symbol}
                    type="button"
                    onClick={() => handlePickStock(s.symbol)}
                    title={s.name}
                    className={clsx(
                      "rounded-md border bg-white px-3 py-1 text-xs transition-colors",
                      active
                        ? "border-[#007acc] bg-[#007acc]/5 text-[#007acc] ring-1 ring-[#007acc]/20"
                        : "border-[#E5E5E5] text-[#444] hover:border-[#007acc] hover:text-[#007acc]",
                    )}
                  >
                    {s.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Investment Idea */}
          <label className="mt-5 grid gap-2" htmlFor="idea">
            <span className={labelClass}>投资想法 Investment Thesis</span>
            <textarea
              id="idea"
              className={clsx(inputClass, "min-h-[120px] resize-y py-2.5 leading-6 text-[13px]")}
              value={userIdea}
              onChange={(e) => setUserIdea(e.target.value)}
              placeholder="描述你的投资逻辑，例如：腾讯游戏版号常态化+AI大模型落地，短期有突破前高动能..."
              spellCheck={false}
            />
          </label>

          {/* 3. Mode Selector */}
          <div className="mt-5 grid gap-2">
            <span className={labelClass}>分析模式 Analysis Mode</span>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {modeOptions.map((option) => {
                const Icon = MODE_ICONS[option.value];
                const selected = selectedMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedMode(option.value)}
                    className={clsx(
                      "cursor-pointer rounded-lg border p-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007acc]/15",
                      selected
                        ? "border-[#007acc] bg-[#007acc]/5 ring-1 ring-[#007acc]/20"
                        : "border-[#E5E5E0] bg-white hover:border-[#007acc]",
                    )}
                  >
                    <span
                      className={clsx(
                        "mb-2 grid h-8 w-8 place-items-center rounded-md",
                        selected
                          ? "bg-[#007acc]/10 text-[#007acc]"
                          : "bg-[#F5F5F5] text-[#737373]",
                      )}
                    >
                      <Icon aria-hidden className="h-4 w-4" />
                    </span>
                    <p className="text-xs font-semibold text-[#0A0A0A]">
                      {option.label}
                      <span className="ml-1 font-normal text-[#A3A3A3]">{option.labelEn}</span>
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-[#737373]">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3.5) 时间机器 + 预设案例 */}
          <div className={cardClass + " p-4"}>
            <div className="mb-3 flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-[#007acc]" />
              <h3 className="text-sm font-semibold text-[#0A0A0A]">时间机器 Time Machine</h3>
              <span className="text-[10px] text-gray-400">回到过去验证策略</span>
            </div>

            <div className="mb-3">
              <label className={labelClass + " mb-1.5 block"}>决策日期（可选）</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={decisionDate}
                  onChange={e => setDecisionDate(e.target.value)}
                  className={inputClass + " flex-1"}
                  max={new Date().toISOString().split("T")[0]}
                />
                {decisionDate && (
                  <button
                    type="button"
                    onClick={() => setDecisionDate("")}
                    className="rounded-md border border-gray-200 px-2 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50"
                  >
                    实时模式
                  </button>
                )}
              </div>
              <p className="mt-1 text-[10px] text-gray-400">
                {decisionDate
                  ? `将以 ${decisionDate} 为决策日，使用当日之前的K线分析，之后的5根日K线用于回放验证`
                  : "实时模式：使用最新市场数据分析"}
              </p>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium text-gray-500">🔥 一键演示案例 Demo Cases</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PRESET_CASES.map(p => {
                  const active = decisionDate === p.decisionDate && symbol === p.symbol;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePreset(p.id)}
                      className={clsx(
                        "rounded-lg border p-2.5 text-left transition-all hover:shadow-sm",
                        active
                          ? "border-blue-400 bg-blue-50/70 ring-1 ring-blue-200"
                          : "border-gray-200 bg-white hover:border-blue-200",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12px] font-semibold text-gray-900">{p.symbolDisplay}</span>
                        <span className="text-[10px] text-gray-400">{p.decisionDate}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-gray-500">{p.scenarioTag}</p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-gray-600">
                        {p.narrative}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Submit button */}
          <button
            className={clsx(primaryButtonClass, "mt-6 w-full")}
            type="button"
            onClick={handleStart}
            disabled={isStarting || !symbol.trim()}
          >
            {isStarting ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
                正在进入分析庭…
              </>
            ) : (
              <>
                <Play aria-hidden className="h-4 w-4" />
                开始分析 Start Analysis
              </>
            )}
          </button>
        </div>

        {/* ============== RIGHT: Sidebar ============== */}
        <aside className="space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={Target}
              label="今日分析"
              value="0"
              detail="Today"
              tone="blue"
            />
            <StatCard
              icon={Wallet}
              label="组合净值"
              value="HK$ 1,000,000"
              accent
              tone="blue"
            />
            <StatCard
              icon={TrendingUp}
              label="胜率"
              value="--"
              detail="等待首笔"
            />
          </div>

          {/* How it works */}
          <div className={clsx(cardClass, "p-5")}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
              分析流程
            </h3>
            <ol className="mt-3 space-y-3">
              {PIPELINE_STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <li key={step.title} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#007acc]/10 text-[11px] font-semibold text-[#007acc] ring-1 ring-[#007acc]/20">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#0A0A0A]">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-[#737373]">
                        {step.desc}
                      </p>
                    </div>
                    <Icon
                      aria-hidden
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B3B3B3]"
                    />
                  </li>
                );
              })}
            </ol>
          </div>

          {/* 5 Masters */}
          <div className={clsx(cardClass, "p-5")}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
              五位投资大师
            </h3>
            <ul className="mt-3 space-y-2.5">
              {MASTERS.map((m) => (
                <li
                  key={m.nameEn}
                  className="flex items-center gap-3 rounded-md px-1 py-1"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: m.color, boxShadow: `0 0 0 1px ${m.color}40` }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#0A0A0A]">
                      {m.nameZh}
                      <span className="ml-1.5 font-normal text-[#A3A3A3]">
                        {m.nameEn}
                      </span>
                    </p>
                  </div>
                  <span className="text-[11px] text-[#737373]">{m.framework}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-2 border-t border-[#F0F0F0] pt-3 text-[11px] leading-4 text-[#A3A3A3]">
              <CircleDollarSign aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#007acc]" />
              五位大师独立输出信号，按 Multiplicative Weights 加权后由组合经理给出最终裁决。
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
