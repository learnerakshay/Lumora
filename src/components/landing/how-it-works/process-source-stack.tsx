import { FileText, Globe2, NotebookTabs, Type, Youtube } from "lucide-react";
const sources = [
  [FileText, "PDFs"],
  [Globe2, "Websites"],
  [Youtube, "YouTube"],
  [NotebookTabs, "Notes"],
  [Type, "Text & More"],
] as const;
export function ProcessSourceStack() {
  return (
    <div
      aria-label="Collect sources"
      className="grid gap-1 rounded-2xl border border-white/10 bg-[#101322]/70 p-2 shadow-[0_16px_32px_rgb(0_0_0_/_22%)] backdrop-blur-sm"
    >
      {sources.map(([Icon, label]) => (
        <div
          className="flex min-h-10 items-center gap-3 border-b border-white/8 px-3 text-sm text-white/95 last:border-0"
          key={label}
        >
          <Icon aria-hidden className="text-[#c9b0ff]" size={18} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
