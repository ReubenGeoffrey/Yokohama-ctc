import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, HardDrive, FileSpreadsheet, Calendar, Trash2,
  CheckCircle2, Download, RefreshCw, FileDown,
  Package, BarChart3, AlertCircle, Play
} from 'lucide-react';
import { formatDateDisplay } from '../services/parser';
import {
  generateMonthlyWorkbook,
  generateSingleDayWorkbook,
  generateZipBundle,
  downloadBlob
} from '../services/excelEngine';

export function FileManagerModal({
  isOpen, onClose, masterMeta, batchDates, batchResults,
  master, empStats, onClearStorage, onRerunReconciliation, onDeleteDate
}) {
  const [downloading, setDownloading] = useState(null); // 'monthly' | 'zip' | dayKey | 'json'

  if (!isOpen) return null;

  const dateKeys = Object.keys(batchDates || {}).sort();
  const hasResults = batchResults && batchResults.length > 0;
  const hasMaster  = !!masterMeta;

  // ── Helpers ───────────────────────────────────────────────
  const getYear  = () => hasResults ? new Date(batchResults[0].date).getUTCFullYear()  : new Date().getFullYear();
  const getMonth = () => hasResults ? new Date(batchResults[0].date).getUTCMonth()     : new Date().getMonth();

  const handleDownloadMonthly = async () => {
    if (!hasResults) return alert('No reconciled data found. Run reconciliation first.');
    setDownloading('monthly');
    try {
      const buffer = await generateMonthlyWorkbook(batchResults, master, empStats, getYear(), getMonth());
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `ATC_Monthly_Summary_${getYear()}_${String(getMonth() + 1).padStart(2, '0')}.xlsx`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadZip = async () => {
    if (!hasResults) return alert('No reconciled data found. Run reconciliation first.');
    setDownloading('zip');
    try {
      const blob = await generateZipBundle(batchResults, master, empStats, getYear(), getMonth());
      downloadBlob(blob, `ATC_All_Days_Bundle_${getYear()}_${String(getMonth() + 1).padStart(2, '0')}.zip`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadDay = async (r) => {
    setDownloading(r.date);
    try {
      const buffer = await generateSingleDayWorkbook(r, master, getYear(), getMonth());
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `CTC_Output_${formatDateDisplay(r.date)}.xlsx`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadJson = () => {
    setDownloading('json');
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        masterMeta,
        batchResults,
        empStats
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `ATC_Audit_Export_${new Date().toISOString().slice(0,10)}.json`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const fmt = (n) => (Math.round(n) || 0).toLocaleString('en-IN');
  const totCTC  = hasResults ? batchResults.reduce((s, r) => s + r.gCTC, 0) : 0;
  const totOT   = hasResults ? batchResults.reduce((s, r) => s + r.gOT,  0) : 0;
  const totCost = totCTC + totOT;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 relative z-50 overflow-hidden"
          style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        >
          {/* ── Header ──────────────────────────────────── */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-400/30">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Vault — Stored Files & Data</h3>
                <p className="text-xs text-slate-500 font-medium">Download outputs or re-run reconciliation from saved data</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Scrollable Content ───────────────────── */}
          <div className="overflow-y-auto flex-1 p-6 space-y-5">

            {/* Quick Stats if reconciled */}
            {hasResults && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Days Processed', value: batchResults.length, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Total CTC',       value: `₹${fmt(totCTC)}`,  color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
                  { label: 'Grand Total',     value: `₹${fmt(totCost)}`, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                ].map(s => (
                  <div key={s.label} className={`p-3 rounded-xl border text-center ${s.bg}`}>
                    <div className={`text-sm font-black ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] font-semibold text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── DOWNLOAD OUTPUTS ─────────────────── */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 flex items-center space-x-2 border-b border-slate-200">
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Download Output Files</span>
              </div>
              <div className="p-4 space-y-3">

                {!hasResults && (
                  <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>No reconciled results yet. Upload attendance files and run reconciliation first.</span>
                  </div>
                )}

                {/* Monthly Master Excel */}
                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">Monthly Master Summary</div>
                      <div className="text-[10px] text-slate-400 font-medium">All dates merged · styled yellow headers</div>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadMonthly}
                    disabled={!hasResults || downloading === 'monthly'}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      hasResults
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {downloading === 'monthly'
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <FileDown className="w-3.5 h-3.5" />}
                    <span>{downloading === 'monthly' ? 'Generating…' : '📊 .xlsx'}</span>
                  </button>
                </div>

                {/* ZIP Bundle */}
                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Package className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">All Daily Files (ZIP Bundle)</div>
                      <div className="text-[10px] text-slate-400 font-medium">One file per date · zipped together</div>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadZip}
                    disabled={!hasResults || downloading === 'zip'}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      hasResults
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                        : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {downloading === 'zip'
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Download className="w-3.5 h-3.5" />}
                    <span>{downloading === 'zip' ? 'Zipping…' : '📦 .zip'}</span>
                  </button>
                </div>

                {/* Audit JSON */}
                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">Audit Data Export (JSON)</div>
                      <div className="text-[10px] text-slate-400 font-medium">Full reconciliation results for record-keeping</div>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadJson}
                    disabled={!hasResults || downloading === 'json'}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      hasResults
                        ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                        : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {downloading === 'json'
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <FileDown className="w-3.5 h-3.5" />}
                    <span>{downloading === 'json' ? 'Exporting…' : '📋 .json'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Per-Day Downloads + Delete ────────── */}
            {hasResults && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 flex items-center justify-between border-b border-slate-200">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Per-Day Files ({batchResults.length} dates)</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 normal-case">Download or delete individual dates</span>
                </div>
                <div className="p-4 space-y-2 max-h-56 overflow-y-auto">
                  {batchResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 gap-2">
                      {/* Date label */}
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        <span className="text-xs font-black text-slate-800 truncate">{formatDateDisplay(r.date)}</span>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        {/* Download Day */}
                        <button
                          onClick={() => handleDownloadDay(r)}
                          disabled={downloading === r.date}
                          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-400 hover:text-slate-950 text-slate-700 text-[11px] font-bold border border-slate-200 transition cursor-pointer"
                          title="Download this day's Excel"
                        >
                          {downloading === r.date
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : <Download className="w-3 h-3" />}
                          <span className="hidden sm:inline">{downloading === r.date ? '…' : 'Excel'}</span>
                        </button>
                        {/* Delete This Date */}
                        <button
                          onClick={() => {
                            if (confirm(`Delete attendance data for ${formatDateDisplay(r.date)}?\nThis cannot be undone.`)) {
                              onDeleteDate && onDeleteDate(r.date);
                            }
                          }}
                          className="flex items-center justify-center w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 border border-rose-200 transition cursor-pointer"
                          title={`Delete ${formatDateDisplay(r.date)}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Stored Roster Info ────────────────── */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 flex items-center space-x-2 border-b border-slate-200">
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                <span>Active Master Roster</span>
              </div>
              <div className="p-4">
                {hasMaster ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-900">{masterMeta.fileName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        Operators: <strong className="text-slate-800">{masterMeta.operatorCount}</strong> ·
                        CL: <strong className="text-slate-800">{masterMeta.contractCount}</strong> ·
                        NAPS: <strong className="text-slate-800">{masterMeta.napsCount}</strong>
                      </div>
                    </div>
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-black">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Loaded</span>
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 font-medium">No master roster loaded yet. Upload in Stage 1.</div>
                )}
              </div>
            </div>

            {/* ── Re-Run Reconciliation ─────────────── */}
            {hasResults && onRerunReconciliation && (
              <button
                onClick={() => { onRerunReconciliation(); onClose(); }}
                className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition cursor-pointer shadow-md shadow-blue-400/25"
              >
                <Play className="w-4 h-4" />
                <span>Re-Open Reconciliation Matrix (Stage 3)</span>
              </button>
            )}
          </div>

          {/* ── Footer ──────────────────────────────── */}
          <div className="flex items-center justify-between p-5 border-t border-slate-100 flex-shrink-0 bg-white">
            <button
              onClick={() => {
                if (confirm('Reset ALL stored data? This cannot be undone.')) {
                  onClearStorage();
                  onClose();
                }
              }}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset All Data</span>
            </button>
            <button onClick={onClose} className="btn-yellow px-7 py-2.5 text-xs cursor-pointer shadow-md">
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
