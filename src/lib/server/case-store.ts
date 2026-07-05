/**
 * flowEdge — 案件/组合/溯源持久化
 *
 * 参考 ChainPulse agent-store 的原子写入模式：
 * - 写临时文件 + rename 保证原子性
 * - 写入队列避免并发写
 * - 启动时预热 cache，之后所有读操作都是同步 O(1)
 * - 写操作入队后 fire-and-forget，调用方无需 await
 */

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TradeCase, Portfolio, TraceRecord } from "@/lib/types";
import { createPortfolio } from "@/lib/server/portfolio-manager";
import { hashJson } from "@/lib/server/xapi-trace";

export { hashJson };

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

interface CaseStoreSnapshot {
  version: 1;
  cases: Record<string, TradeCase>;
  portfolio: Portfolio;
  traces: Record<string, TraceRecord[]>; // caseId -> TraceRecord[]
}

const emptySnapshot = (): CaseStoreSnapshot => ({
  version: 1,
  cases: {},
  portfolio: createPortfolio(),
  traces: {},
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const defaultStoreDir = ".flowedge";
const defaultStorePath = ".flowedge/store.json";
let storePathOverride: string | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();
let cache: CaseStoreSnapshot = emptySnapshot();
let cachePrimed = false;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getStorePath(): string {
  return storePathOverride || defaultStorePath;
}

function getStoreDir(): string {
  if (storePathOverride) {
    const parsed = path.parse(storePathOverride);
    return parsed.dir || ".";
  }
  return defaultStoreDir;
}

// For tests only
export function setCaseStorePathForTest(filePath: string | null): void {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    throw new Error("setCaseStorePathForTest can only be used in tests");
  }
  storePathOverride = filePath;
  cache = emptySnapshot();
  cachePrimed = false;
}

// ---------------------------------------------------------------------------
// Disk IO (internal)
// ---------------------------------------------------------------------------

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

async function readFromDisk(): Promise<CaseStoreSnapshot> {
  const filePath = getStorePath();
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<CaseStoreSnapshot>;
    return {
      version: 1,
      cases:
        parsed.cases && typeof parsed.cases === "object"
          ? (parsed.cases as Record<string, TradeCase>)
          : {},
      portfolio: parsed.portfolio ?? createPortfolio(),
      traces:
        parsed.traces && typeof parsed.traces === "object"
          ? (parsed.traces as Record<string, TraceRecord[]>)
          : {},
    };
  } catch (error) {
    if (isFileNotFound(error)) return emptySnapshot();
    throw error;
  }
}

async function writeToDisk(): Promise<void> {
  const filePath = getStorePath();
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(getStoreDir(), { recursive: true });
  try {
    await writeFile(tempPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

function enqueueWrite(): void {
  const snapshot = cache;
  const task = writeQueue.then(async () => {
    if (cache !== snapshot) return;
    await writeToDisk();
  });
  writeQueue = task.catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Init & priming
// ---------------------------------------------------------------------------

/**
 * 初始化存储：确保目录存在，首次写盘。
 * 服务启动时调用一次即可，后续读写都走内存 cache。
 */
export function initStore(): void {
  // Synchronously kick off a priming read in the background.
  // We don't wait for it — callers that need the latest should use primeStore() first.
  if (!cachePrimed) {
    primeStore().catch(() => undefined);
  }
}

/**
 * 异步预热：从磁盘加载到 cache。await 后所有同步 API 可用。
 */
export async function primeStore(): Promise<void> {
  cache = await readFromDisk();
  cachePrimed = true;
}

/**
 * 等待当前队列写完（关机/测试用）。
 */
export async function flushStore(): Promise<void> {
  await writeQueue;
}

// ---------------------------------------------------------------------------
// Cases (synchronous API)
// ---------------------------------------------------------------------------

export function saveCase(tradeCase: TradeCase): void {
  cache.cases[tradeCase.caseId] = tradeCase;
  enqueueWrite();
}

export function getCase(caseId: string): TradeCase | undefined {
  return cache.cases[caseId];
}

export function listCases(filters?: {
  status?: string;
  symbol?: string;
  limit?: number;
}): TradeCase[] {
  let items = Object.values(cache.cases);
  if (filters?.symbol) {
    const sym = filters.symbol.toUpperCase();
    items = items.filter((c) => c.symbol.toUpperCase() === sym);
  }
  if (filters?.status) {
    items = items.filter((c) => {
      // TradeCase doesn't have direct status; check outcome/direction as a loose filter
      return true;
    });
  }
  items.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  if (filters?.limit && filters.limit > 0) items = items.slice(0, filters.limit);
  return items;
}

export function updateCase(caseId: string, updates: Partial<TradeCase>): TradeCase {
  const existing = cache.cases[caseId];
  if (!existing) {
    throw new Error(`updateCase: case ${caseId} not found`);
  }
  const next: TradeCase = { ...existing, ...updates };
  cache.cases[caseId] = next;
  enqueueWrite();
  return next;
}

// ---------------------------------------------------------------------------
// Portfolio (synchronous)
// ---------------------------------------------------------------------------

export function savePortfolio(portfolio: Portfolio): void {
  cache.portfolio = portfolio;
  enqueueWrite();
}

export function loadPortfolio(): Portfolio {
  if (!cache.portfolio || typeof cache.portfolio.cash !== "number") {
    cache.portfolio = createPortfolio();
    enqueueWrite();
  }
  return cache.portfolio;
}

// ---------------------------------------------------------------------------
// Traces (synchronous)
// ---------------------------------------------------------------------------

export function saveTrace(trace: TraceRecord): void {
  const arr = cache.traces[trace.caseId] ?? [];
  arr.push(trace);
  cache.traces[trace.caseId] = arr;
  enqueueWrite();
}

export function saveTraces(traces: TraceRecord[]): void {
  if (traces.length === 0) return;
  for (const t of traces) {
    const arr = cache.traces[t.caseId] ?? [];
    arr.push(t);
    cache.traces[t.caseId] = arr;
  }
  enqueueWrite();
}

export function getTraces(caseId?: string): TraceRecord[] {
  if (caseId) return cache.traces[caseId] ?? [];
  const all: TraceRecord[] = [];
  for (const list of Object.values(cache.traces)) all.push(...list);
  all.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return all;
}

// Auto-prime on module load (best-effort; if disk IO fails we fall back to empty snapshot)
readFromDisk()
  .then((snap) => {
    cache = snap;
    cachePrimed = true;
  })
  .catch(() => {
    cache = emptySnapshot();
    cachePrimed = true;
  });

// Avoid unused import warning when hashJson is tree-shaken
void hashJson;
