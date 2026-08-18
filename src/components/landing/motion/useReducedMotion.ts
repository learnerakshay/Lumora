import { useEffect, useState } from 'react';

// Single source of truth for prefers-reduced-motion across the landing
// page's hand-rolled motion (canvas, SVG, imperative rAF loops) — the
// framer-motion-based Reveal/Stagger primitives also read this so every
// animated primitive agrees on the same signal.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
