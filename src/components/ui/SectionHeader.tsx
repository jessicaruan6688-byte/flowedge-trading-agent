import clsx from "clsx";

export function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3">
      <h2 className="text-sm font-semibold text-[#0A0A0A]">{title}</h2>
      {action ? <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-[#444] border border-[#E5E5E5]">{action}</span> : null}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-lg border border-[#E0E0E0] bg-white shadow-sm", className)}>
      {title ? (
        <div className="flex items-center justify-between border-b border-[#E5E5E5] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
