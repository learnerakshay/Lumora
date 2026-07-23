type Props = { kind: "ai" | "ml" | "markets" | "history" };
export function WorkspacePreview({ kind }: Props) {
  const visual = {
    ai: [
      "left-[16%] top-[28%]",
      "left-[45%] top-[14%]",
      "right-[13%] top-[42%]",
    ],
    ml: [
      "left-[16%] top-[22%]",
      "left-[47%] top-[42%]",
      "right-[14%] top-[18%]",
    ],
    markets: [
      "left-[14%] top-[58%]",
      "left-[45%] top-[31%]",
      "right-[15%] top-[17%]",
    ],
    history: [
      "left-[15%] top-[30%]",
      "left-[47%] top-[55%]",
      "right-[14%] top-[28%]",
    ],
  }[kind];
  return (
    <div
      aria-hidden
      className="relative h-32 overflow-hidden rounded-xl border border-white/8 bg-[radial-gradient(circle_at_50%_30%,rgb(124_92_255_/_18%),transparent_55%)]"
    >
      <span className="absolute top-1/2 left-[18%] h-px w-[64%] -rotate-12 bg-[var(--accent)]/35" />
      <span className="absolute top-[28%] left-[28%] h-px w-[45%] rotate-[18deg] bg-[var(--accent-cyan)]/20" />
      {visual.map((pos, i) => (
        <span
          className={`absolute grid h-8 w-8 place-items-center rounded-full border border-[#c9b0ff]/45 bg-[#17142c] text-[.55rem] text-white ${pos}`}
          key={pos}
        >
          {["S", "C", "I"][i]}
        </span>
      ))}
      <span className="absolute right-3 bottom-3 h-7 w-16 rounded-md border border-white/10 bg-white/[.04]" />
    </div>
  );
}
