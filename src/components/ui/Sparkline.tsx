import clsx from "clsx";

export function Sparkline({ values, color = "#007acc", width = 120, height = 40 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * innerW + pad;
      const y = height - pad - ((value - min) / range) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  // Build area fill
  const firstX = pad;
  const lastX = innerW + pad;
  const baseline = height - pad;
  const areaPath = `M ${firstX},${baseline} L ${points.split(" ").join(" L ")} L ${lastX},${baseline} Z`;

  return (
    <svg className={clsx("inline-block")} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="sparkline">
      <defs>
        <linearGradient id={`spark-fill-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-fill-${color.replace(/[^a-z0-9]/gi, "")})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
