import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router does not reset scroll position on client-side navigation, so
// navigating from a scrolled-down page (e.g. a long Terms/FAQ page) to a new
// route lands mid-page instead of at the top. Skips when a hash is present —
// Navbar/Footer's handleNavClick/handleAnchorClick navigate to `/#section`
// and own that scroll themselves via scrollToLandingSection.
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
