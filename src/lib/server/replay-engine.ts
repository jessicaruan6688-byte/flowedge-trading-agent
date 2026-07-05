/**
 * 回放引擎：纯函数模块
 * 接收K线、入场/止损/止盈、方向，回放N根K线检测SL/TP碰撞。
 *
 * 不调用任何API，不做IO，方便单元测试与服务端/客户端复用。
 */

export type ReplayOutcome = "tp_hit" | "sl_hit" | "timeout" | "no_trade";

export interface ReplayBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ReplayPathPoint {
  t: string;
  close: number;
  high: number;
  low: number;
  dayIndex: number;
  hitTp?: boolean;
  hitSl?: boolean;
}

export interface ReplayResult {
  outcome: ReplayOutcome;
  barsPlayed: number;
  exitPrice: number;
  exitDate: string;
  pnlPerShare: number;
  pnlPct: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  replayPath: ReplayPathPoint[];
}

export interface ReplayInput {
  direction: "long" | "short";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  futureBars: ReplayBar[];
  maxBars?: number;
}

const DEFAULT_MAX_BARS = 5;

/**
 * 主入口：回放N根K线检测SL/TP碰撞。
 */
export function runReplay(input: ReplayInput): ReplayResult {
  const { direction, entryPrice, stopLoss, takeProfit, futureBars } = input;
  const maxBars = input.maxBars ?? DEFAULT_MAX_BARS;

  // ---------- 参数校验 ----------
  const invalid =
    !futureBars ||
    futureBars.length === 0 ||
    entryPrice <= 0 ||
    stopLoss <= 0 ||
    takeProfit <= 0 ||
    stopLoss === entryPrice ||
    takeProfit === entryPrice;

  const slOnWrongSide =
    direction === "long"
      ? stopLoss >= entryPrice
      : stopLoss <= entryPrice;
  const tpOnWrongSide =
    direction === "long"
      ? takeProfit <= entryPrice
      : takeProfit >= entryPrice;

  if (invalid || slOnWrongSide || tpOnWrongSide) {
    return {
      outcome: "no_trade",
      barsPlayed: 0,
      exitPrice: entryPrice,
      exitDate: "",
      pnlPerShare: 0,
      pnlPct: 0,
      maxFavorableExcursion: 0,
      maxAdverseExcursion: 0,
      replayPath: [],
    };
  }

  // ---------- 初始化状态 ----------
  const replayPath: ReplayPathPoint[] = [];
  let outcome: ReplayOutcome = "timeout";
  let exitPrice = entryPrice;
  let exitDate = "";
  let barsPlayed = 0;

  // MFE / MAE 用相对于entry的百分比记录
  let mfe = 0;
  let mae = 0;

  const bars = futureBars.slice(0, maxBars);

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    barsPlayed = i + 1;

    const point: ReplayPathPoint = {
      t: bar.timestamp,
      close: bar.close,
      high: bar.high,
      low: bar.low,
      dayIndex: i,
    };

    // ---------- bar 内碰撞检测 ----------
    const hit = detectHit(direction, bar, entryPrice, stopLoss, takeProfit);

    if (hit.tp && hit.sl) {
      // 同一根bar内同时命中TP和SL —— 保守按SL处理（风控优先）
      outcome = "sl_hit";
      exitPrice = hit.slPrice;
      exitDate = bar.timestamp;
      point.hitSl = true;
      replayPath.push(point);
      break;
    }
    if (hit.tp) {
      outcome = "tp_hit";
      exitPrice = hit.tpPrice;
      exitDate = bar.timestamp;
      point.hitTp = true;
      // 用exitPrice计算floating（已止盈，视为到达TP价）
      updateExcursion(direction, hit.tpPrice, entryPrice, (f, a) => {
        if (f > mfe) mfe = f;
        if (a < mae) mae = a;
      });
      replayPath.push(point);
      break;
    }
    if (hit.sl) {
      outcome = "sl_hit";
      exitPrice = hit.slPrice;
      exitDate = bar.timestamp;
      point.hitSl = true;
      updateExcursion(direction, hit.slPrice, entryPrice, (f, a) => {
        if (f > mfe) mfe = f;
        if (a < mae) mae = a;
      });
      replayPath.push(point);
      break;
    }

    // 未命中 —— 用 high/low 更新 MFE/MAE（盘中极端）
    if (direction === "long") {
      const favPct = (bar.high - entryPrice) / entryPrice;
      const advPct = (bar.low - entryPrice) / entryPrice;
      if (favPct > mfe) mfe = favPct;
      if (advPct < mae) mae = advPct;
    } else {
      // short：价格下跌=浮盈，价格上涨=浮亏
      const favPct = (entryPrice - bar.low) / entryPrice;
      const advPct = (entryPrice - bar.high) / entryPrice; // 负数
      if (favPct > mfe) mfe = favPct;
      if (advPct < mae) mae = advPct;
    }

    replayPath.push(point);
  }

  // ---------- timeout 处理 ----------
  if (outcome === "timeout") {
    const last = replayPath[replayPath.length - 1];
    if (last) {
      exitPrice = last.close;
      exitDate = last.t;
    } else {
      exitPrice = entryPrice;
      exitDate = "";
    }
  }

  // ---------- 计算 pnl ----------
  const pnlPerShare =
    direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
  const pnlPct = pnlPerShare / entryPrice;

  return {
    outcome,
    barsPlayed,
    exitPrice,
    exitDate,
    pnlPerShare,
    pnlPct,
    maxFavorableExcursion: mfe,
    maxAdverseExcursion: mae,
    replayPath,
  };
}

// ---------- 内部工具 ----------

interface HitResult {
  tp: boolean;
  sl: boolean;
  tpPrice: number;
  slPrice: number;
}

/**
 * 检测单根bar内是否命中SL/TP。
 * 规则：
 *   1. 如果 open 已越过 SL/TP，则以开盘价成交（缺口跳空）。
 *   2. 否则若 high/low 均越过，保守按 SL 处理（风控优先）。
 *   3. 单独越过则按对应价位成交。
 */
function detectHit(
  direction: "long" | "short",
  bar: ReplayBar,
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
): HitResult {
  const res: HitResult = {
    tp: false,
    sl: false,
    tpPrice: takeProfit,
    slPrice: stopLoss,
  };

  if (direction === "long") {
    // 跳空开盘已越过TP
    if (bar.open >= takeProfit) {
      res.tp = true;
      res.tpPrice = bar.open;
      return res;
    }
    // 跳空开盘已跌破SL
    if (bar.open <= stopLoss) {
      res.sl = true;
      res.slPrice = bar.open;
      return res;
    }
    const tpTouched = bar.high >= takeProfit;
    const slTouched = bar.low <= stopLoss;
    if (tpTouched && slTouched) {
      // 同bar都碰到：保守SL
      res.tp = true;
      res.sl = true;
      res.tpPrice = takeProfit;
      res.slPrice = stopLoss;
      return res;
    }
    if (tpTouched) {
      res.tp = true;
      res.tpPrice = takeProfit;
    }
    if (slTouched) {
      res.sl = true;
      res.slPrice = stopLoss;
    }
  } else {
    // short
    if (bar.open <= takeProfit) {
      res.tp = true;
      res.tpPrice = bar.open;
      return res;
    }
    if (bar.open >= stopLoss) {
      res.sl = true;
      res.slPrice = bar.open;
      return res;
    }
    const tpTouched = bar.low <= takeProfit;
    const slTouched = bar.high >= stopLoss;
    if (tpTouched && slTouched) {
      res.tp = true;
      res.sl = true;
      res.tpPrice = takeProfit;
      res.slPrice = stopLoss;
      return res;
    }
    if (tpTouched) {
      res.tp = true;
      res.tpPrice = takeProfit;
    }
    if (slTouched) {
      res.sl = true;
      res.slPrice = stopLoss;
    }
  }

  // 保险：防止未使用 entryPrice 的 lint 警告（逻辑上实际不需要）
  void entryPrice;

  return res;
}

function updateExcursion(
  direction: "long" | "short",
  price: number,
  entryPrice: number,
  update: (favPct: number, advPct: number) => void,
): void {
  if (direction === "long") {
    const pct = (price - entryPrice) / entryPrice;
    if (pct >= 0) update(pct, 0);
    else update(0, pct);
  } else {
    const pct = (entryPrice - price) / entryPrice;
    if (pct >= 0) update(pct, 0);
    else update(0, pct);
  }
}
