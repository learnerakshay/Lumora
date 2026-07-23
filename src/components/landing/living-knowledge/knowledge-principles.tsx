import { Link2, Sparkles, Zap } from "lucide-react";
const rows = [
  [Link2, "Connected by context", "Relationships become visible."],
  [Sparkles, "Evolves with every source", "Understanding compounds over time."],
  [Zap, "Built for active learning", "Knowledge stays ready to use."],
] as const;
export function KnowledgePrinciples() {
  return (
    <div className="mt-9 grid gap-5">
      {rows.map(([Icon, title, text]) => (
        <div className="flex gap-3" key={title}>
          <Icon aria-hidden className="mt-0.5 text-[#c9b0ff]" size={18} />
          <div>
            <p className="text-sm font-medium text-white">{title}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
