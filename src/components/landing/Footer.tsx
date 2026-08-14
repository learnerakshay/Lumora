import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Mail } from 'lucide-react';
import { LumoraBrand } from './LumoraBrand';

export function Footer() {
  return (
    <footer className="relative border-t border-slate-800/80 bg-[#050810]/90 px-4 py-12 text-xs text-slate-400 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand Logo & Copyright */}
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <Link to="/" className="group flex items-center space-x-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
            <LumoraBrand compact />
          </Link>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span className="text-slate-500">
            © {new Date().getFullYear()} Lumora. AI Knowledge Workspace.
          </span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 rounded-md transition-all hover:-translate-y-0.5 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 rounded-md transition-all hover:-translate-y-0.5 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Twitter className="w-3.5 h-3.5" />
            <span>X (Twitter)</span>
          </a>
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
            className="flex items-center space-x-1 rounded-md transition-all hover:-translate-y-0.5 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Contact</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
