import type { PageKey, AnalysisMode } from "./types";

export interface NavigationItem {
  key: PageKey;
  label: string;
  labelEn: string;
  path: string;
}

export const navigationItems: NavigationItem[] = [
  { key: "workspace", label: "交易台", labelEn: "Trading Desk", path: "/workspace" },
  { key: "court", label: "分析庭", labelEn: "Courtroom", path: "/court" },
  { key: "cases", label: "交易卷宗", labelEn: "Case Files", path: "/cases" },
  { key: "memory", label: "大师战绩", labelEn: "Masters", path: "/memory" },
  { key: "trace", label: "调用溯源", labelEn: "Trace", path: "/trace" },
  { key: "settings", label: "设置", labelEn: "Settings", path: "/settings" },
];

export interface ModeOption {
  value: AnalysisMode;
  label: string;
  labelEn: string;
  description: string;
}

export const modeOptions: ModeOption[] = [
  { value: "Spot", label: "港股现货", labelEn: "Spot HK", description: "港股个股现货方向分析" },
  { value: "Swing", label: "波段交易", labelEn: "Swing", description: "3-10日波段策略" },
  { value: "Event", label: "事件驱动", labelEn: "Event", description: "财报/政策事件驱动" },
  { value: "Sentiment", label: "情绪分析", labelEn: "Sentiment", description: "新闻/市场情绪面分析" },
];

/**
 * 庭审/分析 8+ 步流程 —— Workspace 进度条与 Court 页进度条共用。
 */
export const analysisSteps = [
  "加载数据",
  "技术指标",
  "巴菲特分析",
  "索罗斯分析",
  "达利欧分析",
  "林奇分析",
  "利弗莫尔分析",
  "风控裁决",
  "执行下单",
];

/** Alias kept for backwards compatibility. */
export const trialSteps = analysisSteps;

/**
 * 港股常用标的代码（含 quick-pick）。
 */
export const hkStockSymbols = [
  { symbol: "0700.HK", name: "腾讯", shortName: "0700 腾讯" },
  { symbol: "3690.HK", name: "美团-W", shortName: "3690 美团" },
  { symbol: "9988.HK", name: "阿里巴巴-W", shortName: "9988 阿里" },
  { symbol: "1211.HK", name: "比亚迪股份", shortName: "1211 比亚迪" },
  { symbol: "0981.HK", name: "中芯国际", shortName: "0981 中芯" },
  { symbol: "9618.HK", name: "京东集团-SW", shortName: "9618 京东" },
  { symbol: "1810.HK", name: "小米集团-W", shortName: "1810 小米" },
  { symbol: "0005.HK", name: "汇丰控股", shortName: "0005 汇丰" },
];

export const defaultWorkspaceAdvancedFilters = {
  evidenceWindow: "3mo",
  minimumConfidence: 0.5,
  replaySpeed: 60,
  dataSources: ["kline", "news", "sentiment"] as string[],
};

/**
 * 根据 pathname 推断当前激活的页面 key。
 */
export function pageKeyFromPath(pathname: string | null): PageKey {
  if (!pathname) return "workspace";
  if (pathname.startsWith("/case/")) return "cases";
  const found = navigationItems.find(
    (item) => pathname === item.path || pathname.startsWith(item.path + "/"),
  );
  return found?.key ?? "workspace";
}
