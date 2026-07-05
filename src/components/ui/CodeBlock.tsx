import { Code2 } from "lucide-react";

export function CodeBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white">
      <div className="flex items-center gap-2 border-b border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2 text-sm font-semibold text-[#0A0A0A]">
        <Code2 aria-hidden className="h-4 w-4 text-[#737373]" />
        {title}
      </div>
      <pre className="mono thin-scrollbar max-h-72 overflow-auto bg-[#FAFAFA] p-4 text-xs leading-5 text-[#1F2937]" spellCheck={false}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
