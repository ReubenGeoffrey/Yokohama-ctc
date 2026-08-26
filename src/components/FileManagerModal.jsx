import React from 'react';
import { X, HardDrive, FileSpreadsheet, Calendar, Trash2, CheckCircle2 } from 'lucide-react';
import { formatDateDisplay } from '../services/parser';

export function FileManagerModal({ isOpen, onClose, masterMeta, batchDates, onClearStorage }) {
  if (!isOpen) return null;

  const dateKeys = Object.keys(batchDates || {}).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Stored Files & In-Browser Persistence</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Active Master File */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              <span>Active CTC Master Roster</span>
            </div>
            {masterMeta ? (
              <div className="mt-2 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">{masterMeta.fileName}</div>
                  <div className="text-slate-500 text-[10px]">
                    Operators: {masterMeta.operatorCount} | CL: {masterMeta.contractCount} | NAPS: {masterMeta.napsCount}
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-semibold border border-emerald-500/30">
                  Stored in IndexedDB
                </span>
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500">No master roster loaded.</div>
            )}
          </div>

          {/* Stored Attendance Dates */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>Stored Attendance Reports ({dateKeys.length} Dates)</span>
            </div>

            {dateKeys.length > 0 ? (
              <div className="space-y-1.5 mt-2">
                {dateKeys.map(dKey => {
                  const item = batchDates[dKey];
                  const fileCount = item.files ? item.files.length : 0;
                  return (
                    <div key={dKey} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="font-bold text-slate-200">{formatDateDisplay(item.date)}</span>
                      <span className="text-slate-400 text-[11px]">{fileCount} reports loaded</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-500 mt-2">No attendance reports loaded.</div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to clear all stored files and reset?')) {
                onClearStorage();
                onClose();
              }
            }}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/30 border border-rose-900/40 rounded-xl transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset All Stored Data</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
