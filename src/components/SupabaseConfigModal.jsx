import React, { useState } from 'react';
import { X, Cloud, Key, CheckCircle, AlertCircle, Copy, Database, ExternalLink } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, SupabaseService } from '../services/supabase';

export function SupabaseConfigModal({ isOpen, onClose, onConfigSaved }) {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url || '');
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey || '');
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sqlSetup = `-- 1. Create Reconciliation History Table in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.reconciliation_history (
  id BIGSERIAL PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL,
  total_headcount NUMERIC DEFAULT 0,
  daily_ctc NUMERIC DEFAULT 0,
  ot_wages NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  file_count INT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(year, month)
);

-- 2. Create Storage Bucket (Run or create via Storage UI):
INSERT INTO storage.buckets (id, name, public)
VALUES ('atc-attendance-storage', 'atc-attendance-storage', true)
ON CONFLICT (id) DO NOTHING;`;

  const handleTestAndSave = async (e) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setStatus({ type: 'error', message: 'Please enter both Supabase URL and Anon Key.' });
      return;
    }

    setTesting(true);
    setStatus(null);

    const test = await SupabaseService.testConnection(url.trim(), anonKey.trim());
    setTesting(false);

    if (test.success) {
      saveSupabaseConfig(url.trim(), anonKey.trim());
      setStatus({ type: 'success', message: 'Connected successfully to Supabase! Free Cloud Storage is active.' });
      if (onConfigSaved) onConfigSaved();
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setStatus({ type: 'error', message: `Connection failed: ${test.error || 'Check your URL and Anon Key'}` });
    }
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sqlSetup);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Connect Free Supabase Cloud Database</h3>
              <p className="text-xs text-slate-400">100% Free Forever (1 GB File Storage + 500 MB PostgreSQL)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleTestAndSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
              Project URL
            </label>
            <input
              type="text"
              placeholder="https://xyzcompany.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
              Public Anon / API Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          {status && (
            <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
              status.type === 'success'
                ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
            }`}>
              {status.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{status.message}</span>
            </div>
          )}

          <div className="pt-2 flex justify-between items-center">
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1 font-semibold"
            >
              <span>Get Free API Keys on Supabase</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              type="submit"
              disabled={testing}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              {testing ? 'Testing Connection...' : 'Save & Connect Cloud Storage'}
            </button>
          </div>
        </form>

        {/* 1-Click SQL Setup helper */}
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Optional 1-Click Supabase SQL Setup</span>
            </span>
            <button
              onClick={handleCopySQL}
              className="flex items-center space-x-1 text-amber-400 hover:text-amber-300 text-[11px]"
            >
              <Copy className="w-3 h-3" />
              <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
            </button>
          </div>
          <pre className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-[11px] font-mono text-slate-400 overflow-x-auto max-h-28">
            {sqlSetup}
          </pre>
        </div>
      </div>
    </div>
  );
}
