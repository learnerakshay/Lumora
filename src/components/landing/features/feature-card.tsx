import type { LucideIcon } from "lucide-react";
type Props = {
  description: string;
  icon: LucideIcon;
  index: number;
  title: string;
};
export function FeatureCard({ description, icon: Icon, index, title }: Props) {
  return (
    <article className="group min-h-72 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgb(18_19_33_/_92%),rgb(10_12_21_/_88%))] p-5 shadow-[0_14px_28px_rgb(0_0_0_/_18%)] transition duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/45">
      <div
        aria-hidden
        className="relative h-20 overflow-hidden rounded-xl border border-white/8 bg-[radial-gradient(circle_at_30%_30%,rgb(124_92_255_/_20%),transparent_44%)]"
      >
        <Icon
          className="absolute top-4 left-4 text-[#c9b0ff] transition-transform duration-300 group-hover:translate-x-1"
          size={25}
        />
        <span className="absolute right-4 bottom-4 h-8 w-14 rounded-md border border-[var(--accent-cyan)]/20" />
        <span className="absolute right-8 bottom-8 h-px w-8 bg-[var(--accent)]/65" />
        <span className="absolute top-4 right-5 h-1.5 w-1.5 rounded-full bg-[#d9c7ff]" />
        <span className="sr-only">Feature visual motif {index + 1}</span>
      </div>
      <h3 className="mt-5 text-base font-medium text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
        {description}
      </p>
    </article>
  );
}
