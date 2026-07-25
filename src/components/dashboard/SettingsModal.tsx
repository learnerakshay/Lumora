import React from 'react';
import { X, Settings, Shield, Server, Database, Key } from 'lucide-react';
import { useAuth } from '../AuthProvider';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-[#121824] border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Lumora System Settings</h2>
              <p className="text-xs text-slate-400">Workspace environment & account configuration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-300">
          {/* User Section */}
          <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-sky-400 font-semibold">
              <Key className="w-3.5 h-3.5" />
              <span>User Credentials</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-slate-500 block">ACCOUNT EMAIL</span>
                <span className="text-slate-200">{user?.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">PROVIDER</span>
                <span className="text-emerald-400 capitalize">{user?.provider || 'Clerk / OAuth'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">USER ID</span>
                <span className="text-sky-300">{user?.id || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Database & Architecture Section */}
          <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
              <Database className="w-3.5 h-3.5" />
              <span>Database Engine & pgvector</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Lumora employs PostgreSQL with <code className="text-sky-300 font-mono">pgvector</code> extension for high-dimensional 1536d chunk embeddings. Multi-tenant workspace isolation is enforced at query time.
            </p>
          </div>

          {/* Isolation & Security Section */}
          <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span>Workspace Isolation Protocol</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Strict Query Isolation:</span>
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded font-mono text-[10px]">
                ACTIVE & VERIFIED
              </span>
            </div>
          </div>

          {/* Close button */}
          <div className="pt-3 flex items-center justify-end border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
