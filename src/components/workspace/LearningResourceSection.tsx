import type React from 'react';
import { BookOpen, ExternalLink, FileText, Globe2, GraduationCap, ListVideo, PlayCircle, Radio, Youtube } from 'lucide-react';
import type { LearningResourceRecommendation, ResourcePlatform } from '../../lib/resources/domain';

interface LearningResourceSectionProps {
  resources: readonly LearningResourceRecommendation[];
}

// Platform badge styling keyed off the real, already-resolved `platform`
// field (YouTube/Udemy/Cohort/Website) — no fabricated per-provider colors,
// just a distinct treatment per real platform value.
const PLATFORM_BADGE: Record<ResourcePlatform, { tone: string; icon: React.ComponentType<{ className?: string }> }> = {
  YouTube: { tone: 'border-red-500/25 bg-red-500/10 text-red-300', icon: Youtube },
  Udemy: { tone: 'border-violet-400/25 bg-violet-400/10 text-violet-300', icon: GraduationCap },
  Cohort: { tone: 'border-cyan-400/25 bg-gradient-to-r from-cyan-400/10 to-violet-400/10 text-cyan-200', icon: Radio },
  Website: { tone: 'border-slate-600/40 bg-slate-800/40 text-slate-300', icon: Globe2 },
};

function typeIcon(type: LearningResourceRecommendation['type']) {
  if (type === 'playlist') return <ListVideo className="h-3.5 w-3.5" />;
  if (type === 'video') return <PlayCircle className="h-3.5 w-3.5" />;
  if (type === 'cohort') return <Radio className="h-3.5 w-3.5" />;
  if (type === 'article' || type === 'docs') return type === 'docs' ? <FileText className="h-3.5 w-3.5" /> : <Globe2 className="h-3.5 w-3.5" />;
  return <GraduationCap className="h-3.5 w-3.5" />;
}

// Video/playlist resources are YouTube-sourced, so their icon well gets the
// platform's red accent; everything else keeps the neutral cyan treatment.
function isVideoResource(type: LearningResourceRecommendation['type']): boolean {
  return type === 'video' || type === 'playlist';
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
      <div className={`grid gap-2.5 sm:grid-cols-2 ${resources.length >= 3 ? 'xl:grid-cols-3' : ''}`}>
        {resources.map((resource) => {
          const platformBadge = PLATFORM_BADGE[resource.platform];
          const PlatformIcon = platformBadge.icon;
          return (
          <article
            key={`${resource.id}-${resource.url}`}
            className="group/resource relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-700/70 bg-gradient-to-br from-slate-900/85 to-[#101722] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_8px_22px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] focus-within:border-cyan-400/45"
          >
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border p-2.5 ${isVideoResource(resource.type) ? 'border-red-500/20 bg-red-500/10 text-red-400' : 'border-cyan-400/15 bg-cyan-400/[0.06] text-cyan-300'}`}>
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
              <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${platformBadge.tone}`}>
                <PlatformIcon className="h-2.5 w-2.5" />
                {resource.platform}
              </span>
              <span className="rounded-md border border-cyan-400/20 bg-cyan-400/[0.06] px-1.5 py-0.5 text-cyan-200 shadow-[0_0_6px_rgba(34,211,238,0.15)]">{typeLabel(resource)}</span>
              {resource.accessType !== 'unknown' && (
                <span className={
                  resource.accessType === 'paid'
                    ? 'rounded-md border border-amber-400/20 bg-amber-400/[0.06] px-1.5 py-0.5 text-amber-200 shadow-[0_0_6px_rgba(251,191,36,0.15)]'
                    : 'rounded-md border border-emerald-400/20 bg-emerald-400/[0.06] px-1.5 py-0.5 text-emerald-200 shadow-[0_0_6px_rgba(52,211,153,0.15)]'
                }>{resource.accessType}</span>
              )}
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
          );
        })}
      </div>
    </section>
  );
}
