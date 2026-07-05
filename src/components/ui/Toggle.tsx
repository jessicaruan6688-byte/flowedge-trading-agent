"use client";

import { useState } from "react";
import clsx from "clsx";

export function Toggle({ label, defaultChecked = false, name, help }: { label: string; defaultChecked?: boolean; name: string; help?: string }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      name={name}
      className={clsx(
        "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-[#FAFAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007acc]/30 active:scale-[0.99]",
        checked ? "border-[#007acc]/40 bg-[#E6F2FA]/60" : "border-[#E5E5E5] bg-white"
      )}
      onClick={() => setChecked((value) => !value)}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[#0A0A0A]">{label}</span>
        {help ? <span className="mt-0.5 block text-xs text-[#737373]">{help}</span> : null}
      </span>
      <span className={clsx("relative ml-3 h-6 w-11 shrink-0 rounded-full border transition-colors", checked ? "border-[#007acc] bg-[#007acc]" : "border-[#D9D9D9] bg-[#D9D9D9]")}>
        <span className={clsx("absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
      </span>
    </button>
  );
}
