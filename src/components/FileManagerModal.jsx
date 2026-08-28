import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HardDrive, FileSpreadsheet, Calendar, Trash2, CheckCircle2 } from 'lucide-react';
import { formatDateDisplay } from '../services/parser';

export function FileManagerModal({ isOpen, onClose, masterMeta, batchDates, onClearStorage }) {
  if (!isOpen) return null;

  const dateKeys = Object.keys(batchDates || {}).sort();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border-2 border-amber-300 relative z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-400/30">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Stored Files & Data Roster</h3>
                <p className="text-xs text-slate-500 font-medium">Synced across cloud and local storage</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
            {/* Active Master File */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>Active Master Roster (CL CTC Input 2)</span>
              </div>
              {masterMeta ? (
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-black text-slate-900 text-sm">{masterMeta.fileName}</div>
                    <div className="text-slate-500 text-xs font-medium mt-0.5">
                      Operators: <strong className="text-slate-900">{masterMeta.operatorCount}</strong> | CL: <strong className="text-slate-900">{masterMeta.contractCount}</strong> | NAPS: <strong className="text-slate-900">{masterMeta.napsCount}</strong>
                    </div>
                  </div>
                  <span className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black self-start sm:self-auto">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Loaded</span>
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-400 font-medium">No master roster loaded yet. Upload in Stage 1.</div>
              )}
            </div>

            {/* Stored Attendance Dates */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Loaded Attendance Reports ({dateKeys.length} Dates Active)</span>
              </div>

              {dateKeys.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {dateKeys.map(dKey => {
                    const item = batchDates[dKey];
                    const fileCount = item.files ? item.files.length : 0;
                    return (
                      <div key={dKey} className="flex justify-between items-center text-xs p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        <span className="font-black text-slate-900">{formatDateDisplay(item.date)}</span>
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-bold text-[11px] border border-amber-200">
                          {fileCount} reports
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-400 mt-2 font-medium">No attendance reports loaded yet. Upload in Stage 2.</div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to reset all loaded files and start fresh?')) {
                  onClearStorage();
                  onClose();
                }
              }}
              className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset Stored Data</span>
            </button>

            <button
              onClick={onClose}
              className="btn-yellow px-7 py-2.5 text-xs cursor-pointer shadow-md"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
