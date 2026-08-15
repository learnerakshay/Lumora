import { BookOpen, ExternalLink, FileText, Globe2, GraduationCap, ListVideo, PlayCircle, Radio } from 'lucide-react';
import type { LearningResourceRecommendation } from '../../lib/resources/domain';

interface LearningResourceSectionProps {
  resources: readonly LearningResourceRecommendation[];
}

function typeIcon(type: LearningResourceRecommendation['type']) {
  if (type === 'playlist') return <ListVideo className="h-3.5 w-3.5" />;
  if (type === 'video') return <PlayCircle className="h-3.5 w-3.5" />;
  if (type === 'cohort') return <Radio className="h-3.5 w-3.5" />;
  if (type === 'article' || type === 'docs') return type === 'docs' ? <FileText className="h-3.5 w-3.5" /> : <Globe2 className="h-3.5 w-3.5" />;
  return <GraduationCap className="h-3.5 w-3.5" />;
}

function typeLabel(resource: LearningResourceRecommendation): string {
  if (resource.platform === 'Udemy') return 'Udemy course';
  if (resource.type === 'cohort') return 'Cohort';
  if (resource.type === 'digital-product') return 'Learning product';
  return resource.type;
}

export function LearningResourceSection({ resources }: LearningResourceSectionProps) {
  if (resources.length === 0) return null;
  return (
    <section
      className="mt-5 border-t border-violet-900/35 pt-4"
      aria-label="Recommended learning resources"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.08)]">
          <BookOpen className="h-3.5 w-3.5" />
        </span>
        <div>
          <h3 className="text-[11px] font-semibold text-slate-100">Continue learning</h3>
          <p className="text-[10px] text-slate-500">Optional resources related to your goal</p>
        </div>
        <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/30 to-transparent" aria-hidden="true" />
      </div>
      <div className="grid gap-2.5 md:grid-cols-2">
        {resources.map((resource) => (
          <article
            key={`${resource.id}-${resource.url}`}
            className="group/resource relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-700/70 bg-gradient-to-br from-slate-900/85 to-[#101722] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_8px_22px_rgba(0,0,0,0.12)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/35 hover:shadow-[inset_0_1px_0_rgba(103,232,249,0.07),0_12px_28px_rgba(0,0,0,0.2)] focus-within:border-cyan-400/45"
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/15 bg-cyan-400/[0.06] text-cyan-300">
                {typeIcon(resource.type)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 rounded-sm text-[12px] font-semibold leading-4.5 text-slate-100 transition group-hover/resource:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                  >
                    {resource.title}
                  </a>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${resource.title}`} className="rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70">
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-600 transition group-hover/resource:text-cyan-300" />
                  </a>
                </div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">
                  {resource.creator} · {resource.provider} · {resource.platform}
                </p>
              </div>
            </div>
            <p className="mt-2.5 line-clamp-2 text-[10px] leading-4 text-slate-400">
              {resource.reason}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[9px] font-medium uppercase tracking-wide text-slate-500">
              <span className="rounded-md border border-slate-700/80 bg-slate-950/45 px-1.5 py-0.5 text-slate-400">{typeLabel(resource)}</span>
              {resource.accessType !== 'unknown' && <span className={resource.accessType === 'paid' ? 'rounded-md border border-amber-400/20 bg-amber-400/[0.06] px-1.5 py-0.5 text-amber-200' : 'rounded-md border border-slate-700/80 bg-slate-950/45 px-1.5 py-0.5'}>{resource.accessType}</span>}
              {resource.deliveryMode && (
                <>
                  <span className={resource.deliveryMode === 'LIVE' ? 'rounded-md border border-cyan-400/20 bg-cyan-400/[0.06] px-1.5 py-0.5 text-cyan-200' : 'rounded-md border border-slate-700/80 bg-slate-950/45 px-1.5 py-0.5'}>{resource.deliveryMode === 'LIVE' ? 'Live snapshot' : 'Recorded'}</span>
                </>
              )}
              {resource.language && (
                <>
                  <span>{resource.language === 'hi' ? 'Hindi' : resource.language === 'en' ? 'English' : 'Mixed'}</span>
                </>
              )}
            </div>
            {resource.offer && (
              <a
                href={resource.offer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 self-start rounded-md border border-cyan-400/20 bg-cyan-400/[0.04] px-2 py-1 text-[10px] font-medium text-cyan-300 transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.09] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
              >
                {resource.offer.label}
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
