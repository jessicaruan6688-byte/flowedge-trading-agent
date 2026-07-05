import { inputClass } from "./styles";

export function Field({ label, defaultValue, name }: { label: string; defaultValue: string; name: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-[#444]">{label}</span>
      <input className={inputClass} name={name} defaultValue={defaultValue} autoComplete="off" spellCheck={false} />
    </label>
  );
}

export function SelectField({ label, options, name }: { label: string; options: string[]; name: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-[#444]">{label}</span>
      <select className={inputClass} name={name} defaultValue={options[0]} autoComplete="off">
        {options.map((option) => (
          <option key={option} className="bg-white text-[#0A0A0A]">{option}</option>
        ))}
      </select>
    </label>
  );
}

export function TextareaField({
  label,
  name,
  defaultValue,
  rows = 3
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-[#444]">{label}</span>
      <textarea
        className="min-h-[80px] w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#0A0A0A] placeholder:text-[#B3B3B3] focus:border-[#007acc] focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 transition-colors resize-y"
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        spellCheck={false}
      />
    </label>
  );
}
