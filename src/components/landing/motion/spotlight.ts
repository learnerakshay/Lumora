const ACCENT_RGB = {
  cyan: '56,189,248',
  amber: '245,158,11',
  green: '16,185,129',
  violet: '167,139,250',
  rose: '244,63,94',
} as const;

export type SpotlightAccent = keyof typeof ACCENT_RGB;

// Imperative core shared by <SpotlightCard> and any section that already
// owns a ref on its card element (e.g. HowItWorksSection's stage cards,
// which need the same DOM node for a GSAP class toggle) — writes pointer
// position to CSS custom properties via rAF, never React state, so hovering
// a card never triggers a re-render.
export function attachSpotlight(el: HTMLElement, accent: SpotlightAccent = 'cyan'): () => void {
  el.classList.add('spotlight-card');
  el.style.setProperty('--spotlight-rgb', ACCENT_RGB[accent]);

  if (!el.querySelector(':scope > .spotlight-card-glow')) {
    const glow = document.createElement('span');
    glow.className = 'spotlight-card-glow';
    glow.setAttribute('aria-hidden', 'true');
    el.prepend(glow);
  }

  if (window.matchMedia('(hover: none)').matches) return () => {};

  let raf = 0;
  let x = 0;
  let y = 0;
  const apply = () => {
    raf = 0;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);
  };
  const onMove = (event: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    x = event.clientX - rect.left;
    y = event.clientY - rect.top;
    if (!raf) raf = requestAnimationFrame(apply);
  };
  el.addEventListener('pointermove', onMove, { passive: true });

  return () => {
    el.removeEventListener('pointermove', onMove);
    cancelAnimationFrame(raf);
  };
}
