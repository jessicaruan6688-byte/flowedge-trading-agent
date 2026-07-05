/**
 * flowEdge — Multiplicative Weights Update 主权重仓库
 *
 * 每个 (masterId × scenario) 维护一个权重；交易平仓后根据谁对谁错更新权重。
 * 权重持久化到 `.flowedge/weights.json`，采用写临时文件再 rename 的原子写入。
 */

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  MasterId,
  ScenarioType,
  MasterWeight,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const DEFAULT_WEIGHT = 1.0;
const REWARD_MULTIPLIER = 1.1;
const PENALTY_MULTIPLIER = 0.8;
const MIN_WEIGHT = 0.3;
const MAX_WEIGHT = 2.0;

const WEIGHTS_DIR = ".flowedge";
const WEIGHTS_FILE = ".flowedge/weights.json";

// 置信度对奖惩倍率的缩放系数（高置信度对错放大奖惩）
// confAdjustment: multiplier' = multiplier ^ (0.5 + confidence)
// confidence=0  -> 指数 0.5（减弱）
// confidence=1  -> 指数 1.5（放大）
const CONF_BASE = 0.5;
const CONF_RANGE = 1.0; // 指数范围 [0.5, 1.5]

// 已知 master 列表（用于 initWeights）
const ALL_MASTERS: MasterId[] = [
  "buffett",
  "soros",
  "dalio",
  "lynch",
  "livermore",
  "graham",
  "technician",
  "sentiment",
  "risk",
];

const ALL_SCENARIOS: ScenarioType[] = [
  "breakout",
  "pullback",
  "earnings",
  "policy",
  "sentiment",
  "reversal",
  "range",
  "momentum",
  "general",
  "panic_selloff",
  "high_rsi_breakout",
  "oversold_bounce",
  "momentum_surge",
  "value_dip",
  "sideways_breakout",
  "event_driven",
  "macro_shock",
  "other",
];

// ---------------------------------------------------------------------------
// 内存缓存 + 写入队列（参考 agent-store 模式）
// ---------------------------------------------------------------------------

interface WeightsFileShape {
  version: 1;
  updatedAt: string;
  weights: MasterWeight[];
}

let weightsCache: Record<string, MasterWeight> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();
let pathOverride: string | null = null;

// ---------------------------------------------------------------------------
// 路径与 IO
// ---------------------------------------------------------------------------

function getWeightsFilePath(): string {
  return pathOverride || WEIGHTS_FILE;
}

function getWeightsDir(): string {
  if (!pathOverride) return WEIGHTS_DIR;
  const parsed = path.parse(pathOverride);
  return parsed.dir || ".";
}

export function setWeightsPathForTest(filePath: string | null): void {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    throw new Error("setWeightsPathForTest can only be used in tests");
  }
  pathOverride = filePath;
  weightsCache = null;
}

function keyOf(masterId: MasterId, scenario: ScenarioType): string {
  return `${masterId}::${scenario}`;
}

async function loadWeightsFromDisk(): Promise<Record<string, MasterWeight>> {
  const filePath = getWeightsFilePath();
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WeightsFileShape>;
    const list = Array.isArray(parsed.weights) ? parsed.weights : [];
    const map: Record<string, MasterWeight> = {};
    for (const w of list) {
      if (w && w.masterId && w.scenario) {
        map[keyOf(w.masterId, w.scenario)] = normalizeWeight(w);
      }
    }
    return map;
  } catch (error) {
    if (isFileNotFound(error)) return {};
    throw error;
  }
}

async function saveWeightsToDisk(): Promise<void> {
  if (!weightsCache) return;
  const filePath = getWeightsFilePath();
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(getWeightsDir(), { recursive: true });
  const payload: WeightsFileShape = {
    version: 1,
    updatedAt: new Date().toISOString(),
    weights: Object.values(weightsCache),
  };
  try {
    await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await rename(tempPath, filePath);
  } catch (err) {
    await rm(tempPath, { force: true });
    throw err;
  }
}

async function ensureCache(): Promise<Record<string, MasterWeight>> {
  if (weightsCache) return weightsCache;
  weightsCache = await loadWeightsFromDisk();
  return weightsCache;
}

function normalizeWeight(w: Partial<MasterWeight> & Pick<MasterWeight, "masterId" | "scenario">): MasterWeight {
  return {
    masterId: w.masterId,
    scenario: w.scenario,
    weight: clamp(typeof w.weight === "number" ? w.weight : DEFAULT_WEIGHT, MIN_WEIGHT, MAX_WEIGHT),
    wins: typeof w.wins === "number" ? w.wins : 0,
    losses: typeof w.losses === "number" ? w.losses : 0,
    neutrals: typeof w.neutrals === "number" ? w.neutrals : 0,
    totalTrades: typeof w.totalTrades === "number" ? w.totalTrades : 0,
    lastUpdated: w.lastUpdated ?? new Date().toISOString(),
  };
}

function getOrCreate(
  store: Record<string, MasterWeight>,
  masterId: MasterId,
  scenario: ScenarioType,
): MasterWeight {
  const k = keyOf(masterId, scenario);
  if (!store[k]) {
    store[k] = normalizeWeight({
      masterId,
      scenario,
      weight: DEFAULT_WEIGHT,
      wins: 0,
      losses: 0,
      neutrals: 0,
      totalTrades: 0,
    });
  }
  return store[k];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

// ---------------------------------------------------------------------------
// 排队保存（避免并发写）
// ---------------------------------------------------------------------------

function enqueueSave(): void {
  const snapshot = weightsCache;
  if (!snapshot) return;
  const task = writeQueue.then(async () => {
    // 只有最新的 cache 写入；中间态会被覆盖丢弃
    if (weightsCache !== snapshot) return;
    await saveWeightsToDisk();
  });
  writeQueue = task.catch(() => undefined);
}

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/** 获取所有权重（按 key 返回 map）。 */
export async function getAllWeights(): Promise<Record<string, MasterWeight>> {
  const store = await ensureCache();
  // 返回浅拷贝防止外部直接修改 cache
  return { ...store };
}

/** 获取特定 master × scenario 的权重。 */
export async function getWeight(
  masterId: MasterId,
  scenario: ScenarioType,
): Promise<number> {
  const store = await ensureCache();
  return getOrCreate(store, masterId, scenario).weight;
}

/** 获取某场景下所有 master 的权重。 */
export async function getScenarioWeights(
  scenario: ScenarioType,
): Promise<Record<MasterId, number>> {
  const store = await ensureCache();
  const result = {} as Record<MasterId, number>;
  for (const mid of ALL_MASTERS) {
    result[mid] = getOrCreate(store, mid, scenario).weight;
  }
  return result;
}

/** 初始化所有权重为默认值（覆盖）。 */
export async function initWeights(): Promise<void> {
  const store: Record<string, MasterWeight> = {};
  const now = new Date().toISOString();
  for (const mid of ALL_MASTERS) {
    for (const sc of ALL_SCENARIOS) {
      store[keyOf(mid, sc)] = normalizeWeight({
        masterId: mid,
        scenario: sc,
        weight: DEFAULT_WEIGHT,
        wins: 0,
        losses: 0,
        neutrals: 0,
        totalTrades: 0,
        lastUpdated: now,
      });
    }
  }
  weightsCache = store;
  await saveWeightsToDisk();
}

/**
 * 交易平仓后更新权重：
 * - correctSignal: 最终市场方向（bullish/bearish/neutral）
 * - signals: 每个 master 给出的原始信号和置信度
 *
 * 规则：
 * - 信号与 correct 同向   → 奖励：weight *= reward ^ (0.5 + confidence)
 * - 信号与 correct 反向   → 惩罚：weight *= penalty ^ (0.5 + confidence)
 * - 信号为 neutral 或 null → 权重不变，但 neutrals 计数+1
 * - 权重钳位 [MIN_WEIGHT, MAX_WEIGHT]
 */
export async function updateWeights(params: {
  caseId: string;
  scenario: ScenarioType;
  correctSignal: "bullish" | "bearish" | "neutral";
  signals: Record<MasterId, { signal: "bullish" | "bearish" | "neutral"; confidence: number } | null>;
}): Promise<void> {
  const { scenario, correctSignal, signals } = params;
  const store = await ensureCache();
  const now = new Date().toISOString();

  const opposite = (s: "bullish" | "bearish"): "bullish" | "bearish" =>
    s === "bullish" ? "bearish" : "bullish";

  for (const mid of Object.keys(signals) as MasterId[]) {
    const sig = signals[mid];
    const mw = getOrCreate(store, mid, scenario);
    mw.lastUpdated = now;
    mw.totalTrades += 1;

    if (!sig || sig.signal === "neutral" || correctSignal === "neutral") {
      mw.neutrals += 1;
      continue;
    }

    const conf = clamp(sig.confidence, 0, 1);
    const exponent = CONF_BASE + CONF_RANGE * conf;

    if (sig.signal === correctSignal) {
      mw.weight *= Math.pow(REWARD_MULTIPLIER, exponent);
      mw.wins += 1;
    } else if (sig.signal === opposite(correctSignal)) {
      mw.weight *= Math.pow(PENALTY_MULTIPLIER, exponent);
      mw.losses += 1;
    } else {
      // 信号为 neutral 时已在上面处理；这里防御
      mw.neutrals += 1;
    }

    mw.weight = clamp(mw.weight, MIN_WEIGHT, MAX_WEIGHT);
  }

  enqueueSave();
}

/**
 * 同步读取版（在已经 ensureCache 过的调用链中可以直接用，不做 IO）。
 * 注意：首次调用必须先 await 过任意异步 API 触发加载。
 */
export function getWeightSync(masterId: MasterId, scenario: ScenarioType): number {
  if (!weightsCache) return DEFAULT_WEIGHT;
  const k = keyOf(masterId, scenario);
  return weightsCache[k]?.weight ?? DEFAULT_WEIGHT;
}

/** 等待当前正在排队的写盘完成（测试/关机时用）。 */
export async function flushWeights(): Promise<void> {
  await writeQueue;
}
