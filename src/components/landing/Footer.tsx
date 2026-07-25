import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Github, Twitter, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#070a10] border-t border-slate-800/80 text-slate-400 text-xs py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand Logo & Copyright */}
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">Lumora</span>
          </Link>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span className="text-slate-500">
            © {new Date().getFullYear()} Lumora. AI Knowledge Operating System.
          </span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center space-x-1"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center space-x-1"
          >
            <Twitter className="w-3.5 h-3.5" />
            <span>X (Twitter)</span>
          </a>
          <button
            onClick={() => alert('Lumora Privacy Policy: All workspace data is isolated and encrypted.')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Privacy
          </button>
          <button
            onClick={() => alert('Lumora Terms of Service: Standard Developer License.')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Terms
          </button>
          <a
            href="mailto:support@lumora.ai"
            className="hover:text-white transition-colors flex items-center space-x-1"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Contact</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
