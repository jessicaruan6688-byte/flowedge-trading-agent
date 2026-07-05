import { CopyButton } from "./CopyButton";
import { cardClassSmall } from "./styles";
import clsx from "clsx";

export function HashRow({
  label,
  value,
  onCopy,
  copiedKey
}: {
  label: string;
  value: string;
  onCopy: (text: string, label: string) => void;
  copiedKey: string;
}) {
  return (
    <div className={clsx(cardClassSmall, "p-3")}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-[#737373]">{label}</p>
        <CopyButton label={label} copied={copiedKey === label} onClick={() => onCopy(value, label)} />
      </div>
      <p className="mono break-all text-xs text-[#0A0A0A]" spellCheck={false}>
        {value}
      </p>
    </div>
  );
}
