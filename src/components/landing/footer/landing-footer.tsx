import { LumoraLogo } from "@/components/brand/lumora-logo";
export function LandingFooter() {
  return (
    <footer className="border-t border-white/8 py-14">
      <div className="mx-auto grid max-w-6xl gap-10 px-[var(--page-gutter)] md:grid-cols-2 xl:grid-cols-[1.3fr_.7fr_.7fr_.7fr_1.25fr]">
        <div>
          <LumoraLogo decorative size="md" wordmark />
          <p className="mt-5 max-w-xs text-sm leading-6 text-[var(--muted)]">
            A knowledge operating system for connected learning.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Product</h3>
          <p className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
            Features
            <br />
            Research Workspaces
            <br />
            Roadmap
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Resources</h3>
          <p className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
            Documentation
            <br />
            GitHub
            <br />
            Changelog
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Company</h3>
          <p className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
            About
            <br />
            Contact
            <br />
            Privacy
          </p>
        </div>
        <form className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
          <h3 className="text-sm font-medium text-white">Stay updated.</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Occasional product updates. No spam.
          </p>
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <div className="mt-4 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#090a13] px-3 py-2 text-sm text-white"
              id="newsletter-email"
              placeholder="Email address"
              type="email"
            />
            <button
              className="rounded-lg border border-[var(--accent)]/45 px-3 text-sm text-white"
              type="button"
            >
              Subscribe
            </button>
          </div>
        </form>
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl justify-between gap-3 border-t border-white/8 px-[var(--page-gutter)] pt-6 text-xs text-[var(--muted)]">
        <span>© 2026 Lumora</span>
        <span>Made for lifelong learners.</span>
      </div>
    </footer>
  );
}
