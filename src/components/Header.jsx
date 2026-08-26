import React from 'react';
import { Database, HardDrive, Trash2, FolderArchive, Cloud, Layers } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

export function Header({
  masterMeta,
  storedFilesCount,
  onOpenFileManager,
  onOpenSupabaseConfig,
  onOpenYearArchive,
  onClearStorage
}) {
  const isSupabaseConnected = !!getSupabaseClient();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-xl backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Left: Brand / Title */}
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-extrabold text-2xl tracking-wider">
            ATC
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                CTC Attendance Reconciliation Hub
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-400/10 text-amber-400 border border-amber-400/30 rounded-full">
                v2.0 Supabase
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Automated Cost Mapping, OT Computation & Multi-Year Cloud DB
            </p>
          </div>
        </div>

        {/* Right: Storage Status & Actions */}
        <div className="flex items-center space-x-2.5">
          {/* Cloud DB Status Badge / Trigger */}
          <button
            onClick={onOpenSupabaseConfig}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              isSupabaseConnected
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/50'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title="Configure Supabase Free Cloud DB"
          >
            <Cloud className={`w-3.5 h-3.5 ${isSupabaseConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>{isSupabaseConnected ? 'Supabase Connected' : 'Connect Cloud DB'}</span>
          </button>

          {/* Cloud Year/Month Archives Button */}
          {isSupabaseConnected && (
            <button
              onClick={onOpenYearArchive}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition"
              title="Browse Year-by-Year Files"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Year Archives</span>
            </button>
          )}

          {/* Stored Files Button */}
          <button
            onClick={onOpenFileManager}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shadow-sm"
            title="View Stored Files"
          >
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Stored Files</span>
            {storedFilesCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold rounded-full text-[10px]">
                {storedFilesCount}
              </span>
            )}
          </button>

          {/* Clear Cache Button */}
          <button
            onClick={onClearStorage}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-rose-400 hover:bg-rose-950/30 border border-rose-900/40 transition"
            title="Reset All Stored Data"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
