import clsx from "clsx";
import { cardClass } from "./styles";

export function InfoPanel({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className={clsx(cardClass, "p-4")}>
      <h2 className="mb-3 text-sm font-semibold text-[#0A0A0A]">{title}</h2>
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid min-w-0 gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-4">
            <dt className="text-[#737373]">{label}</dt>
            <dd className="mono min-w-0 break-all text-left text-[#0A0A0A] sm:text-right" spellCheck={false}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
