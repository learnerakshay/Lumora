import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const navbarSource = readFileSync(new URL('./components/Navbar.tsx', import.meta.url), 'utf8');
const protectedRouteSource = readFileSync(new URL('./components/ProtectedRoute.tsx', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Regression for the ~40-50s post-auth mobile load: every route (including
// the Three.js/GSAP/Lenis-heavy landing page) must be lazy-loaded, so the
// authenticated /workspaces path never has to download or parse code it
// doesn't need before it can render.
test('every page component is route-level lazy-loaded, not statically imported', () => {
  const lazyPages = [
    'HomePage',
    'SignInPage',
    'SignUpPage',
    'WorkspacesPage',
    'WorkspaceDetailPage',
    'UsagePage',
    'BillingPage',
    'SkillIntelligencePage',
    'LearningPathPage',
    'AboutPage',
    'FaqPage',
    'TermsPage',
    'PrivacyPage',
    'ContactPage',
    'ReportBugPage',
    'NotFoundPage',
    'UnauthorizedPage',
  ];
  for (const page of lazyPages) {
    assert.match(
      appSource,
      new RegExp(`const ${page} = lazy\\(\\(\\) => import\\('\\./pages/${page}'\\)`),
      `expected ${page} to be lazy-loaded via React.lazy()`,
    );
    assert.doesNotMatch(
      appSource,
      new RegExp(`^import \\{[^}]*\\b${page}\\b[^}]*\\} from '\\./pages/${page}';`, 'm'),
      `expected ${page} to never be statically imported`,
    );
  }
});

test('lazy routes are wrapped in a Suspense boundary with a lightweight, branded fallback', () => {
  assert.match(appSource, /<Suspense fallback=\{<AppShellLoader \/>\}>/);
  assert.match(appSource, /<\/Suspense>/);
  // The Suspense boundary must wrap <Routes>, not sit inside/after it.
  const suspenseIndex = appSource.indexOf('<Suspense');
  const routesIndex = appSource.indexOf('<Routes>');
  const suspenseCloseIndex = appSource.indexOf('</Suspense>');
  const routesCloseIndex = appSource.indexOf('</Routes>');
  assert.ok(suspenseIndex < routesIndex && routesCloseIndex < suspenseCloseIndex);
});

// Route paths and their auth gating (ProtectedRoute / PublicOnlyRoute) must
// be byte-for-byte unchanged by the lazy-loading refactor.
test('every route path and its auth wrapper is unchanged', () => {
  const expectedRoutes: Array<[string, string | null]> = [
    ['/', null],
    ['/about', null],
    ['/faq', null],
    ['/privacy', null],
    ['/terms', null],
    ['/contact', null],
    ['/report-bug', null],
    ['/unauthorized', null],
    ['/sign-in', 'PublicOnlyRoute'],
    ['/sign-up', 'PublicOnlyRoute'],
    ['/workspaces', 'ProtectedRoute'],
    ['/workspaces/:workspaceId', 'ProtectedRoute'],
    ['/usage', 'ProtectedRoute'],
    ['/billing', 'ProtectedRoute'],
    ['/skills', 'ProtectedRoute'],
    ['/learning/:planId', 'ProtectedRoute'],
  ];
  for (const [path, wrapper] of expectedRoutes) {
    assert.match(appSource, new RegExp(`path="${path.replace(/[/:]/g, '\\$&')}"`), `expected route ${path} to still exist`);
  }
  // The catch-all now renders a real, branded 404 page instead of silently
  // redirecting home — see src/pages/NotFoundPage.tsx.
  assert.match(appSource, /<Route path="\*" element=\{<NotFoundPage \/>\} \/>/);
});

// Regression for bundle weight: Navbar renders on public/landing routes and
// must never statically pull in the Lenis/GSAP smooth-scroll module (it is
// only needed if a landing nav link is actually clicked), since that would
// still land in the eager bundle every authenticated page also has to load.
test('Navbar never statically imports the Lenis/GSAP smooth-scroll module', () => {
  assert.doesNotMatch(navbarSource, /^import \{ scrollToLandingSection \} from '\.\/landing\/LandingSmoothScroll';/m);
  assert.doesNotMatch(navbarSource, /^import .*from '\.\/landing\/LandingSmoothScroll';/m);
  assert.match(navbarSource, /import\('\.\/landing\/LandingSmoothScroll'\)/);
});

// Regression for "keep authentication/security unchanged": ProtectedRoute's
// gating logic (isLoaded / isSignedIn / redirect target) must be untouched —
// only its loading *presentation* may change.
test('ProtectedRoute auth gating logic is unchanged; only the loading UI changed', () => {
  assert.match(protectedRouteSource, /const \{ isLoaded, isSignedIn \} = useAuth\(\);/);
  assert.match(protectedRouteSource, /if \(!isLoaded\) \{/);
  assert.match(protectedRouteSource, /if \(!isSignedIn\) \{/);
  assert.match(protectedRouteSource, /<Navigate to="\/sign-in" state=\{\{ from: location \}\} replace \/>/);
  assert.match(protectedRouteSource, /return <AppShellLoader/);
});

// Regression for the dominant real-world contributor on mobile: Render
// cold-start latency currently only begins once Clerk resolves AND the app
// bundle has downloaded/parsed. An early, unauthenticated, fire-and-forget
// warm-up ping lets backend cold-start run in parallel with both of those
// instead of strictly after them.
test('index.html fires an early, unauthenticated, non-blocking backend warm-up ping before the app bundle loads', () => {
  const pingScriptIndex = indexHtml.indexOf("fetch('/api/health'");
  const mainScriptIndex = indexHtml.indexOf('src="/src/main.tsx"');
  assert.ok(pingScriptIndex >= 0, 'expected an early warm-up fetch to /api/health');
  assert.ok(mainScriptIndex >= 0);
  assert.ok(pingScriptIndex < mainScriptIndex, 'the warm-up ping must fire before the main app bundle script tag');
  assert.match(indexHtml, /\.catch\(function \(\) \{\}\)/, 'the warm-up ping must never throw or block on failure');
  assert.match(indexHtml, /credentials:\s*'omit'/);
});
