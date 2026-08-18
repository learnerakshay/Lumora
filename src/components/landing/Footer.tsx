import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Mail } from 'lucide-react';
import { LumoraBrand } from './LumoraBrand';

export function Footer() {
  return (
    <footer className="landing-footer relative border-t border-slate-800/70 px-4 py-10 text-xs text-slate-400 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
        {/* Brand Logo & Copyright */}
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
          <Link to="/" className="group flex items-center space-x-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
            <LumoraBrand compact />
          </Link>
          <span className="hidden h-4 w-px bg-slate-800 sm:inline" />
          <span className="text-slate-500">
            © {new Date().getFullYear()} Lumora. AI Knowledge Workspace.
          </span>
        </div>

        {/* Links */}
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md transition-colors hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Github className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span>GitHub</span>
          </a>
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md transition-colors hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Twitter className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span>X (Twitter)</span>
          </a>
          <Link
            to="/pricing"
            className="cursor-pointer rounded-md transition-colors hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Pricing
          </Link>
          <Link
            to="/privacy"
            className="cursor-pointer rounded-md transition-colors hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="cursor-pointer rounded-md transition-colors hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Terms
          </Link>
          <Link
            to="/contact"
            className="flex items-center gap-1.5 rounded-md transition-colors hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span>Contact</span>
          </Link>
        </nav>
      </div>
    </footer>
  );
}
