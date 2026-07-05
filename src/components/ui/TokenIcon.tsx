import clsx from "clsx";

export function TokenIcon({ symbol, size = 36 }: { symbol: string; size?: number }) {
  const normalized =
    symbol === "Uniswap"
      ? "UNI"
      : symbol === "MakerDAO"
        ? "MKR"
        : symbol === "Curve"
          ? "CRV"
          : symbol === "Tencent" || symbol === "0700.HK"
            ? "TCE"
            : symbol === "Alibaba" || symbol === "9988.HK"
              ? "BABA"
              : symbol.replace("$", "").slice(0, 4).toUpperCase();
  const gradient = tokenPalette[normalized] ?? fallbackPalette[hashSymbol(normalized) % fallbackPalette.length];

  return (
    <span
      className={clsx("grid shrink-0 place-items-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white shadow-sm", gradient)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.floor(size / 3.5)) }}
    >
      {normalized.slice(0, 3)}
    </span>
  );
}

const tokenPalette: Record<string, string> = {
  ETH: "from-blue-600 to-sky-400",
  BTC: "from-orange-500 to-amber-300",
  SOL: "from-emerald-500 to-violet-500",
  ZEC: "from-amber-600 to-yellow-300",
  AAVE: "from-purple-500 to-sky-400",
  UNI: "from-pink-500 to-fuchsia-400",
  MKR: "from-teal-600 to-emerald-300",
  CRV: "from-red-500 to-blue-500",
  TCE: "from-sky-500 to-blue-700",
  BABA: "from-orange-500 to-red-500",
  HKD: "from-red-600 to-red-400"
};

const fallbackPalette = [
  "from-[#007acc] to-[#6366F1]",
  "from-emerald-500 to-sky-400",
  "from-rose-500 to-amber-400",
  "from-violet-500 to-sky-400",
  "from-teal-500 to-lime-400",
  "from-slate-500 to-slate-300"
];

function hashSymbol(value: string) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
