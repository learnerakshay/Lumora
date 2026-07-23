export function WorkspaceMetadata({ items }: { items: string[] }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          className="rounded-full border border-white/10 px-2.5 py-1 text-[.68rem] text-[var(--text-secondary)]"
          key={item}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
