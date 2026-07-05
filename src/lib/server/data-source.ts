import { createHash } from "node:crypto";
import type {
  KlineBar,
  TechnicalIndicators,
  FundamentalMetrics,
  ScenarioType,
  SourceMode,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
  sourceMode: SourceMode;
};

const klineCache = new Map<string, CacheEntry<KlineBar[]>>();
const quoteCache = new Map<string, CacheEntry<QuoteResult>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuoteResult = {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
};

type MarketDataResult = {
  bars: KlineBar[];
  technicals: TechnicalIndicators;
  scenario: ScenarioType;
  quote: { price: number; change: number; changePercent: number; high: number; low: number; volume: number };
  sourceMode: SourceMode;
};

// ---------------------------------------------------------------------------
// Tencent Finance (gtimg.cn) helpers — primary HK stock data source (works from mainland China)
// ---------------------------------------------------------------------------

const GTIMG_BASE = "https://web.ifzq.gtimg.cn/appstock/app/hkfqkline/get";

type GtimgKlineResponse = {
  code?: number;
  data?: Record<string, {
    day?: Array<[string, string, string, string, string, string, ...unknown[]]>;
    qfqday?: Array<[string, string, string, string, string, string, ...unknown[]]>;
  }>;
};

async function fetchTencentKlines(symbol: string, days: number = 600): Promise<KlineBar[]> {
  // Normalize symbol: "0700.HK" -> "hk00700", "1810.HK" -> "hk01810"
  // HK codes are 4-5 digits on Tencent: 5-digit for codes >=10000 (00700, 01810 etc)
  const rawCode = symbol.replace(".HK", "").replace(".hk", "");
  const code = "hk" + rawCode.padStart(5, "0");
  // Calculate date range: today and ~2.5 years ago
  const end = new Date();
  const start = new Date(end.getTime() - (days + 60) * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `${GTIMG_BASE}?param=${code},day,${fmt(start)},${fmt(end)},${days},qfq`;
  const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!res.ok) throw new Error(`tencent finance HTTP ${res.status}`);
  const data = (await res.json()) as GtimgKlineResponse;
  const stockData = data.data?.[code] ?? Object.values(data.data ?? {})[0];
  const rawBars = stockData?.qfqday ?? stockData?.day ?? [];
  if (!rawBars.length) throw new Error("tencent finance returned empty kline data");
  const bars: KlineBar[] = [];
  for (const row of rawBars) {
    // row format: [date(YYYY-MM-DD), open, close, high, low, volume, ...]
    const [date, o, c, h, l, v] = row;
    const open = Number(o), close = Number(c), high = Number(h), low = Number(l), volume = Number(v);
    if (!date || !Number.isFinite(close) || close <= 0) continue;
    bars.push({
      symbol,
      timestamp: new Date(date + "T16:00:00+08:00").toISOString(),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: Math.round(volume),
    });
  }
  return bars;
}

async function fetchTencentQuote(symbol: string): Promise<QuoteResult> {
  const rawCode = symbol.replace(".HK", "").replace(".hk", "");
  const code = "hk" + rawCode.padStart(5, "0");
  const url = `https://qt.gtimg.cn/q=${code}`;
  const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!res.ok) throw new Error(`tencent quote HTTP ${res.status}`);
  // Response is GBK-encoded, Node fetch returns buffer-ish; try UTF-8 first, fall back to binary
  const buf = await res.arrayBuffer();
  let text: string;
  try {
    text = new TextDecoder("gbk").decode(buf);
  } catch { text = new TextDecoder("utf-8").decode(buf); }
  const m = text.match(/"([^"]+)"/);
  if (!m) throw new Error("tencent quote parse failed");
  const parts = m[1].split("~");
  // Tencent HK quote fields:
  // 1=name,2=code,3=price,4=prevClose,5=open,6=volume?,33=high,34=low,...
  const price = Number(parts[3]);
  const prev = Number(parts[4]);
  const open = Number(parts[5]);
  const highRaw = Number(parts[33]);
  const lowRaw = Number(parts[34]);
  const high = (Number.isFinite(highRaw) && highRaw > 0) ? highRaw : NaN;
  const low = (Number.isFinite(lowRaw) && lowRaw > 0) ? lowRaw : NaN;
  const vol = Number(parts[6] ?? parts[36] ?? 0);
  if (!Number.isFinite(price) || price <= 0) {
    const klines = await fetchTencentKlines(symbol, 10);
    const last = klines[klines.length - 1];
    const prevBar = klines[klines.length - 2] ?? last;
    return {
      price: last.close, change: round2(last.close - prevBar.close),
      changePercent: round2(((last.close - prevBar.close) / prevBar.close) * 100),
      high: last.high, low: last.low, volume: last.volume,
    };
  }
  // Use open from field 5 as fallback for high/low when fields missing
  const useHigh = Number.isFinite(high) && high > 0 ? high : Math.max(open, price);
  const useLow = Number.isFinite(low) && low > 0 ? low : Math.min(open, price);
  return {
    price: round2(price),
    change: round2(price - prev),
    changePercent: round2(prev > 0 ? ((price - prev) / prev) * 100 : 0),
    high: round2(useHigh),
    low: round2(useLow),
    volume: Math.round(vol),
  };
}

// ---------------------------------------------------------------------------
// Yahoo Finance helpers (kept as fallback, may not work from mainland China)
// ---------------------------------------------------------------------------

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const FETCH_TIMEOUT_MS = 10_000;

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: number[];
          high?: number[];
          low?: number[];
          close?: number[];
          volume?: number[];
        }>;
        adjclose?: Array<{ adjclose?: number[] }>;
      };
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
      };
    }>;
    error?: unknown;
  };
};

function cacheKey(symbol: string, range: string, interval: string) {
  return `${symbol}|${range}|${interval}`;
}

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, sourceMode: SourceMode) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS, sourceMode });
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "flowEdge/1.0 (Hong Kong Stock AI Trading Agent)",
        Accept: "application/json",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Mock data generation (geometric Brownian motion, deterministic per symbol)
// ---------------------------------------------------------------------------

function hashSeed(symbol: string): number {
  const hex = createHash("sha256").update(symbol).digest("hex");
  return Number.parseInt(hex.slice(0, 8), 16);
}

// Simple seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Approximate base price for well-known HK stocks
function getBasePrice(symbol: string): number {
  const code = symbol.replace(".HK", "").replace(/^0+/, "");
  const overrides: Record<string, number> = {
    "700": 380,   // Tencent
    "9988": 80,   // Alibaba
    "9618": 120,  // JD
    "3690": 140,  // Meituan
    "9888": 14,   // Baidu
    "1810": 16,   // Xiaomi
    "5": 50,      // HSBC
    "941": 65,    // China Mobile
    "1": 70,      // CK Hutchison
    "2": 50,      // CLP
    "16": 40,     // SHK Properties
  };
  return overrides[code] ?? 20 + (hashSeed(symbol) % 180);
}

function generateMockKlines(symbol: string, range: string, interval: string): KlineBar[] {
  const seed = hashSeed(symbol);
  const rng = mulberry32(seed);
  const basePrice = getBasePrice(symbol);

  // Determine number of bars
  const days = rangeToDays(range);
  const bars: KlineBar[] = [];

  // GBM parameters: drift ~8% annualized, vol ~25% annualized
  const tradingDaysPerYear = 252;
  const mu = 0.08 / tradingDaysPerYear;
  const sigma = 0.25 / Math.sqrt(tradingDaysPerYear);

  let price = basePrice;
  const endDate = new Date();
  const dayMs = intervalToMs(interval);

  for (let i = days - 1; i >= 0; i--) {
    const timestamp = new Date(endDate.getTime() - i * dayMs);
    // Skip weekends
    const dow = timestamp.getUTCDay();
    if (dow === 0 || dow === 6) continue;

    // GBM shock
    const z = boxMuller(rng);
    const dailyReturn = mu + sigma * z;
    const open = price;
    const close = open * (1 + dailyReturn);
    const intradayVol = sigma * (0.5 + rng());
    const high = Math.max(open, close) * (1 + Math.abs(intradayVol * rng() * 0.5));
    const low = Math.min(open, close) * (1 - Math.abs(intradayVol * rng() * 0.5));
    const baseVolume = 10_000_000 + (hashSeed(symbol + i) % 50_000_000);
    const volume = Math.round(baseVolume * (0.5 + rng() * 1.5));

    bars.push({
      symbol,
      timestamp: timestamp.toISOString(),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume,
    });

    price = close;
  }

  return bars;
}

function rangeToDays(range: string): number {
  const r = range.toLowerCase();
  if (r === "5d") return 5;
  if (r === "1mo") return 22;
  if (r === "3mo") return 66;
  if (r === "6mo") return 132;
  if (r === "1y") return 252;
  if (r === "2y") return 504;
  if (r === "5y") return 1260;
  return 252;
}

function intervalToMs(interval: string): number {
  const i = interval.toLowerCase();
  if (i === "1d" || i === "1wk" || i === "1mo") return 86400000;
  if (i === "1h") return 3600000;
  if (i === "5m") return 300000;
  return 86400000;
}

function boxMuller(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Market data source class
// ---------------------------------------------------------------------------

export const MarketDataSource = {
  /**
   * Fetch daily K-lines for a HK stock (e.g. "0700.HK").
   * Falls back to deterministic mock data if Yahoo Finance fails.
   */
  async fetchKlines(
    symbol: string,
    range: string = "2y",
    interval: string = "1d",
  ): Promise<{ bars: KlineBar[]; sourceMode: SourceMode }> {
    const key = cacheKey(symbol, range, interval);
    const cached = getCached(klineCache, key);
    if (cached) {
      const entry = klineCache.get(key)!;
      return { bars: cached, sourceMode: entry.sourceMode };
    }

    // 1) Try Tencent Finance (gtimg.cn) — works from mainland China
    try {
      const days = rangeToDays(range);
      const rawBars = await fetchTencentKlines(symbol, Math.max(days + 30, 600));
      const bars = computeMovingAverages(rawBars);
      if (bars.length > 0) {
        setCached(klineCache, key, bars, "live");
        return { bars, sourceMode: "live" };
      }
    } catch {
      // fall through to Yahoo
    }

    // 2) Try Yahoo Finance (may 403 from mainland China)
    try {
      const yahooSymbol = normalizeSymbol(symbol);
      const url = `${YAHOO_BASE}/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=${interval}`;
      const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
      if (res.ok) {
        const data = (await res.json()) as YahooChartResponse;
        const rawBars = parseYahooKlines(data, yahooSymbol);
        const bars = computeMovingAverages(rawBars);
        if (bars.length > 0) {
          setCached(klineCache, key, bars, "live");
          return { bars, sourceMode: "live" };
        }
      }
    } catch {
      // fall through to mock
    }

    // 3) Fallback: mock data
    const rawBars = generateMockKlines(symbol, range, interval);
    const bars = computeMovingAverages(rawBars);
    setCached(klineCache, key, bars, "fallback");
    return { bars, sourceMode: "fallback" };
  },

  /**
   * Fetch current quote (price, change, volume, high/low).
   */
  async fetchQuote(symbol: string): Promise<QuoteResult & { sourceMode: SourceMode }> {
    const cached = getCached(quoteCache, symbol);
    if (cached) {
      const entry = quoteCache.get(symbol)!;
      return { ...cached, sourceMode: entry.sourceMode };
    }

    // 1) Try Tencent Finance realtime quote
    try {
      const quote = await fetchTencentQuote(symbol);
      setCached(quoteCache, symbol, quote, "live");
      return { ...quote, sourceMode: "live" };
    } catch {
      // fall through
    }

    // 2) Try Yahoo Finance
    try {
      const yahooSymbol = normalizeSymbol(symbol);
      const url = `${YAHOO_BASE}/${encodeURIComponent(yahooSymbol)}?range=5d&interval=1d`;
      const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
      if (res.ok) {
        const data = (await res.json()) as YahooChartResponse;
        const bars = parseYahooKlines(data, yahooSymbol);
        const meta = data.chart?.result?.[0]?.meta;
        if (bars.length >= 2) {
          const last = bars[bars.length - 1];
          const prev = bars[bars.length - 2];
          const price = meta?.regularMarketPrice ?? last.close;
          const prevClose = meta?.previousClose ?? meta?.chartPreviousClose ?? prev.close;
          const change = round2(price - prevClose);
          const changePercent = round2((change / prevClose) * 100);
          const quote: QuoteResult = {
            price: round2(price), change, changePercent,
            volume: last.volume, high: last.high, low: last.low,
          };
          setCached(quoteCache, symbol, quote, "live");
          return { ...quote, sourceMode: "live" };
        }
      }
    } catch {
      // fall through
    }

    // 3) Fallback: derive from klines
    const { bars } = await this.fetchKlines(symbol, "1mo", "1d");
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2] ?? last;
    const change = round2(last.close - prev.close);
    const changePercent = round2((change / prev.close) * 100);
    const quote: QuoteResult = {
      price: last.close, change, changePercent,
      volume: last.volume, high: last.high, low: last.low,
    };
    return { ...quote, sourceMode: "fallback" };
  },

  /**
   * Compute all technical indicators from K-line bars.
   */
  computeTechnicals(bars: KlineBar[]): TechnicalIndicators {
    const closes = bars.map((b) => b.close);
    const highs = bars.map((b) => b.high);
    const lows = bars.map((b) => b.low);
    const volumes = bars.map((b) => b.volume);

    const rsi14 = computeRSI(closes, 14);
    const rsi28 = computeRSI(closes, 28);
    const ema8 = computeEMA(closes, 8);
    const ema21 = computeEMA(closes, 21);
    const ema55 = computeEMA(closes, 55);

    const { macd, signal: macdSignal, hist: macdHist } = computeMACD(closes);
    const { upper: bollingerUpper, middle: bollingerMiddle, lower: bollingerLower } =
      computeBollingerBands(closes, 20, 2);
    const bbWidth = bollingerMiddle > 0 ? (bollingerUpper - bollingerLower) / bollingerMiddle : 0;
    const priceVsBb =
      bollingerUpper - bollingerLower > 0
        ? (closes[closes.length - 1] - bollingerLower) / (bollingerUpper - bollingerLower)
        : 0.5;

    const atr14 = computeATR(highs, lows, closes, 14);
    const volumeRatio = computeVolumeRatio(volumes, 20);
    const adx14 = computeADX(highs, lows, closes, 14);
    const volatility20d = computeAnnualizedVolatility(closes, 20);
    const momentum1m = computeMomentum(closes, 21);
    const momentum3m = computeMomentum(closes, 63);
    const hurstExponent = computeHurstExponent(closes.slice(-128));
    const skew20 = computeSkew(closes, 20);

    return {
      rsi14,
      rsi28,
      ema8,
      ema21,
      ema55,
      macd,
      macdSignal,
      macdHist,
      bollingerUpper: round2(bollingerUpper),
      bollingerMiddle: round2(bollingerMiddle),
      bollingerLower: round2(bollingerLower),
      bbWidth: round4(bbWidth),
      priceVsBb: round4(priceVsBb),
      atr14: round2(atr14),
      volumeRatio: round2(volumeRatio),
      adx14: round2(adx14),
      volatility20d: round4(volatility20d),
      momentum1m: round4(momentum1m),
      momentum3m: round4(momentum3m),
      hurstExponent: round4(hurstExponent),
      skew20: round4(skew20),
    };
  },

  /**
   * Classify current market scenario from technicals (+ optional fundamentals).
   */
  classifyScenario(technicals: TechnicalIndicators, fundamentals?: FundamentalMetrics): ScenarioType {
    const rsi14 = technicals.rsi14 ?? technicals.rsi ?? 50;
    const macdHist = technicals.macdHist ?? 0;
    const priceVsBb = technicals.priceVsBb ?? 0.5;
    const volumeRatio = technicals.volumeRatio ?? 1;
    const adx14 = technicals.adx14 ?? 20;
    const momentum1m = technicals.momentum1m ?? 0;
    const bbWidth = technicals.bbWidth ?? 0.1;
    const ema8 = technicals.ema8 ?? 0;
    const ema21 = technicals.ema21 ?? 0;
    const vol20 = technicals.volatility20d ?? technicals.annualizedVolatility ?? 0.25;

    // Panic selloff: very low RSI, high vol, negative momentum
    if (rsi14 < 25 && momentum1m < -0.08) return "panic_selloff";

    // High RSI breakout: RSI > 70, price near upper BB, positive MACD, high volume
    if (rsi14 > 70 && priceVsBb > 0.8 && macdHist > 0 && volumeRatio > 1.3)
      return "high_rsi_breakout";

    // Oversold bounce: RSI < 30, price near lower BB, MACD histogram turning positive
    if (rsi14 < 30 && priceVsBb < 0.2 && macdHist > 0) return "oversold_bounce";

    // Momentum surge: strong positive momentum, ADX strong trend, EMA8 > EMA21, high vol
    if (momentum1m > 0.05 && adx14 > 25 && ema8 > ema21 && volumeRatio > 1.2)
      return "momentum_surge";

    // Value dip: low RSI, low price vs BB, low PE if available
    if (
      rsi14 < 35 &&
      priceVsBb < 0.3 &&
      (fundamentals?.pe !== undefined ? fundamentals.pe < 15 : true)
    )
      return "value_dip";

    // Sideways breakout: BB width contracting then expanding, ADX rising
    if (bbWidth < 0.04 && adx14 < 20 && macdHist !== 0) return "sideways_breakout";

    // Event-driven / earnings play: high volume ratio but no strong technical pattern
    if (volumeRatio > 2.0 && adx14 < 30) return "event_driven";

    // Macro shock: very high volatility, negative momentum
    if (vol20 > 0.5 && momentum1m < -0.05) return "macro_shock";

    return "other";
  },

  /**
   * Convenience: fetch klines + quote, compute technicals, classify scenario.
   */
  async getMarketData(
    symbol: string,
    range: string = "2y",
    interval: string = "1d",
  ): Promise<MarketDataResult> {
    const [{ bars, sourceMode }, quoteResult] = await Promise.all([
      this.fetchKlines(symbol, range, interval),
      this.fetchQuote(symbol),
    ]);

    const technicals = this.computeTechnicals(bars);
    const scenario = this.classifyScenario(technicals);

    return {
      bars,
      technicals,
      scenario,
      quote: {
        price: quoteResult.price,
        change: quoteResult.change,
        changePercent: quoteResult.changePercent,
        high: quoteResult.high,
        low: quoteResult.low,
        volume: quoteResult.volume,
      },
      sourceMode,
    };
  },
};

// ---------------------------------------------------------------------------
// Symbol normalization
// ---------------------------------------------------------------------------

function normalizeSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (s.endsWith(".HK")) return s;
  // If it looks like a 4-digit HK code, append .HK
  if (/^\d{1,5}$/.test(s)) {
    return s.padStart(4, "0") + ".HK";
  }
  return s;
}

// ---------------------------------------------------------------------------
// Parse Yahoo response
// ---------------------------------------------------------------------------

function parseYahooKlines(data: YahooChartResponse, symbol: string): KlineBar[] {
  const result = data.chart?.result?.[0];
  if (!result) return [];
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote) return [];

  const opens = quote.open ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const closes = quote.close ?? [];
  const volumes = quote.volume ?? [];

  const bars: KlineBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    if (o == null || h == null || l == null || c == null) continue;
    bars.push({
      symbol,
      timestamp: new Date(timestamps[i] * 1000).toISOString(),
      open: round2(o),
      high: round2(h),
      low: round2(l),
      close: round2(c),
      volume: Math.round(volumes[i] ?? 0),
    });
  }
  return bars;
}

// ---------------------------------------------------------------------------
// Technical indicator computations
// ---------------------------------------------------------------------------

// --- Simple Moving Averages (MA5 / MA20 / MA60) per bar ---
function computeMovingAverages(bars: KlineBar[]): KlineBar[] {
  const periods: Array<{ field: "ma5" | "ma20" | "ma60"; n: number }> = [
    { field: "ma5", n: 5 },
    { field: "ma20", n: 20 },
    { field: "ma60", n: 60 },
  ];
  for (const { field, n } of periods) {
    let sum = 0;
    for (let i = 0; i < bars.length; i++) {
      sum += bars[i].close;
      if (i >= n) sum -= bars[i - n].close;
      if (i >= n - 1) {
        bars[i][field] = round2(sum / n);
      }
      // bars before index n-1: leave ma undefined (not set)
    }
  }
  return bars;
}

// --- RSI (Wilder smoothing) ---
function computeRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round2(100 - 100 / (1 + rs));
}

// --- EMA ---
function computeEMA(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = values[0];
  // Seed with SMA over first `period` values
  const seedEnd = Math.min(period, values.length);
  let seedSum = 0;
  for (let i = 0; i < seedEnd; i++) seedSum += values[i];
  ema = seedSum / seedEnd;
  for (let i = seedEnd; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return round2(ema);
}

// --- MACD (12,26,9) ---
function computeMACD(closes: number[]) {
  const fast = 12;
  const slow = 26;
  const signal = 9;
  if (closes.length < slow + signal) {
    return { macd: 0, signal: 0, hist: 0 };
  }
  const macdLine: number[] = [];
  // Compute EMA12 and EMA26 and MACD line
  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);
  const fastSeed = Math.min(fast, closes.length);
  const slowSeed = Math.min(slow, closes.length);
  let fastSum = 0;
  let slowSum = 0;
  for (let i = 0; i < slowSeed; i++) {
    if (i < fastSeed) fastSum += closes[i];
    slowSum += closes[i];
  }
  let emaFast = fastSum / fastSeed;
  let emaSlow = slowSum / slowSeed;
  for (let i = slowSeed; i < closes.length; i++) {
    if (i < fastSeed) {
      emaFast = closes[i] * kFast + emaFast * (1 - kFast);
    } else {
      emaFast = closes[i] * kFast + emaFast * (1 - kFast);
      emaSlow = closes[i] * kSlow + emaSlow * (1 - kSlow);
    }
    if (i >= slowSeed - 1) {
      macdLine.push(emaFast - emaSlow);
    }
  }
  if (macdLine.length === 0) return { macd: 0, signal: 0, hist: 0 };
  // Compute signal line (EMA of MACD)
  const kSig = 2 / (signal + 1);
  const sigSeed = Math.min(signal, macdLine.length);
  let sigSum = 0;
  for (let i = 0; i < sigSeed; i++) sigSum += macdLine[i];
  let sigEma = sigSum / sigSeed;
  for (let i = sigSeed; i < macdLine.length; i++) {
    sigEma = macdLine[i] * kSig + sigEma * (1 - kSig);
  }
  const macd = macdLine[macdLine.length - 1];
  return { macd: round2(macd), signal: round2(sigEma), hist: round2(macd - sigEma) };
}

// --- Bollinger Bands (N, K) ---
function computeBollingerBands(closes: number[], period: number, mult: number) {
  if (closes.length < period) {
    const m = closes[closes.length - 1] ?? 0;
    return { upper: m, middle: m, lower: m };
  }
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return {
    middle: mean,
    upper: mean + mult * std,
    lower: mean - mult * std,
  };
}

// --- ATR (Wilder) ---
function computeATR(highs: number[], lows: number[], closes: number[], period: number): number {
  if (highs.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
    trs.push(tr);
  }
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

// --- Volume ratio (current / N-day average) ---
function computeVolumeRatio(volumes: number[], period: number): number {
  if (volumes.length < period + 1) return 1;
  const recent = volumes.slice(-period);
  const avg = recent.reduce((a, b) => a + b, 0) / period;
  if (avg === 0) return 1;
  return volumes[volumes.length - 1] / avg;
}

// --- ADX (Wilder, 14) ---
function computeADX(highs: number[], lows: number[], closes: number[], period: number): number {
  if (highs.length < period * 2 + 1) return 20;
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];
  const trs: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
    trs.push(tr);
  }

  let trN = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let plusDMN = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let minusDMN = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxSeries: number[] = [];
  for (let i = period; i < trs.length; i++) {
    trN = trN - trN / period + trs[i];
    plusDMN = plusDMN - plusDMN / period + plusDMs[i];
    minusDMN = minusDMN - minusDMN / period + minusDMs[i];
    const plusDI = (plusDMN / trN) * 100;
    const minusDI = (minusDMN / trN) * 100;
    const dx = plusDI + minusDI === 0 ? 0 : (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
    dxSeries.push(dx);
  }

  if (dxSeries.length < period) return 20;
  let adx = dxSeries.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxSeries.length; i++) {
    adx = (adx * (period - 1) + dxSeries[i]) / period;
  }
  return adx;
}

// --- Annualized volatility (N-day, daily log returns) ---
function computeAnnualizedVolatility(closes: number[], period: number): number {
  if (closes.length < period + 1) return 0.25;
  const rets: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      rets.push(Math.log(closes[i] / closes[i - 1]));
    }
  }
  if (rets.length < 2) return 0.25;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

// --- Momentum: % return over N bars ---
function computeMomentum(closes: number[], period: number): number {
  if (closes.length < period + 1) return 0;
  const past = closes[closes.length - 1 - period];
  const now = closes[closes.length - 1];
  if (past <= 0) return 0;
  return (now - past) / past;
}

// --- Hurst exponent (R/S analysis, simplified) ---
function computeHurstExponent(series: number[]): number {
  if (series.length < 20) return 0.5;
  // Use returns
  const rets: number[] = [];
  for (let i = 1; i < series.length; i++) {
    rets.push(Math.log(series[i] / series[i - 1]));
  }
  const ns = [10, 20, 40, 60];
  const logNs: number[] = [];
  const logRs: number[] = [];
  for (const n of ns) {
    if (n >= rets.length) continue;
    const rsVals: number[] = [];
    for (let start = 0; start + n <= rets.length; start += Math.max(1, Math.floor(n / 4))) {
      const window = rets.slice(start, start + n);
      const mean = window.reduce((a, b) => a + b, 0) / n;
      const deviations = window.map((v) => v - mean);
      let cumulative = 0;
      let maxC = 0;
      let minC = 0;
      for (const d of deviations) {
        cumulative += d;
        if (cumulative > maxC) maxC = cumulative;
        if (cumulative < minC) minC = cumulative;
      }
      const r = maxC - minC;
      const s = Math.sqrt(window.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
      if (s > 0) rsVals.push(r / s);
    }
    if (rsVals.length > 0) {
      const avgRs = rsVals.reduce((a, b) => a + b, 0) / rsVals.length;
      logNs.push(Math.log(n));
      logRs.push(Math.log(avgRs));
    }
  }
  if (logNs.length < 2) return 0.5;
  // Linear regression: log(R/S) = H * log(n) + c
  const n = logNs.length;
  const sumX = logNs.reduce((a, b) => a + b, 0);
  const sumY = logRs.reduce((a, b) => a + b, 0);
  const sumXY = logNs.reduce((a, x, i) => a + x * logRs[i], 0);
  const sumXX = logNs.reduce((a, x) => a + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return Math.max(0, Math.min(1, slope));
}

// --- Skewness (last N bars of returns) ---
function computeSkew(closes: number[], period: number): number {
  if (closes.length < period + 1) return 0;
  const rets: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      rets.push(Math.log(closes[i] / closes[i - 1]));
    }
  }
  if (rets.length < 3) return 0;
  const n = rets.length;
  const mean = rets.reduce((a, b) => a + b, 0) / n;
  const m2 = rets.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  const m3 = rets.reduce((a, v) => a + (v - mean) ** 3, 0) / n;
  if (m2 === 0) return 0;
  return m3 / Math.pow(m2, 1.5);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export default MarketDataSource;
