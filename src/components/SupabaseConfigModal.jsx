import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cloud, CheckCircle, AlertCircle, Copy, Database, ExternalLink } from 'lucide-react';
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
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="luxury-glass rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/70">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Connect Supabase Cloud DB</h3>
                <p className="text-xs text-slate-500 font-medium">100% Free Forever (1 GB Storage + 500 MB PostgreSQL)</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleTestAndSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Project URL
              </label>
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-600 focus:ring-4 focus:ring-rose-100 transition shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Public Anon / API Key
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-600 focus:ring-4 focus:ring-rose-100 transition shadow-2xs"
              />
            </div>

            {status && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3.5 rounded-xl text-xs flex items-center space-x-2 font-bold ${
                  status.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border border-rose-300 text-rose-800'
                }`}
              >
                {status.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{status.message}</span>
              </motion.div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-3">
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-rose-600 hover:text-rose-700 flex items-center space-x-1 font-bold"
              >
                <span>Get Free API Keys on Supabase</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={testing}
                className="luxury-btn-primary w-full sm:w-auto px-6 py-2.5 text-white font-black text-xs rounded-xl shadow-lg cursor-pointer"
              >
                {testing ? 'Testing Connection...' : 'Save & Connect Cloud Storage'}
              </motion.button>
            </div>
          </form>

          {/* 1-Click SQL Setup helper */}
          <div className="pt-4 border-t border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center space-x-1.5">
                <Database className="w-3.5 h-3.5 text-rose-600" />
                <span>Optional 1-Click Supabase SQL Setup</span>
              </span>
              <button
                onClick={handleCopySQL}
                className="flex items-center space-x-1 text-rose-600 hover:text-rose-700 text-[11px] font-bold cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 overflow-x-auto max-h-28">
              {sqlSetup}
            </pre>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
