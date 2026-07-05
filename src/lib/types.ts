/* -------------------------------------------------------------------------- */
/*  Precedent — AI Trading Courtroom 核心类型定义                              */
/*  港股交易法庭 Agent：Bull 多方 / Bear 空方 / Judge 法官，                    */
/*  以判例法（Case Law）形式沉淀长期记忆。                                       */
/* -------------------------------------------------------------------------- */

/**
 * 顶层页面 key —— 与导航一一对应。
 */
export type PageKey =
  | "workspace"
  | "court"
  | "cases"
  | "memory"
  | "trace"
  | "settings";

/**
 * 分析模式（用户在立案庭选择的策略模式）。
 */
export type AnalysisMode = "Spot" | "Swing" | "Event" | "Sentiment";

/**
 * 法官最终裁决。
 * - BUY：做多
 * - SELL：做空
 * - REJECT：驳回起诉（不操作）
 * - REDUCE_POSITION：减持当前仓位
 */
export type Verdict = "BUY" | "SELL" | "REJECT" | "REDUCE_POSITION";

/**
 * 案件状态：对应庭审 8 步流程。
 */
export type CaseStatus =
  | "filed"        // 立案
  | "evidentiary"  // 证据开示
  | "bull_arguing" // Bull 陈词
  | "bear_arguing" // Bear 反驳
  | "judging"      // 法官裁决中
  | "decided"      // 已裁决
  | "executed"     // 已执行（模拟盘）
  | "appealed"     // 上诉/被质疑
  | "failed";      // 失败（证据不足 / API 故障）

/**
 * 模拟盘订单方向。
 */
export type OrderSide = "long" | "short" | "flat";

/**
 * 模拟盘订单状态。
 */
export type OrderStatus = "pending" | "filled" | "cancelled" | "stopped";

/**
 * 数据来源模式：标识上游行情/新闻数据的可靠程度。
 */
export type SourceMode = "live" | "partial" | "fallback" | "mock" | "replay";

/**
 * XAPI / Agent 调用溯源的发起方。
 */
export type TraceSource =
  | "bull"
  | "bear"
  | "judge"
  | "reviewer"
  | "risk"
  | "market_data"
  | "embedding"
  | "system";

/**
 * 单条溯源记录的状态。
 */
export type TraceStatus = "success" | "failed" | "running" | "fallback";

/**
 * 判例适用性等级（Case Law 中的四档效力）。
 */
export type ApplicabilityLevel =
  | "binding"        // 约束性判例 — 必须遵循
  | "persuasive"     // 说服性判例 — 可参考
  | "distinguishable" // 可区分 — 关键事实不同
  | "overruled";     // 已被推翻 — 不可引用

/**
 * 风控审批结果。
 */
export type RiskCheckResult = "approved" | "rejected" | "reduced_size";

/**
 * 判例正误回测结果标记。
 */
export type VerdictCorrectness = "correct" | "incorrect" | "partially";

/* -------------------------------------------------------------------------- */
/*  K线 / 行情数据                                                             */
/* -------------------------------------------------------------------------- */

/** 单根 K 线（港股日线/分钟线通用）。 */
export interface KlineBar {
  symbol: string;
  timestamp: string; // ISO
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** 5日移动均线 */
  ma5?: number;
  /** 20日移动均线 */
  ma20?: number;
  /** 60日移动均线 */
  ma60?: number;
}

/** Replay 模式下的 K 线：携带回放时间轴。 */
export interface ReplayBar extends KlineBar {
  /** 回放时间点（虚拟时钟）。 */
  replayTime: string;
  /** 经过加速压缩后的时间，用于 UI 展示。 */
  compressedTime?: string;
}

/* -------------------------------------------------------------------------- */
/*  证据                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * 证据条目：行情信号、新闻、情绪、资金面等在庭审中被引用。
 */
export interface Evidence {
  id: string;
  /** 证据来源分类，例如 "kline" | "news" | "sentiment" | "fundamental"。 */
  source: string;
  title: string;
  summary: string;
  /** 证据权重 0..1。 */
  weight: number;
  traceId?: string;
  sourceUrl?: string;
  sourceTimestamp?: string;
  rawId?: string;
  confidence?: number;
  sourceMode?: SourceMode;
}

/* -------------------------------------------------------------------------- */
/*  庭审双方陈词                                                               */
/* -------------------------------------------------------------------------- */

/** Bull 多方律师的陈词。 */
export interface BullArgument {
  stance: "BUY" | "HOLD";
  confidence: number; // 0..1
  thesis: string;
  bullPoints: string[];
  targetPrice?: number;
  supportingEvidenceIds: string[];
  risksAcknowledged: string[];
}

/** Bear 空方在反驳时引用的判例。 */
export interface CitedPrecedent {
  caseId: string;
  /** 本次场景与历史判例的类比点。 */
  analogy: string;
  /** 从判例中推导出的结论。 */
  inference: string;
}

/** Bear 空方检察官的反驳陈词。 */
export interface BearArgument {
  stance: "SELL" | "REDUCE" | "NEUTRAL";
  confidence: number; // 0..1
  argument: string;
  citedPrecedents: CitedPrecedent[];
  /** 直接指向看跌结论的证据 id 列表。 */
  riskEvidence: string[];
}

/* -------------------------------------------------------------------------- */
/*  法官裁决                                                                   */
/* -------------------------------------------------------------------------- */

/** 法官对单条被引用判例的适用性分析。 */
export interface PrecedentAnalysis {
  caseId: string;
  applicability: ApplicabilityLevel;
  /** 该判例在本案中的权重 0..1。 */
  weight: number;
  reasoning: string;
}

/** 法官最终裁决结果（Judge Verdict）。 */
export interface JudgeVerdict {
  winner: "bull" | "bear" | "tie";
  verdict: Verdict;
  /** 仓位调整幅度，-1..1；正值加仓，负值减仓。 */
  positionAdjustment: number;
  reasoning: string;
  precedentAnalysis: PrecedentAnalysis[];
  dissentingView?: string;
}

/* -------------------------------------------------------------------------- */
/*  风控 & 模拟盘订单                                                          */
/* -------------------------------------------------------------------------- */

/** 风控评估输出。 */
export interface RiskAssessment {
  /** 当前标的波动率（年化）。 */
  volatility: number;
  /** 日波动率。 */
  dailyVolatility?: number;
  /** 允许的最大回撤比例 0..1。 */
  maxDrawdownAllowance: number;
  /** 仓位上限（金额，HKD）。 */
  positionLimit: number;
  /** 仓位上限百分比（占组合）。 */
  positionLimitPct: number;
  /** 波动率调整乘数。 */
  volatilityMultiplier: number;
  /** 是否触发熔断（直接否决）。 */
  circuitBreakerActive: boolean;
  /** 当前组合总价值。 */
  portfolioValue: number;
  /** 当前持仓该标的市值（如有）。 */
  existingPositionValue: number;
  /** 可加仓剩余金额。 */
  remainingCapacity: number;
  /** 最大可买股数。 */
  maxBuyShares: number;
  /** 与现有持仓的相关性风险描述。 */
  correlationRisk?: string;
  rsi?: number;
  volumeRatio?: number;
  atr?: number;
  atrPct?: number;
  /** 警告信息（非熔断）。 */
  warnings: string[];
  /** 熔断原因（若触发）。 */
  circuitBreakerReason?: string;
  /** 中间计算过程，用于审计/可解释性。 */
  reasoning: Record<string, number | string | boolean | undefined>;
}

/** 模拟盘订单。 */
export interface PaperOrder {
  id: string;
  caseId?: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  /** 仓位占比 0..1。 */
  sizePct: number;
  quantity: number;
  takeProfit?: number;
  stopLoss?: number;
  status: OrderStatus;
  openedAt: string;
  closedAt?: string;
  closePrice?: number;
  pnl?: number;
  pnlPct?: number;
}

/* -------------------------------------------------------------------------- */
/*  技术指标（用于风控/信号）                                                  */
/* -------------------------------------------------------------------------- */

export interface TechnicalIndicators {
  rsi?: number;
  rsi14?: number;
  rsi28?: number;
  atr?: number;
  atrPct?: number;     // ATR / currentPrice
  atr14?: number;
  ma5?: number;
  ma20?: number;
  ma50?: number;
  ema8?: number;
  ema21?: number;
  ema55?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  bollingerUpper?: number;
  bollingerMiddle?: number;
  bollingerLower?: number;
  bbWidth?: number;
  priceVsBb?: number;
  adx14?: number;
  volatility20d?: number;
  momentum1m?: number;
  momentum3m?: number;
  hurstExponent?: number;
  skew20?: number;
  volume?: number;
  avgVolume?: number;
  volumeRatio?: number;
  dailyChangePct?: number;
  dailyVolatility?: number;
  annualizedVolatility?: number;
}

/** 基本面指标（MVP 简化版，作为完整版本的超集使用）。 */
export interface FundamentalMetrics {
  /** 市盈率 (P/E) */
  pe?: number;
  /** 市净率 (P/B) */
  pb?: number;
  /** 净资产收益率 ROE（百分比，如 18 代表 18%） */
  roe?: number;
  /** 债务/权益比（D/E） */
  debtToEquity?: number;
  /** 流动比率 */
  currentRatio?: number;
  /** 营业利润率（百分比） */
  operatingMargin?: number;
  /** 自由现金流（HKD） */
  freeCashFlow?: number;
  /** 每股收益 */
  eps?: number;
  /** 营收同比增长率（百分比） */
  revenueGrowth?: number;
  /** 盈利同比增长率（百分比） */
  earningsGrowth?: number;
  /** 利润同比增长率（百分比，兼容旧字段） */
  profitGrowth?: number;
  /** 市值（HKD） */
  marketCap?: number;
  /** 股息率（百分比） */
  dividendYield?: number;
  /** 行业板块 */
  sector?: string;
  /** 公司名称 */
  companyName?: string;
}

/** 单个大师/分析师输出的原始信号（结构化 JSON 输出，0-100 置信度）。 */
export interface MasterSignal {
  signal: "bullish" | "bearish" | "neutral";
  confidence: number; // 0..100
  /** 更详细的分析陈词（3-5句话，说明判断依据）。 */
  reasoning: string;
  /** 3个核心判断要点，每点一句话。 */
  keyPoints?: string[];
  /** 量化指标，用于UI展示（如PE/PEG/RSI/支撑位/阻力位等）。 */
  keyMetrics?: Record<string, number | string>;
  /** 该大师在本次裁决中的权重占比（0-100百分比），由court-runner在加权时填。 */
  weightPercent?: number;
}

/** 单个大师分析函数的返回结果（AI 或 fallback）。 */
export interface AgentAnalysisResult {
  masterId: MasterId;
  signal: MasterSignal;
  mode: "live" | "fallback" | "disabled";
  latencyMs: number;
  fallbackReason?: string;
}

/* -------------------------------------------------------------------------- */
/*  TradeAction & 组合管理                                                     */
/* -------------------------------------------------------------------------- */

export type TradeAction = "buy" | "sell" | "hold";

export interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  openedAt: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Portfolio {
  cash: number;
  positions: Position[];
  realizedPnl: number;
  tradeLog: PaperOrder[];
  initialBalance: number;
  updatedAt: string;
}

export interface AllowedActions {
  canBuy: boolean;
  canSell: boolean;
  maxBuyShares: number;
  maxSellShares: number;
  recommendedSizePct: number;
  reason: string;
  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/*  Master weights (Multiplicative Weights Update)                             */
/* -------------------------------------------------------------------------- */

export type MasterId =
  | "buffett"     // 价值投资（巴菲特）
  | "soros"       // 宏观/反身性（索罗斯）
  | "dalio"       // 宏观/桥水（达利欧）
  | "lynch"       // 成长/常识（林奇）
  | "livermore"   // 技术/投机（利弗莫尔）
  | "graham"      // 深度价值/安全边际
  | "technician"  // 技术分析
  | "sentiment"   // 情绪/新闻
  | "risk"        // 风控大师
  | "sorokos";    // 兼容旧拼写

export type ScenarioType =
  | "breakout"
  | "pullback"
  | "earnings"
  | "policy"
  | "sentiment"
  | "reversal"
  | "range"
  | "momentum"
  | "general"
  | "panic_selloff"
  | "high_rsi_breakout"
  | "oversold_bounce"
  | "momentum_surge"
  | "value_dip"
  | "sideways_breakout"
  | "event_driven"
  | "macro_shock"
  | "other";

/**
 * 单个投资大师/律师在法庭中的陈词信号（Bull/Bear 律师使用）。
 * 方向 + 置信度(0..1) + thesis + 关键点列表，用于最终裁决聚合。
 * 注意：5 位 master agents 内部使用更紧凑的 MasterSignal 结构（signal/confidence/reasoning/keyMetrics，0-100）。
 */
export interface AnalystSignal {
  direction: "bullish" | "bearish" | "neutral";
  confidence: number; // 0..1
  thesis: string;
  keyPoints: string[];
  targetPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeHorizon?: string;
  /** 该大师在本次裁决中的权重占比（百分比，0-100）。 */
  weightPercent?: number;
}

/** 投资组合经理最终裁决。 */
export interface PortfolioDecision {
  action: TradeAction;
  quantity: number;
  price: number;
  direction: "long" | "short" | "flat";
  stopLoss?: number;
  takeProfit?: number;
  weightedScore: number;
  verdict: Verdict;
  reasoning: string;
  signals: Record<MasterId, { signal: "bullish" | "bearish" | "neutral"; confidence: number } | null>;
}

/** 法庭会话溯源记录。 */
export interface TraceRecord {
  id: string;
  caseId: string;
  source: MasterId | "risk" | "market_data" | "system";
  action: string;
  inputHash: string;
  outputHash: string;
  startedAt: string;
  endedAt: string;
  latencyMs: number;
  status: "success" | "failed" | "fallback";
  error?: string;
  model?: string;
  provider?: string;
  outputPreview?: string;
}

export interface MasterWeight {
  masterId: MasterId;
  scenario: ScenarioType;
  weight: number;
  wins: number;
  losses: number;
  neutrals: number;
  totalTrades: number;
  lastUpdated: string;
}

export interface TradeCase {
  caseId: string;
  symbol: string;
  scenario: ScenarioType;
  openedAt: string;
  closedAt?: string;
  entryPrice: number;
  exitPrice?: number;
  direction: "long" | "short" | "flat";
  signals: Record<MasterId, { signal: "bullish" | "bearish" | "neutral"; confidence: number } | null>;
  outcome?: "win" | "loss" | "breakeven";
}

/* -------------------------------------------------------------------------- */
/*  判例（Precedent / Case Law）                                               */
/* -------------------------------------------------------------------------- */

/** 判例的数值指纹：用于相似度检索。 */
export interface NumericFingerprint {
  rsi?: number;
  volumeRatio?: number;
  volatility?: number;
  drawdown?: number;
  ma5?: number;
  ma20?: number;
  priceChange5d?: number;
  priceChange20d?: number;
}

/**
 * 判例：一次裁决沉淀下来的长期记忆单元。
 * 对应普通法中的 "Case"。
 */
export interface Precedent {
  caseId: string;
  /** 判例分类，如 "breakout" | "earnings_miss" | "policy_catalyst"。 */
  category: string;
  symbol: string;
  /** 场景自然语言描述（用于 embedding 检索）。 */
  sceneDescription: string;
  numericFingerprint: NumericFingerprint;
  embedding: number[];
  verdict: Verdict;
  /** 事后回测实际结果（在结案/复盘时填充）。 */
  actualOutcome?: {
    return3d?: number;
    return5d?: number;
    realizedAt: string;
  };
  /** 该判例所确立的原则要旨（Ratio Decidendi）。 */
  principle: string;
  /** 适用条件描述。 */
  applicabilityCondition: string;
  wasVerdictCorrect: VerdictCorrectness;
  citedByCount: number;
  lastCitedBy?: string; // caseId
  createdAt: string;
  embeddingModel: string;
}

/* -------------------------------------------------------------------------- */
/*  核心聚合：CourtCase（案件卷宗）                                            */
/* -------------------------------------------------------------------------- */

/**
 * CourtCase 是一次完整庭审的聚合根，替代旧的 TradeDebate。
 */
export interface CourtCase {
  id: string;
  symbol: string;
  caseTitle: string;
  /** 用户在立案庭提交的投资直觉/起诉要点。 */
  userIdea?: string;
  mode: AnalysisMode;
  status: CaseStatus;
  klines?: KlineBar[];
  evidence: Evidence[];
  bull?: BullArgument;
  bear?: BearArgument;
  judge?: JudgeVerdict;
  risk?: RiskAssessment;
  order?: PaperOrder;
  /** 被 Bear/Judge 引用的历史判例 id。 */
  precedentIds: string[];
  /** 本次庭审结束后新沉淀的判例（如通过审核入库）。 */
  newPrecedent?: Precedent;
  /** 证据集哈希（用于上链锚定）。 */
  evidenceHash: string;
  /** 裁决结果哈希。 */
  decisionHash?: string;
  createdAt: string;
  updatedAt: string;
  sourceMode: SourceMode;
  traceIds: string[];
  /** Replay 模式下的时间范围。 */
  replayStartTime?: string;
  replayEndTime?: string;
}

/* -------------------------------------------------------------------------- */
/*  RunningTask（实时进度）                                                    */
/* -------------------------------------------------------------------------- */

export interface TaskLogLine {
  step: string;
  message: string;
  timestamp: string;
}

/** 正在执行中的庭审任务（用于进度条 + 日志流）。 */
export interface RunningTask {
  id: string;
  symbol: string;
  userIdea?: string;
  mode: AnalysisMode;
  status: CaseStatus;
  startedAt: string;
  elapsed: number; // 秒
  progress: number; // 0..1
  currentStep: string;
  logs: TaskLogLine[] | string[];
  completedAt?: string;
  caseId?: string;
  sourceMode?: SourceMode;
}

/* -------------------------------------------------------------------------- */
/*  XAPI / Agent 调用溯源                                                      */
/* -------------------------------------------------------------------------- */

export interface XApiTrace {
  id: string;
  caseId?: string;
  source: TraceSource;
  action?: string;
  capability?: string;
  schemaFetched?: boolean;
  inputHash: string;
  outputHash: string;
  outputPreview?: string;
  startedAt: string;
  endedAt: string;
  status: TraceStatus;
  latencyMs: number;
  method?: "GET" | "POST" | string;
  headers?: Record<string, string>;
  input?: unknown;
  output?: unknown;
  error?: string;
  sourceMode?: SourceMode;
  provider?: string;
  model?: string;
  baseUrl?: string;
  promptHash?: string;
  reasoningSummary?: string;
  taskId?: string;
}

/* -------------------------------------------------------------------------- */
/*  组合 / 模拟盘持仓                                                          */
/* -------------------------------------------------------------------------- */

export interface PortfolioPosition {
  id: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  sizePct: number;
  pnl: number;
  pnlPct: number;
  openedAt: string;
  caseId: string;
  takeProfit?: number;
  stopLoss?: number;
}

export interface PortfolioSummary {
  totalEquity: number;
  cashBalance: number;
  totalPnl: number;
  totalPnlPct: number;
  positionsCount: number;
  winRate: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
}

/* -------------------------------------------------------------------------- */
/*  运行时上下文（立案庭启动一次庭审时的输入）                                  */
/* -------------------------------------------------------------------------- */

export interface WorkspaceAdvancedFilters {
  evidenceWindow: string;
  minimumConfidence: number;
  replaySpeed?: number;
  dataSources: string[]; // "kline" | "news" | "sentiment"
  xapiClasses?: string;
}

/**
 * CourtContext：一次庭审的启动上下文（由 Workspace 提交给 agent pipeline）。
 * 原 WorkspaceRunContext。
 */
export interface CourtContext {
  taskId?: string;
  symbol: string;
  userIdea?: string;
  mode: AnalysisMode;
  advancedFilters: Partial<WorkspaceAdvancedFilters> & Record<string, unknown>;
  language: "zh" | "en";
  createdAt: string;
  replaySpeed?: number;
  replayStartTime?: string;
  replayEndTime?: string;
  /** 时间机器模式：决策日期（ISO格式，只使用截至此日期的K线，之后的用于回放验证） */
  decisionDate?: string;
  traceIds?: string[];
  caseId?: string;
  sourceMode?: SourceMode;
  schemaFirst?: boolean;
  runtimeLabel?: string;
  runtimeReason?: string;
  runtimeLogs?: TaskLogLine[] | string[];
}

/* -------------------------------------------------------------------------- */
/*  页面过滤器                                                                 */
/* -------------------------------------------------------------------------- */

export interface CaseFilters {
  query?: string;
  status?: CaseStatus;
  verdict?: Verdict;
  mode?: AnalysisMode;
  dateFrom?: string;
  dateTo?: string;
  symbol?: string;
}

export interface MemoryFilters {
  query?: string;
  category?: string;
  verdict?: Verdict;
  symbol?: string;
  applicability?: ApplicabilityLevel;
  correctness?: VerdictCorrectness;
  minCitedCount?: number;
  dateFrom?: string;
  dateTo?: string;
}

/* -------------------------------------------------------------------------- */
/*  上链回执（可选）                                                           */
/* -------------------------------------------------------------------------- */

export interface DecisionAttestation {
  decisionHash?: string;
  evidenceHash: string;
  caseId?: string;
  txHash?: string;
  walletAddress?: string;
  block?: bigint | string;
  timestamp?: number | string;
  chainId?: number;
  contractAddress?: string;
  tokenId?: bigint | string;
  metadataURI?: string;
  explorerTxUrl?: string;
  onChainStatus?: "confirmed" | "mismatch" | "pending" | string;
}

export type { DecisionAttestation as ReportAttestation };

/* -------------------------------------------------------------------------- */
/*  Backward-Compatibility Aliases                                             */
/*  旧代码仍在使用的类型名 —— 保留为别名，保证编译通过。                        */
/*  新代码请直接使用上方的 CourtCase / JudgeVerdict 等新名称。                  */
/* -------------------------------------------------------------------------- */

/** @deprecated Use `AnalysisMode`. */
export type ScanMode =
  | AnalysisMode
  | "Trend"
  | "MeanRevert"
  | "Alpha Scan"
  | "Risk Scan"
  | "DAO 尽调"
  | "Futures"
  | "DeFi";

/** @deprecated Use `CaseStatus` or TraceStatus. */
export type DebateStatus =
  | "collecting"
  | "debating"
  | "strategizing"
  | "risk_check"
  | "executing"
  | "reviewing"
  | "completed"
  | "failed"
  | "rejected"
  | "Running"
  | "Completed"
  | "Failed"
  | "Cancelled"
  | CaseStatus;

/** @deprecated Old OrderStatus included stopped_out/take_profit_hit, remapped below. */
export type LegacyOrderStatus =
  | "pending"
  | "filled"
  | "cancelled"
  | "stopped_out"
  | "take_profit_hit";

/** @deprecated Use `TraceSource`. New entries replace the old agent naming. */
export type LegacyTraceSource =
  | "analyst_bull"
  | "analyst_bear"
  | "strategist"
  | "risk_manager"
  | "executor"
  | "reviewer"
  | "market_data"
  | "ai"
  | "xapi"
  | "chain"
  | "system";

/** @deprecated Use `Verdict`. */
export type LegacyVerdict =
  | "BULL_BUY"
  | "BEAR_SELL"
  | "HOLD"
  | "REDUCE"
  | "POSITIVE"
  | "OBSERVE"
  | "CAUTION"
  | "NEGATIVE";

/** @deprecated Use `Evidence`. */
export type EvidenceItem = Evidence;

/** @deprecated Use `JudgeVerdict`. The old shape combined strategist/risk together. */
export interface StrategyPlan {
  direction: OrderSide;
  entryPrice?: number;
  positionSizePct: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  holdingPeriod: string;
  reasoning: string[];
  leverage?: number;
}

/** @deprecated Use `RiskAssessment`. */
export interface RiskDecision {
  result: RiskCheckResult;
  originalSizePct?: number;
  adjustedSizePct?: number;
  reason: string[];
  maxDrawdownAllowed: number;
  riskRewardRatio?: number;
  vetoReason?: string;
}

/** @deprecated Market snapshot replaced by KlineBar[]. */
export interface MarketSnapshot {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  marketCap?: number;
  timestamp: string;
}

/** @deprecated Replaced by Precedent-based memory. */
export interface ReviewFeedback {
  summary: string;
  whatWentRight: string[];
  whatWentWrong: string[];
  lessonsLearned: string[];
  adjustmentsForNext: string[];
  confidenceDelta: number;
}

/** @deprecated Use CourtCase. This shape keeps old field names so legacy code compiles. */
export interface TradeDebate {
  id: string;
  symbol?: string;
  userIdea?: string;
  mode: ScanMode;
  status: DebateStatus | string;
  marketSnapshot?: MarketSnapshot;
  evidence: EvidenceItem[];
  bull?: BullArgument;
  bear?: BearArgument;
  strategy?: StrategyPlan;
  risk?: RiskDecision;
  order?: PaperOrder;
  review?: ReviewFeedback;
  evidenceHash: string;
  decisionHash?: string;
  createdAt: string;
  updatedAt: string;
  sourceMode?: SourceMode;
  traceIds?: string[];
  verdict?: LegacyVerdict | Verdict;
  // Legacy ChainPulse fields:
  title?: string;
  topic?: string;
  summary?: string;
  riskScore?: number;
  alphaScore?: number;
  confidence?: number;
  actions?: string[];
  rationale?: string[];
  reportHash?: string;
  taskId?: string;
  attestation?: DecisionAttestation;
  ai?: import("@/lib/ai-types").AgentAiAudit;
  elapsed?: string | number;
  logs?: TaskLogLine[] | string[];
  completedAt?: string;
  debateId?: string;
}

/** @deprecated Use CourtCase. */
export type Report = TradeDebate;

/** @deprecated Watchlist will be superseded by a "watch" view over cases. Kept for UI. */
export interface WatchlistTarget {
  id: string;
  symbol: string;
  name?: string;
  category?: "Stock" | "Index" | "Sector" | "KOL";
  lastCaseId?: string;
  lastVerdict?: Verdict | LegacyVerdict;
  lastPrice?: number;
  riskScore?: number;
  alphaScore?: number;
  lastScan?: string;
  signals24h: number[];
  alertState: "normal" | "warning" | "critical" | "Normal" | "Warning" | "Critical";
  addedAt?: string;
}

/** @deprecated Replaced by CaseFilters. */
export interface DebateFilters {
  query?: string;
  status?: DebateStatus;
  verdict?: LegacyVerdict | Verdict;
  mode?: AnalysisMode;
  dateFrom?: string;
  dateTo?: string;
}

/** @deprecated Legacy report list filters. */
export interface ReportFilters {
  query: string;
  mode: "All" | AnalysisMode | ScanMode;
  verdict: "All" | LegacyVerdict | Verdict;
  status: "All" | string;
  minRisk: number;
  maxRisk: number;
  startDate: string;
  endDate: string;
}

/** @deprecated Legacy watchlist filters. */
export interface WatchlistFilters {
  query?: string;
  alertState?: string;
  category?: "All" | WatchlistTarget["category"];
  sortBy?: "risk-desc" | "alpha-desc" | "recent";
}

/** @deprecated Use CourtContext. */
export type WorkspaceRunContext = CourtContext;

/** @deprecated MemoryLesson is replaced by Precedent. */
export interface MemoryLesson {
  id: string;
  debateId: string;
  symbol: string;
  verdict: Verdict | LegacyVerdict;
  lesson: string;
  outcome?: "success" | "failure" | "pending";
  pnl?: number;
  createdAt: string;
  tags: string[];
}

/** @deprecated Use `stopped` (new) — `stopped_out` / `take_profit_hit` folded into stopped. */
export type ReportStatus = "已完成" | "已上链" | "未上链";
