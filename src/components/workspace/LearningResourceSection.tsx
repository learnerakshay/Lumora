import { BookOpen, ExternalLink, Globe2, ListVideo, PlayCircle } from 'lucide-react';
import type { LearningResourceRecommendation } from '../../lib/resources/domain';

interface LearningResourceSectionProps {
  resources: readonly LearningResourceRecommendation[];
}

function typeIcon(type: LearningResourceRecommendation['type']) {
  if (type === 'playlist') return <ListVideo className="h-3.5 w-3.5" />;
  if (type === 'video') return <PlayCircle className="h-3.5 w-3.5" />;
  if (type === 'article' || type === 'docs') return <Globe2 className="h-3.5 w-3.5" />;
  return <BookOpen className="h-3.5 w-3.5" />;
}

export function LearningResourceSection({ resources }: LearningResourceSectionProps) {
  if (resources.length === 0) return null;
  return (
    <section
      className="mt-5 border-t border-violet-900/35 pt-4"
      aria-label="Recommended learning resources"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-violet-800/60 bg-violet-950/35 text-violet-300">
          <BookOpen className="h-3.5 w-3.5" />
        </span>
        <div>
          <h3 className="text-[11px] font-semibold text-slate-200">Continue learning</h3>
          <p className="text-[10px] text-slate-500">Optional resources related to your goal</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {resources.map((resource) => (
          <article
            key={`${resource.id}-${resource.url}`}
            className="group/resource flex min-w-0 flex-col rounded-xl border border-slate-800/90 bg-slate-900/45 p-3 transition hover:border-violet-700/65 hover:bg-slate-900/80"
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-950/75 text-violet-300">
                {typeIcon(resource.type)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-[11px] font-semibold leading-4 text-slate-200 transition group-hover/resource:text-white"
                  >
                    {resource.title}
                  </a>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${resource.title}`}>
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-600 transition group-hover/resource:text-violet-300" />
                  </a>
                </div>
                <p className="mt-1 truncate text-[10px] text-slate-500">
                  {resource.creator} · {resource.provider} · {resource.platform}
                </p>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-400">
              {resource.reason}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-medium uppercase tracking-wide text-slate-500">
              <span>{resource.type}</span>
              <span aria-hidden="true">·</span>
              <span>{resource.accessType}</span>
              {resource.deliveryMode && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{resource.deliveryMode === 'LIVE' ? 'Live snapshot' : 'Recorded'}</span>
                </>
              )}
              {resource.language && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{resource.language === 'hi' ? 'Hindi' : resource.language === 'en' ? 'English' : 'Mixed'}</span>
                </>
              )}
            </div>
            {resource.offer && (
              <a
                href={resource.offer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 self-start text-[10px] font-medium text-violet-300 transition hover:text-violet-200"
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
