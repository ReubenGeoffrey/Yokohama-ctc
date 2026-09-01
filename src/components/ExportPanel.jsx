import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  FileSpreadsheet,
  Archive,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Calendar,
  Check,
  RefreshCw,
  FileDown,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { generateMonthlyWorkbook, generateZipBundle, downloadBlob } from '../services/excelEngine';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function ExportPanel({ batchResults, master, empStats }) {
  const [downloadingMonthly, setDownloadingMonthly] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Detect months present in batchResults
  const availableMonths = useMemo(() => {
    if (!batchResults || !batchResults.length) return [{ year: 2026, month: 7, label: 'August 2026', key: '2026-08' }];
    const map = {};
    batchResults.forEach(r => {
      const d = new Date(r.date);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!map[key]) {
        map[key] = { year: y, month: m, label: `${MONTH_NAMES[m]} ${y}`, key, count: 0 };
      }
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [batchResults]);

  const [selectedMonthKey, setSelectedMonthKey] = useState(availableMonths[0]?.key || '2026-08');

  const currentMonthConfig = useMemo(() => {
    return availableMonths.find(m => m.key === selectedMonthKey) || availableMonths[0] || { year: 2026, month: 7, label: 'August 2026' };
  }, [availableMonths, selectedMonthKey]);

  // Filter batchResults for selected month
  const targetBatchResults = useMemo(() => {
    if (!batchResults) return [];
    if (availableMonths.length <= 1) return batchResults;
    return batchResults.filter(r => {
      const d = new Date(r.date);
      return d.getUTCFullYear() === currentMonthConfig.year && d.getUTCMonth() === currentMonthConfig.month;
    });
  }, [batchResults, currentMonthConfig, availableMonths]);

  const handleDownloadMonthly = async () => {
    setDownloadingMonthly(true);
    try {
      const monthName = MONTH_NAMES[currentMonthConfig.month];
      const buffer = await generateMonthlyWorkbook(targetBatchResults, master, empStats, currentMonthConfig.year, currentMonthConfig.month);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `CTC_Output_${monthName}_${currentMonthConfig.year}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Error exporting Monthly Master Workbook: ' + err.message);
    } finally {
      setDownloadingMonthly(false);
    }
  };

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    try {
      const monthName = MONTH_NAMES[currentMonthConfig.month];
      const blob = await generateZipBundle(targetBatchResults, master, empStats, currentMonthConfig.year, currentMonthConfig.month);
      downloadBlob(blob, `ATC_CTC_Reconciliation_${monthName}_${currentMonthConfig.year}.zip`);
    } catch (err) {
      console.error(err);
      alert('Error exporting ZIP bundle: ' + err.message);
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[11px] font-black uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3 text-blue-600" />
            <span>Stage 04 • Export Center</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Executive Excel Packages
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Download unified monthly summary reports and daily workbooks formatted for plant management and payroll reconciliation.
          </p>
        </div>

        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold self-start sm:self-auto shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Ready for Export</span>
        </span>
      </div>

      {/* Month Selection Tabs (if multiple months exist) */}
      {availableMonths.length > 1 && (
        <div className="flex items-center space-x-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
          <Calendar className="w-4 h-4 text-slate-400 ml-2" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-700">Choose Month:</span>
          <div className="flex gap-1.5">
            {availableMonths.map(m => (
              <button
                key={m.key}
                onClick={() => setSelectedMonthKey(m.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedMonthKey === m.key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {m.label} ({m.count} dates)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 2 Enterprise Export Package Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Package 1: Consolidated Master Excel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-2xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-black uppercase tracking-wider border border-blue-100">
                Primary Output
              </span>
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">
                {currentMonthConfig.label} Master Report
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Monthly plant summary and employee wage records.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600 font-medium">
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Monthly plant summary</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Rosters across ATC, CL, NAPS, and Project</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Wage and overtime calculations</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownloadMonthly}
            disabled={downloadingMonthly || !targetBatchResults.length}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {downloadingMonthly ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating Master Report...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Master Report (.xlsx)</span>
              </>
            )}
          </button>
        </div>

        {/* Package 2: Daily ZIP Archive */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 flex items-center justify-center shadow-2xs">
                <Archive className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-black uppercase tracking-wider border border-slate-200">
                Daily Archive
              </span>
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">
                {currentMonthConfig.label} Daily Reports
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Individual daily shift attendance files.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600 font-medium">
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Daily shift attendance</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Shift worker counts</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Daily audit records</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownloadZip}
            disabled={downloadingZip || !targetBatchResults.length}
            className="w-full py-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-black shadow-2xs transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {downloadingZip ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span>Compiling ZIP Archive...</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4 text-slate-500" />
                <span>Download Daily Reports (.zip)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default ExportPanel;
