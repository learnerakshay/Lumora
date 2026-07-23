import {
  BookOpen,
  BrainCircuit,
  FileSearch,
  MessageCircle,
  Network,
  Podcast,
  Route,
} from "lucide-react";
const outputs = [
  [MessageCircle, "AI Conversations"],
  [Network, "Knowledge Graph"],
  [FileSearch, "Source Insights"],
  [BookOpen, "Study Guides"],
  [BrainCircuit, "Flashcards"],
  [Podcast, "Podcasts"],
  [Route, "Learning Roadmaps"],
] as const;
export function ProcessOutputStack() {
  return (
    <div
      aria-label="Transform knowledge into outputs"
      className="grid gap-1 rounded-2xl border border-white/10 bg-[#101322]/70 p-2 shadow-[0_16px_32px_rgb(0_0_0_/_22%)] backdrop-blur-sm"
    >
      {outputs.map(([Icon, label]) => (
        <div
          className="flex min-h-9 items-center gap-3 border-b border-white/8 px-3 text-sm text-white/90 last:border-0"
          key={label}
        >
          <Icon aria-hidden className="text-[#c9b0ff]" size={16} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
