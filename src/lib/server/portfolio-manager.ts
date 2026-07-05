/**
 * flowEdge — 模拟盘组合管理器（Paper Trading）
 *
 * MVP 阶段仅支持 long-only（做多），不做融券做空。
 * 所有写入都是纯函数式：返回新的 Portfolio 对象，不修改入参。
 */

import { randomUUID } from "node:crypto";
import type {
  Portfolio,
  Position,
  PaperOrder,
  TradeAction,
} from "@/lib/types";

const INITIAL_BALANCE = Number(process.env.INITIAL_PAPER_BALANCE || "1000000");

// ---------------------------------------------------------------------------
// 内部小工具
// ---------------------------------------------------------------------------

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function calcPortfolioEquity(p: Portfolio): number {
  const pos = p.positions.reduce(
    (sum, pos) => sum + pos.currentPrice * pos.quantity,
    0,
  );
  return p.cash + pos;
}

// ---------------------------------------------------------------------------
// createPortfolio
// ---------------------------------------------------------------------------

export function createPortfolio(initialBalance?: number): Portfolio {
  const balance =
    typeof initialBalance === "number" && initialBalance > 0
      ? initialBalance
      : INITIAL_BALANCE;
  const now = new Date().toISOString();
  return {
    cash: balance,
    positions: [],
    realizedPnl: 0,
    tradeLog: [],
    initialBalance: balance,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// executeOrder
// ---------------------------------------------------------------------------
//
// 买入：扣现金 → 增加/新建仓位；支持多次买入自动加权均价。
// 卖出：加现金 → 减/平仓；按加权均价算 realized pnl。
// MVP 仅支持 long-only，若卖空 quantity>持仓，返回 error。

export function executeOrder(params: {
  portfolio: Portfolio;
  symbol: string;
  action: TradeAction;
  quantity: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: string;
  caseId?: string;
}): { portfolio: Portfolio; order: PaperOrder; error?: string } {
  const { portfolio, symbol, action, quantity, price, timestamp, caseId } = params;
  const stopLoss = params.stopLoss;
  const takeProfit = params.takeProfit;

  // 防御拷贝
  const next: Portfolio = clone(portfolio);
  next.updatedAt = timestamp;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    const order = makeOrder({ symbol, action, price, quantity: 0, timestamp, caseId, status: "cancelled" });
    return { portfolio: next, order, error: "数量必须为正数" };
  }
  if (!Number.isFinite(price) || price <= 0) {
    const order = makeOrder({ symbol, action, price, quantity, timestamp, caseId, status: "cancelled" });
    return { portfolio: next, order, error: "价格无效" };
  }

  // 港股整手，强制 100 整数倍
  const qty = Math.floor(quantity / 100) * 100;
  if (qty <= 0) {
    const order = makeOrder({ symbol, action, price, quantity: 0, timestamp, caseId, status: "cancelled" });
    return { portfolio: next, order, error: "不足一手（100 股）" };
  }

  const notional = qty * price;

  if (action === "buy") {
    if (next.cash < notional) {
      const order = makeOrder({ symbol, action, price, quantity: qty, timestamp, caseId, status: "cancelled" });
      return {
        portfolio: next,
        order,
        error: `现金不足：需要 ${notional.toFixed(2)} HKD，可用 ${next.cash.toFixed(2)} HKD`,
      };
    }

    next.cash -= notional;

    const existing = next.positions.find((p) => p.symbol === symbol);
    if (existing) {
      // 加权平均成本
      const totalQty = existing.quantity + qty;
      existing.entryPrice =
        (existing.entryPrice * existing.quantity + price * qty) / totalQty;
      existing.quantity = totalQty;
      existing.currentPrice = price;
      if (stopLoss !== undefined) existing.stopLoss = stopLoss;
      if (takeProfit !== undefined) existing.takeProfit = takeProfit;
    } else {
      const pos: Position = {
        symbol,
        quantity: qty,
        entryPrice: price,
        currentPrice: price,
        openedAt: timestamp,
        stopLoss,
        takeProfit,
      };
      next.positions.push(pos);
    }

    const totalEquity = calcPortfolioEquity(next);
    const sizePct = notional / totalEquity;

    const order = makeOrder({
      symbol,
      action,
      price,
      quantity: qty,
      timestamp,
      caseId,
      status: "filled",
      stopLoss,
      takeProfit,
      sizePct,
    });
    next.tradeLog.push(order);
    return { portfolio: next, order };
  }

  if (action === "sell") {
    const existing = next.positions.find((p) => p.symbol === symbol);
    if (!existing || existing.quantity < qty) {
      const order = makeOrder({ symbol, action, price, quantity: qty, timestamp, caseId, status: "cancelled" });
      return {
        portfolio: next,
        order,
        error: existing
          ? `持仓不足：持有 ${existing.quantity}，卖出 ${qty}`
          : `没有 ${symbol} 的持仓`,
      };
    }

    const realizedPnl = (price - existing.entryPrice) * qty;
    next.cash += notional;
    next.realizedPnl += realizedPnl;
    existing.quantity -= qty;
    existing.currentPrice = price;

    const pnlPct = existing.entryPrice > 0 ? (price - existing.entryPrice) / existing.entryPrice : 0;

    let closedAt: string | undefined;
    let closePrice: number | undefined;
    let closedStatus: PaperOrder["status"] = "filled";
    if (existing.quantity === 0) {
      next.positions = next.positions.filter((p) => p.symbol !== symbol);
      closedAt = timestamp;
      closePrice = price;
      closedStatus = "stopped";
    }

    const order = makeOrder({
      symbol,
      action,
      price,
      quantity: qty,
      timestamp,
      caseId,
      status: closedStatus,
      pnl: realizedPnl,
      pnlPct,
      closedAt,
      closePrice,
      sizePct: notional / calcPortfolioEquity(next),
    });
    next.tradeLog.push(order);
    return { portfolio: next, order };
  }

  // hold
  const order = makeOrder({ symbol, action, price, quantity: 0, timestamp, caseId, status: "cancelled" });
  return { portfolio: next, order, error: "hold 动作不产生订单" };
}

// ---------------------------------------------------------------------------
// markToMarket — 刷新价格、检查止损/止盈、自动平仓
// ---------------------------------------------------------------------------

export function markToMarket(params: {
  portfolio: Portfolio;
  prices: Record<string, number>;
  timestamp: string;
}): { portfolio: Portfolio; closedOrders: PaperOrder[] } {
  const { portfolio, prices, timestamp } = params;
  const next: Portfolio = clone(portfolio);
  next.updatedAt = timestamp;
  const closedOrders: PaperOrder[] = [];

  // 先刷新价格 + pnl
  for (const pos of next.positions) {
    if (prices[pos.symbol] !== undefined && prices[pos.symbol] > 0) {
      pos.currentPrice = prices[pos.symbol];
    }
  }

  // 再检查止损止盈（多单：price<=stop 或 price>=target 触发）
  // 注意：迭代时数组可能被 mutate，所以先收集要平掉的仓位
  const toClose: Array<{ position: Position; reason: "stop" | "target" }> = [];
  for (const pos of next.positions) {
    if (pos.stopLoss !== undefined && pos.currentPrice <= pos.stopLoss) {
      toClose.push({ position: pos, reason: "stop" });
    } else if (pos.takeProfit !== undefined && pos.currentPrice >= pos.takeProfit) {
      toClose.push({ position: pos, reason: "target" });
    }
  }

  for (const { position, reason } of toClose) {
    const qty = position.quantity;
    const price = position.currentPrice;
    const pnl = (price - position.entryPrice) * qty;
    const pnlPct = (price - position.entryPrice) / position.entryPrice;
    next.cash += qty * price;
    next.realizedPnl += pnl;

    const order = makeOrder({
      symbol: position.symbol,
      action: "sell",
      price,
      quantity: qty,
      timestamp,
      status: "stopped",
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      pnl,
      pnlPct,
      closedAt: timestamp,
      closePrice: price,
      sizePct: (qty * price) / Math.max(calcPortfolioEquity(next), 1),
    });
    next.tradeLog.push(order);
    closedOrders.push(order);

    // 从持仓中移除
    next.positions = next.positions.filter((p) => p.symbol !== position.symbol);

    // 避免未使用 reason 警告
    void reason;
  }

  return { portfolio: next, closedOrders };
}

// ---------------------------------------------------------------------------
// getPortfolioSummary
// ---------------------------------------------------------------------------

export function getPortfolioSummary(portfolio: Portfolio): {
  totalEquity: number;
  cashBalance: number;
  totalPnl: number;
  totalPnlPct: number;
  positionsCount: number;
  winRate: number;
  totalTrades: number;
} {
  const totalEquity = calcPortfolioEquity(portfolio);
  const cashBalance = portfolio.cash;
  const totalPnl = totalEquity - portfolio.initialBalance;
  const totalPnlPct =
    portfolio.initialBalance > 0 ? totalPnl / portfolio.initialBalance : 0;
  const positionsCount = portfolio.positions.length;

  // 胜率：已平仓 sell 订单中 pnl>=0 的占比
  const closedSells = portfolio.tradeLog.filter(
    (o) => (o.status === "filled" || o.status === "stopped") && o.side === "long" && typeof o.pnl === "number",
  );
  const totalTrades = closedSells.length;
  const wins = closedSells.filter((o) => (o.pnl ?? 0) > 0).length;
  const winRate = totalTrades > 0 ? wins / totalTrades : 0;

  return {
    totalEquity,
    cashBalance,
    totalPnl,
    totalPnlPct,
    positionsCount,
    winRate,
    totalTrades,
  };
}

// ---------------------------------------------------------------------------
// 序列化
// ---------------------------------------------------------------------------

export function serializePortfolio(portfolio: Portfolio): string {
  return JSON.stringify(portfolio, null, 2);
}

export function deserializePortfolio(json: string): Portfolio {
  const parsed = JSON.parse(json) as Partial<Portfolio>;
  const now = new Date().toISOString();
  return {
    cash: typeof parsed.cash === "number" ? parsed.cash : INITIAL_BALANCE,
    positions: Array.isArray(parsed.positions) ? parsed.positions : [],
    realizedPnl: typeof parsed.realizedPnl === "number" ? parsed.realizedPnl : 0,
    tradeLog: Array.isArray(parsed.tradeLog) ? parsed.tradeLog : [],
    initialBalance:
      typeof parsed.initialBalance === "number" ? parsed.initialBalance : INITIAL_BALANCE,
    updatedAt: parsed.updatedAt ?? now,
  };
}

// ---------------------------------------------------------------------------
// 内部 order 工厂
// ---------------------------------------------------------------------------

function makeOrder(opts: {
  symbol: string;
  action: TradeAction;
  price: number;
  quantity: number;
  timestamp: string;
  caseId?: string;
  status: PaperOrder["status"];
  stopLoss?: number;
  takeProfit?: number;
  pnl?: number;
  pnlPct?: number;
  closedAt?: string;
  closePrice?: number;
  sizePct?: number;
}): PaperOrder {
  const side: PaperOrder["side"] =
    opts.action === "buy" ? "long" : opts.action === "sell" ? "flat" : "flat";
  return {
    id: randomUUID(),
    caseId: opts.caseId,
    symbol: opts.symbol,
    side,
    entryPrice: opts.price,
    sizePct: opts.sizePct ?? 0,
    quantity: opts.quantity,
    takeProfit: opts.takeProfit,
    stopLoss: opts.stopLoss,
    status: opts.status,
    openedAt: opts.timestamp,
    closedAt: opts.closedAt,
    closePrice: opts.closePrice,
    pnl: opts.pnl,
    pnlPct: opts.pnlPct,
  };
}
