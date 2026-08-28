import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, HardDrive, FileSpreadsheet, Calendar, Trash2,
  CheckCircle2, Download, RefreshCw, FileDown,
  Package, BarChart3, AlertCircle, Play, ChevronDown, ChevronRight,
  Filter, Layers, ArrowUpRight
} from 'lucide-react';
import { formatDateDisplay } from '../services/parser';
import {
  generateMonthlyWorkbook,
  generateSingleDayWorkbook,
  generateZipBundle,
  downloadBlob
} from '../services/excelEngine';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function FileManagerModal({
  isOpen, onClose, masterMeta, batchDates, batchResults,
  master, empStats, onClearStorage, onRerunReconciliation, onDeleteDate
}) {
  const [downloading, setDownloading] = useState(null); // 'monthly' | 'zip' | dayKey | 'json'
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState('ALL'); // 'ALL' or 0..11 (number)

  if (!isOpen) return null;

  const hasResults = batchResults && batchResults.length > 0;
  const hasMaster = !!masterMeta;

  // Extract all available years from batchResults or default to [2025, 2026, 2027]
  const availableYears = useMemo(() => {
    const yearsSet = new Set([2025, 2026, 2027]);
    if (batchResults) {
      batchResults.forEach(r => {
        const y = new Date(r.date).getUTCFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      });
    }
    if (batchDates) {
      Object.keys(batchDates).forEach(dKey => {
        const y = new Date(dKey).getUTCFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      });
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [batchResults, batchDates]);

  // Compute file count per month for the selected year
  const monthCounts = useMemo(() => {
    const counts = Array(12).fill(0);
    if (batchResults) {
      batchResults.forEach(r => {
        const d = new Date(r.date);
        if (d.getUTCFullYear() === Number(selectedYear)) {
          counts[d.getUTCMonth()]++;
        }
      });
    } else if (batchDates) {
      Object.keys(batchDates).forEach(dKey => {
        const d = new Date(dKey);
        if (d.getUTCFullYear() === Number(selectedYear)) {
          counts[d.getUTCMonth()]++;
        }
      });
    }
    return counts;
  }, [batchResults, batchDates, selectedYear]);

  // Filter batchResults based on selected Year & Month
  const filteredResults = useMemo(() => {
    if (!batchResults) return [];
    return batchResults.filter(r => {
      const d = new Date(r.date);
      const yearMatch = d.getUTCFullYear() === Number(selectedYear);
      const monthMatch = selectedMonth === 'ALL' || d.getUTCMonth() === Number(selectedMonth);
      return yearMatch && monthMatch;
    });
  }, [batchResults, selectedYear, selectedMonth]);

  // Calculations for filtered data
  const filteredTotCTC = filteredResults.reduce((s, r) => s + r.gCTC, 0);
  const filteredTotOT = filteredResults.reduce((s, r) => s + r.gOT, 0);
  const filteredTotCost = filteredTotCTC + filteredTotOT;
  const filteredTotHC = filteredResults.reduce((s, r) => s + r.gHC, 0);

  const fmt = (n) => (Math.round(n) || 0).toLocaleString('en-IN');
  const fmtN = (n) => (n || 0).toLocaleString('en-IN');

  const getExportMonthIndex = () => {
    if (selectedMonth !== 'ALL') return Number(selectedMonth);
    if (filteredResults.length > 0) return new Date(filteredResults[0].date).getUTCMonth();
    return 7; // August default
  };

  const handleDownloadMonthly = async () => {
    if (!filteredResults.length) return alert('No reconciled data found for selected period.');
    setDownloading('monthly');
    try {
      const mIdx = getExportMonthIndex();
      const monthName = MONTH_NAMES[mIdx];
      const buffer = await generateMonthlyWorkbook(filteredResults, master, empStats, Number(selectedYear), mIdx);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `ATC_Monthly_Summary_${monthName}_${selectedYear}.xlsx`);
    } catch (e) {
      alert('Error generating monthly workbook: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadZip = async () => {
    if (!filteredResults.length) return alert('No reconciled data found for selected period.');
    setDownloading('zip');
    try {
      const mIdx = getExportMonthIndex();
      const monthName = MONTH_NAMES[mIdx];
      const blob = await generateZipBundle(filteredResults, master, empStats, Number(selectedYear), mIdx);
      downloadBlob(blob, `ATC_Daily_Files_${monthName}_${selectedYear}.zip`);
    } catch (e) {
      alert('Error generating zip bundle: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadDay = async (r) => {
    setDownloading(r.date);
    try {
      const d = new Date(r.date);
      const buffer = await generateSingleDayWorkbook(r, master, d.getUTCFullYear(), d.getUTCMonth());
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
        filter: { year: selectedYear, month: selectedMonth === 'ALL' ? 'All Months' : MONTH_NAMES[selectedMonth] },
        masterMeta,
        recordCount: filteredResults.length,
        batchResults: filteredResults,
        empStats
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `ATC_Audit_Export_${selectedYear}_${selectedMonth !== 'ALL' ? MONTH_SHORT[selectedMonth] : 'All'}.json`);
    } catch (e) {
      alert('Error exporting JSON: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  // Group filtered results by month for display
  const monthGroups = useMemo(() => {
    const groups = {};
    filteredResults.forEach(r => {
      const d = new Date(r.date);
      const mIdx = d.getUTCMonth();
      const key = `${d.getUTCFullYear()}-${String(mIdx + 1).padStart(2, '0')}`;
      if (!groups[key]) {
        groups[key] = {
          year: d.getUTCFullYear(),
          monthIdx: mIdx,
          monthName: MONTH_NAMES[mIdx],
          key,
          rows: []
        };
      }
      groups[key].rows.push(r);
    });
    return Object.values(groups).sort((a, b) => a.monthIdx - b.monthIdx);
  }, [filteredResults]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border-2 border-amber-300 relative z-50 overflow-hidden flex flex-col"
          style={{ maxHeight: '92vh' }}
        >
          {/* ── Header ──────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-400/30">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Stored Files &amp; Month Vault</h3>
                <p className="text-xs text-slate-500 font-medium">Select Year and Month to browse, download, or delete stored plant data</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── YEAR & MONTH INTERACTIVE SELECTOR ────── */}
          <div className="px-6 py-4 bg-warm-canvas border-b border-slate-200/80 flex-shrink-0 space-y-3">
            {/* Year Selector + Month Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">Select Year:</span>
                <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-2xs">
                  {availableYears.map(y => (
                    <button
                      key={y}
                      onClick={() => setSelectedYear(y)}
                      className={`px-3 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                        selectedYear === y
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Status Pill */}
              <div className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
                {selectedMonth === 'ALL'
                  ? `Showing All Months (${filteredResults.length} dates)`
                  : `Showing ${MONTH_NAMES[selectedMonth]} ${selectedYear} (${filteredResults.length} dates)`}
              </div>
            </div>

            {/* 12 Months Tabs with Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
              <button
                onClick={() => setSelectedMonth('ALL')}
                className={`px-3 py-1.5 text-xs font-black rounded-xl transition cursor-pointer flex-shrink-0 flex items-center space-x-1.5 ${
                  selectedMonth === 'ALL'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>All Months</span>
                <span className="px-1.5 py-0.2 bg-slate-900/10 text-slate-900 rounded-full text-[10px]">
                  {batchResults ? batchResults.filter(r => new Date(r.date).getUTCFullYear() === Number(selectedYear)).length : 0}
                </span>
              </button>

              {MONTH_SHORT.map((mShort, idx) => {
                const count = monthCounts[idx];
                const isSelected = selectedMonth === idx;
                return (
                  <button
                    key={mShort}
                    onClick={() => setSelectedMonth(idx)}
                    className={`px-3 py-1.5 text-xs font-black rounded-xl transition cursor-pointer flex-shrink-0 flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : count > 0
                        ? 'bg-white text-slate-800 border-2 border-amber-300 hover:bg-amber-50'
                        : 'bg-slate-100/80 text-slate-400 border border-slate-200 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>{mShort}</span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        isSelected ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-900'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Scrollable Content Area ───────────────── */}
          <div className="overflow-y-auto flex-1 p-6 space-y-6">

            {/* Quick Metrics for Filtered Month */}
            {filteredResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-center">
                  <div className="text-lg font-black text-blue-900">{filteredResults.length}</div>
                  <div className="text-[11px] font-bold text-blue-700 mt-0.5">Dates Active</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-center">
                  <div className="text-lg font-black text-indigo-900">{fmtN(filteredTotHC)}</div>
                  <div className="text-[11px] font-bold text-indigo-700 mt-0.5">Total Headcount</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-center">
                  <div className="text-lg font-black text-amber-900">₹{fmt(filteredTotCTC)}</div>
                  <div className="text-[11px] font-bold text-amber-700 mt-0.5">Total CTC Wages</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
                  <div className="text-lg font-black text-emerald-900">₹{fmt(filteredTotCost)}</div>
                  <div className="text-[11px] font-bold text-emerald-700 mt-0.5">Month Grand Total</div>
                </div>
              </div>
            )}

            {/* ── DOWNLOAD EXCEL PACKAGES FOR SELECTED MONTH ── */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    Download Packages &bull; {selectedMonth === 'ALL' ? `Year ${selectedYear}` : `${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-500 normal-case">
                  {filteredResults.length} records available
                </span>
              </div>

              <div className="p-4 space-y-3">
                {filteredResults.length === 0 ? (
                  <div className="p-5 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                    <div className="text-xs font-black text-slate-700">
                      No files stored for {selectedMonth === 'ALL' ? `Year ${selectedYear}` : `${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Upload daily attendance sheets in Stage 2 to store and generate workbooks for this month.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Monthly Master */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center space-x-2 text-emerald-700">
                          <FileSpreadsheet className="w-4 h-4" />
                          <span className="text-xs font-black">Monthly Master (.xlsx)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Consolidated Excel with Summary, ATC, CL, NAPS sheets.
                        </p>
                      </div>
                      <button
                        onClick={handleDownloadMonthly}
                        disabled={downloading === 'monthly'}
                        className="btn-yellow w-full py-2 text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        {downloading === 'monthly' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                        <span>{downloading === 'monthly' ? 'Building...' : 'Download Master'}</span>
                      </button>
                    </div>

                    {/* ZIP Archive */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center space-x-2 text-blue-700">
                          <Package className="w-4 h-4" />
                          <span className="text-xs font-black">All Daily Files (ZIP)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Every single day workbook bundled into one zip file.
                        </p>
                      </div>
                      <button
                        onClick={handleDownloadZip}
                        disabled={downloading === 'zip'}
                        className="btn-blue w-full py-2 text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        {downloading === 'zip' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span>{downloading === 'zip' ? 'Zipping...' : 'Download ZIP'}</span>
                      </button>
                    </div>

                    {/* Audit JSON */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center space-x-2 text-amber-700">
                          <BarChart3 className="w-4 h-4" />
                          <span className="text-xs font-black">Audit Export (JSON)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Full parsed numbers for historical auditing and backup.
                        </p>
                      </div>
                      <button
                        onClick={handleDownloadJson}
                        disabled={downloading === 'json'}
                        className="w-full py-2 text-xs font-bold bg-white text-slate-800 border border-slate-300 rounded-full hover:bg-slate-100 transition cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        {downloading === 'json' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-slate-600" />}
                        <span>Export JSON</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── STORED ATTENDANCE FILES LIST BY MONTH ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-slate-700">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>
                    Individual Stored Daily Files ({filteredResults.length} Active in Filter)
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-400">Download or remove per-day records</span>
              </div>

              {monthGroups.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <div className="text-sm font-black text-slate-700">No attendance reports loaded for this selection</div>
                  <p className="text-xs text-slate-400 mt-1">Switch month above or upload new files in Stage 2.</p>
                </div>
              ) : (
                monthGroups.map(group => (
                  <div key={group.key} className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 overflow-hidden shadow-2xs">
                    {/* Month Group Header */}
                    <div className="px-5 py-3.5 bg-amber-100/70 border-b border-amber-200 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-xs rounded-md shadow-2xs">
                          {group.monthName} {group.year}
                        </span>
                        <span className="text-xs font-bold text-amber-950">
                          {group.rows.length} attendance date{group.rows.length > 1 ? 's' : ''} stored
                        </span>
                      </div>
                      <span className="text-xs font-mono font-black text-amber-900">
                        ₹{fmt(group.rows.reduce((s, r) => s + r.gTot, 0))} total
                      </span>
                    </div>

                    {/* Day Rows */}
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white">
                      {group.rows.map(r => (
                        <div
                          key={r.date}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-300 transition"
                        >
                          <div>
                            <div className="text-xs font-black text-slate-900">{formatDateDisplay(r.date)}</div>
                            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                              HC: <strong className="text-slate-800">{r.gHC}</strong> &bull; Total: <strong className="text-emerald-700 font-mono">₹{fmt(r.gTot)}</strong>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 flex-shrink-0">
                            {/* Download Single Day */}
                            <button
                              onClick={() => handleDownloadDay(r)}
                              disabled={downloading === r.date}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-400 hover:text-slate-950 text-slate-700 text-[11px] font-bold border border-slate-200 transition cursor-pointer flex items-center space-x-1"
                              title="Download single day Excel"
                            >
                              {downloading === r.date ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              <span>Excel</span>
                            </button>

                            {/* Delete Single Day */}
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete attendance data for ${formatDateDisplay(r.date)}?\nThis cannot be undone.`)) {
                                  onDeleteDate && onDeleteDate(r.date);
                                }
                              }}
                              className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 border border-rose-200 transition cursor-pointer flex items-center justify-center"
                              title={`Delete ${formatDateDisplay(r.date)}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── ACTIVE MASTER ROSTER INFO ────────── */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <div className="bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-2 border-b border-slate-200">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>Active Rate Master Roster (CL CTC Input 2)</span>
              </div>
              <div className="p-4">
                {hasMaster ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-black text-slate-900 text-sm">{masterMeta.fileName}</div>
                      <div className="text-slate-500 font-medium mt-0.5">
                        Operators: <strong className="text-slate-900">{masterMeta.operatorCount}</strong> &bull; CL: <strong className="text-slate-900">{masterMeta.contractCount}</strong> &bull; NAPS: <strong className="text-slate-900">{masterMeta.napsCount}</strong>
                      </div>
                    </div>
                    <span className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black self-start sm:self-auto">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Loaded</span>
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 font-medium">No master roster loaded yet. Upload in Stage 1.</div>
                )}
              </div>
            </div>

            {/* ── RE-OPEN RECONCILIATION BUTTON ────── */}
            {hasResults && onRerunReconciliation && (
              <button
                onClick={() => {
                  onRerunReconciliation();
                  onClose();
                }}
                className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-2xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition cursor-pointer shadow-md shadow-blue-500/25"
              >
                <Play className="w-4 h-4" />
                <span>Re-Open Reconciliation Matrix (Stage 3)</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ── Footer Actions ───────────────────────── */}
          <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50/80 flex-shrink-0">
            <button
              onClick={() => {
                if (confirm('Reset ALL stored files and start fresh? This cannot be undone.')) {
                  onClearStorage();
                  onClose();
                }
              }}
              className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset All Stored Data</span>
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

export default FileManagerModal;
