export function PageHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="max-w-4xl">
      {eyebrow ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#007acc]">{eyebrow}</p>
      ) : null}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0A0A0A] md:text-[30px] md:leading-tight">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#737373]">{description}</p>
      ) : null}
    </div>
  );
}
