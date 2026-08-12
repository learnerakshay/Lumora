import React from 'react';
import { FileText, Globe, AlignLeft, Youtube, Subtitles, FileCode } from 'lucide-react';
import { SourceType } from '../../lib/source-store';

interface SourceTypeIconProps {
  type: SourceType;
  className?: string;
}

export function SourceTypeIcon({ type, className = 'w-4 h-4' }: SourceTypeIconProps) {
  switch (type) {
    case 'PDF':
      return <FileText className={`${className} text-rose-400`} />;
    case 'WEBSITE':
      return <Globe className={`${className} text-sky-400`} />;
    case 'TEXT':
      return <AlignLeft className={`${className} text-violet-400`} />;
    case 'YOUTUBE':
      return <Youtube className={`${className} text-red-500`} />;
    case 'VTT':
      return <Subtitles className={`${className} text-amber-400`} />;
    default:
      return <FileCode className={`${className} text-slate-400`} />;
  }
}
