import React, { useEffect, useRef } from 'react';
import { attachSpotlight, type SpotlightAccent } from './spotlight';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLElement> {
  accent?: SpotlightAccent;
  as?: 'div' | 'article';
}

// Shared card shell: a cursor-following radial glow (CSS vars, rAF-driven,
// never React state) layered under the card's existing content. Used for
// cards that don't already own a ref of their own — HowItWorksSection's
// three stage cards attach the same behavior directly via attachSpotlight()
// since they need that DOM node for an existing GSAP class toggle.
export function SpotlightCard({ children, accent = 'cyan', className = '', as = 'div', ...rest }: SpotlightCardProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return attachSpotlight(ref.current, accent);
  }, [accent]);

  const Tag = as as React.ElementType;

  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
}
