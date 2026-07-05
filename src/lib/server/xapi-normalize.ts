import type { XApiActionSchema, XApiActionSearchResult, XApiCallResult } from "@/lib/xapi-types";

export function normalizeSearchOutput(raw: unknown, query: string): XApiActionSearchResult[] {
  const candidates = Array.isArray(raw) ? raw : getArrayProperty(raw, ["actions", "data", "results", "items"]);
  if (!candidates) return [];

  return candidates
    .map((item) => normalizeSearchItem(item))
    .filter((item): item is XApiActionSearchResult => Boolean(item?.action));
}

export function normalizeSchemaOutput(action: string, raw: unknown): XApiActionSchema {
  const record = isRecord(raw) ? raw : {};
  const input = getInputSchema(record);
  const capability = typeof record.capability === "string" ? record.capability : inferCapability(action);
  const schemaVersion = typeof record.schemaVersion === "string" ? record.schemaVersion : typeof record.version === "string" ? record.version : undefined;

  return {
    action,
    capability,
    schemaVersion,
    input,
    raw
  };
}

export function normalizeCallOutput(action: string, input: Record<string, unknown>, raw: unknown): XApiCallResult {
  const output = isRecord(raw) ? raw : Array.isArray(raw) ? { data: raw } : { value: raw };
  return {
    action,
    capability: inferCapability(action),
    output,
    outputPreview: summarizeOutputRich(raw, output),
    raw: {
      input,
      output
    }
  };
}

function summarizeOutputRich(raw: unknown, output: Record<string, unknown>): string {
  // Handle arrays directly (crypto token price returns array)
  if (Array.isArray(raw)) {
    const first = raw[0] as Record<string, unknown> | undefined;
    if (first && typeof first.symbol === "string") {
      return `${first.symbol}: $${first.current_price_usd ?? first.price ?? "?"} (24h: ${first.price_change_24h ?? "?"}%)`;
    }
    return `${raw.length} items`;
  }
  return summarizeOutput(output);
}

function normalizeSearchItem(item: unknown): XApiActionSearchResult | null {
  if (typeof item === "string") {
    return {
      action: item,
      capability: inferCapability(item)
    };
  }
  if (!isRecord(item)) return null;

  const action = getStringProperty(item, ["action", "actionId", "id", "name"]);
  if (!action) return null;

  return {
    action,
    capability: getStringProperty(item, ["capability", "source", "category"]) ?? inferCapability(action),
    description: getStringProperty(item, ["description", "summary", "title"])
  };
}

function getInputSchema(record: Record<string, unknown>) {
  const direct = record.input;
  if (isRecord(direct)) return direct;
  const schema = record.schema;
  if (isRecord(schema)) {
    if (isRecord(schema.input)) return schema.input;
    if (isRecord(schema.properties)) return schema.properties;
  }
  // MCP GET format: {parameters: {type: "object", properties: {...}, required: [...]}}
  const params = record.parameters;
  if (isRecord(params)) {
    if (isRecord(params.properties)) return params.properties as Record<string, unknown>;
    return params;
  }
  return {};
}

export function getSchemaInputKeys(input?: Record<string, unknown>): string[] {
  if (!input) return [];
  // If normalized from MCP (properties object), keys are field names directly
  return Object.keys(input);
}

function getArrayProperty(value: unknown, keys: string[]) {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
  }
  return null;
}

function getStringProperty(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  return undefined;
}

function inferCapability(action: string) {
  const prefix = action.split(".")[0];
  const map: Record<string, string> = {
    ai: "AI",
    crypto: "Crypto",
    news: "News",
    reddit: "Reddit",
    sms: "SMS",
    tiktok: "TikTok",
    twitter: "Twitter / X",
    web: "Web"
  };
  return map[prefix] ?? "xAPI";
}

function summarizeOutput(output: Record<string, unknown>): string {
  // AI chat completion response
  if (Array.isArray(output.choices)) {
    const first = output.choices[0] as Record<string, unknown> | undefined;
    const msg = (first?.message as Record<string, unknown> | undefined)?.content;
    if (typeof msg === "string") return msg.slice(0, 160);
  }
  // AI summarize response
  if (typeof (output.data as Record<string, unknown> | undefined)?.summary === "string") {
    return ((output.data as Record<string, unknown>).summary as string).slice(0, 160);
  }
  // Twitter response
  if (Array.isArray(output.tweets)) {
    const firstTweet = output.tweets[0] as Record<string, unknown> | undefined;
    const text = typeof firstTweet?.text === "string" ? firstTweet.text.slice(0, 120) : "";
    return `${output.tweets.length} tweets — ${text}...`.slice(0, 160);
  }
  // News response
  if (Array.isArray(output.news)) {
    const firstNews = output.news[0] as Record<string, unknown> | undefined;
    const title = typeof firstNews?.title === "string" ? firstNews.title : "";
    return `${output.news.length} news articles — ${title}`.slice(0, 160);
  }
  // Web search response (organic results)
  if (Array.isArray(output.organic)) {
    const first = output.organic[0] as Record<string, unknown> | undefined;
    const title = typeof first?.title === "string" ? first.title : "";
    return `${output.organic.length} results — ${title}`.slice(0, 160);
  }
  // Crypto token price (array of tokens)
  if (Array.isArray(output)) {
    const first = (output as Record<string, unknown>[])[0];
    if (first && typeof first.symbol === "string") {
      return `${first.symbol}: $${first.current_price_usd ?? first.price ?? "?"} (${first.price_change_24h ?? "?"}% 24h)`.slice(0, 160);
    }
  }
  // If output is wrapped in data key
  if (Array.isArray(output.data)) {
    const arr = output.data as Record<string, unknown>[];
    const first = arr[0];
    if (first && typeof first.symbol === "string") {
      return `${first.symbol}: $${first.current_price_usd ?? "?"} (${first.price_change_24h ?? "?"}% 24h)`.slice(0, 160);
    }
  }
  // AI summary response
  if (typeof output.summary === "string") return output.summary.slice(0, 160);
  if (typeof output.text === "string") return output.text.slice(0, 160);
  // Fallback to keys
  const keys = Object.keys(output);
  if (keys.length === 0) return "empty JSON response";
  return `${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "..." : ""}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
