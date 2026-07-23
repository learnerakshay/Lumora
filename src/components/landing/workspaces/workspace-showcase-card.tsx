import type { LucideIcon } from "lucide-react";
import { WorkspaceMetadata } from "@/components/landing/workspaces/workspace-metadata";
import { WorkspacePreview } from "@/components/landing/workspaces/workspace-preview";
type Props = {
  description: string;
  icon: LucideIcon;
  kind: "ai" | "ml" | "markets" | "history";
  metadata: string[];
  title: string;
};
export function WorkspaceShowcaseCard({
  description,
  icon: Icon,
  kind,
  metadata,
  title,
}: Props) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-[#101322]/72 p-4 shadow-[0_16px_32px_rgb(0_0_0_/_18%)] transition duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/45">
      <WorkspacePreview kind={kind} />
      <div className="mt-5 flex items-center gap-2">
        <Icon aria-hidden className="text-[#c9b0ff]" size={18} />
        <h3 className="text-base font-medium text-white">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
        {description}
      </p>
      <WorkspaceMetadata items={metadata} />
    </article>
  );
}
