import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileSpreadsheet,
  Calendar,
  Trash2,
  CheckCircle2,
  Download,
  RefreshCw,
  FileDown,
  Package,
  AlertCircle,
  Play,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  List,
  Clock,
  Users
} from 'lucide-react';
import { formatDateDisplay } from '../services/parser';
import {
  generateMonthlyWorkbook,
  generateSingleDayWorkbook,
  generateZipBundle,
  downloadBlob
} from '../services/excelEngine';
import { reconcileDay } from '../services/reconciliation';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function safeParseDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return new Date(Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate()));
  }
  const str = String(val).trim();
  // YYYY-MM-DD
  const mIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (mIso) {
    return new Date(Date.UTC(parseInt(mIso[1], 10), parseInt(mIso[2], 10) - 1, parseInt(mIso[3], 10)));
  }
  // DD-Mon-YYYY (e.g. 01-Aug-2026)
  const mMon = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})/);
  if (mMon) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mIdx = months.indexOf(mMon[2].toLowerCase().substring(0, 3));
    if (mIdx !== -1) {
      return new Date(Date.UTC(parseInt(mMon[3], 10), mIdx, parseInt(mMon[1], 10)));
    }
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const mDmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (mDmy) {
    return new Date(Date.UTC(parseInt(mDmy[3], 10), parseInt(mDmy[2], 10) - 1, parseInt(mDmy[1], 10)));
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return null;
}

export function FileManagerModal({
  isOpen,
  onClose,
  masterMeta,
  batchDates,
  batchResults,
  master,
  empStats,
  onClearStorage,
  onRerunReconciliation,
  onDeleteDate
}) {
  const [downloading, setDownloading] = useState(null);
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(7); // 7 = August (0-indexed)

  const safeBatchDates = batchDates || {};
  const safeBatchResults = Array.isArray(batchResults) ? batchResults : [];

  // Merge all unique dates from both batchDates and batchResults
  const allStoredDatesMap = useMemo(() => {
    const map = {};

    // 1. Ingest from batchDates
    Object.keys(safeBatchDates).forEach(dKey => {
      const item = safeBatchDates[dKey] || {};
      const d = safeParseDate(item.date) || safeParseDate(dKey);
      if (d) {
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const day = d.getUTCDate();
        const isoKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        let res = null;
        if (master && (item.CL || item.OP || item.NAPS)) {
          try {
            res = reconcileDay(d, item, master);
          } catch (e) {}
        }

        map[isoKey] = {
          dateKey: dKey,
          dateObj: d,
          isoKey,
          year: y,
          month: m,
          day,
          files: item.files || [],
          CL: item.CL || null,
          OP: item.OP || null,
          NAPS: item.NAPS || null,
          result: res
        };
      }
    });

    // 2. Ingest or merge from batchResults
    safeBatchResults.forEach(r => {
      const d = safeParseDate(r.date);
      if (d) {
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const day = d.getUTCDate();
        const isoKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (!map[isoKey]) {
          map[isoKey] = {
            dateKey: typeof r.date === 'string' ? r.date : isoKey,
            dateObj: d,
            isoKey,
            year: y,
            month: m,
            day,
            files: [],
            CL: null,
            OP: null,
            NAPS: null,
            result: r
          };
        } else {
          map[isoKey].result = r;
        }
      }
    });

    return map;
  }, [safeBatchDates, safeBatchResults, master]);

  const allStoredDates = useMemo(() => {
    return Object.values(allStoredDatesMap).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [allStoredDatesMap]);

  // Set default calYear and calMonth to the latest month that has stored data
  useEffect(() => {
    if (allStoredDates.length > 0) {
      const latest = allStoredDates[allStoredDates.length - 1];
      setCalYear(latest.year);
      setCalMonth(latest.month);
    }
  }, [allStoredDates.length]);

  // Year navigation
  const handlePrevYear = () => setCalYear(prev => prev - 1);
  const handleNextYear = () => setCalYear(prev => prev + 1);

  // Calculate monthly stats for all 12 months in calYear
  const monthsData = useMemo(() => {
    return Array.from({ length: 12 }, (_, mIdx) => {
      const datesInMonth = allStoredDates.filter(
        d => d.year === calYear && d.month === mIdx
      );

      let totalHC = 0;
      let totalCost = 0;

      datesInMonth.forEach(d => {
        if (d.result) {
          totalHC += (d.result.gHC || 0);
          totalCost += (d.result.gTot || 0);
        }
      });

      return {
        monthIndex: mIdx,
        name: MONTH_NAMES[mIdx],
        shortName: MONTH_SHORT[mIdx],
        datesCount: datesInMonth.length,
        dates: datesInMonth,
        totalHC,
        totalCost,
        hasData: datesInMonth.length > 0
      };
    });
  }, [allStoredDates, calYear]);

  // Current selected month data
  const selectedMonthData = useMemo(() => {
    return monthsData[calMonth] || monthsData[7] || {
      monthIndex: calMonth,
      name: MONTH_NAMES[calMonth],
      datesCount: 0,
      dates: [],
      totalHC: 0,
      totalCost: 0,
      hasData: false
    };
  }, [monthsData, calMonth]);

  // Results for export for selected month
  const selectedMonthResults = useMemo(() => {
    return selectedMonthData.dates.map(d => d.result).filter(Boolean);
  }, [selectedMonthData]);

  // Download handlers
  const handleDownloadMonthly = async () => {
    if (!master || !selectedMonthResults.length) {
      alert(`No reconciled records found for ${selectedMonthData.name} ${calYear}.`);
      return;
    }
    setDownloading('monthly');
    try {
      const buffer = await generateMonthlyWorkbook(
        selectedMonthResults,
        master,
        empStats,
        calYear,
        calMonth
      );
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      downloadBlob(blob, `CTC_Output_${selectedMonthData.name}_${calYear}.xlsx`);
    } catch (e) {
      console.error('Monthly export error:', e);
      alert('Error generating Monthly Master Workbook: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadZip = async () => {
    if (!master || !selectedMonthResults.length) {
      alert(`No reconciled records found for ${selectedMonthData.name} ${calYear}.`);
      return;
    }
    setDownloading('zip');
    try {
      const blob = await generateZipBundle(
        selectedMonthResults,
        master,
        empStats,
        calYear,
        calMonth
      );
      downloadBlob(blob, `ATC_CTC_Reconciliation_${selectedMonthData.name}_${calYear}.zip`);
    } catch (e) {
      console.error('ZIP bundle error:', e);
      alert('Error generating ZIP bundle: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadDay = async (item) => {
    if (!item.result || !master) return;
    setDownloading(item.isoKey);
    try {
      const buffer = await generateSingleDayWorkbook(item.result, master, item.year, item.month);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      downloadBlob(blob, `CTC_Output_${formatDateDisplay(item.dateObj)}.xlsx`);
    } catch (e) {
      console.error('Single day export error:', e);
      alert('Error generating single day workbook: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const fmt = (n) => (Math.round(n) || 0).toLocaleString('en-IN');
  const fmtN = (n) => (n || 0).toLocaleString('en-IN');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 relative z-50 overflow-hidden flex flex-col"
          style={{ maxHeight: '92vh' }}
        >
          {/* ── Top Header ───────────────────────────── */}
          <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-2xs">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Month &amp; Year Attendance Vault
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  Select month and year to view attendance summaries and download Excel.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Body: Month & Year Selector ────────── */}
          <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4 bg-slate-50/50">

            {/* Year Navigation Bar */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Select Year:
                </span>
                <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                  <button
                    onClick={handlePrevYear}
                    className="p-1 text-slate-600 hover:text-slate-950 hover:bg-slate-200 rounded transition cursor-pointer"
                    title="Previous Year"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="number"
                    value={calYear}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) setCalYear(val);
                    }}
                    className="w-14 text-xs font-black text-slate-900 bg-transparent text-center focus:outline-none"
                    min="1900"
                    max="2100"
                  />

                  <button
                    onClick={handleNextYear}
                    className="p-1 text-slate-600 hover:text-slate-950 hover:bg-slate-200 rounded transition cursor-pointer"
                    title="Next Year"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Year Pill & Today Button */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const now = new Date();
                    setCalYear(now.getFullYear());
                    setCalMonth(now.getMonth());
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition cursor-pointer shadow-2xs"
                  title="Jump to current Month & Year"
                >
                  Today
                </button>
                {[2025, 2026, 2027].map(y => (
                  <button
                    key={y}
                    onClick={() => setCalYear(y)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                      calYear === y
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* 12 Months Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {monthsData.map((m) => {
                const isSelected = calMonth === m.monthIndex;
                return (
                  <button
                    key={m.monthIndex}
                    onClick={() => setCalMonth(m.monthIndex)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer relative ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : m.hasData
                        ? 'bg-white border-blue-200 hover:border-blue-400 text-slate-900 shadow-2xs'
                        : 'bg-white/60 border-slate-200 hover:bg-white text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {m.shortName}
                      </span>
                      {m.hasData && (
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-emerald-500'}`} />
                      )}
                    </div>

                    <div className="mt-1.5">
                      {m.hasData ? (
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-blue-100' : 'text-emerald-700 font-mono'}`}>
                          {m.datesCount} date{m.datesCount > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className={`text-[10px] ${isSelected ? 'text-blue-200' : 'text-slate-300'}`}>
                          —
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Selected Month Summary Card ── */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    Selected Month
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-1">
                    {selectedMonthData.name} {calYear}
                  </h3>
                </div>

                {selectedMonthData.hasData ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                    ● {selectedMonthData.datesCount} Dates Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-medium">
                    No records stored
                  </span>
                )}
              </div>

              {selectedMonthData.hasData ? (
                <>
                  {/* Month Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100">
                      <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                        Total Headcount
                      </div>
                      <div className="text-lg font-black text-blue-950 mt-0.5">
                        {fmtN(selectedMonthData.totalHC)} HC
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                        Total CTC Wages
                      </div>
                      <div className="text-lg font-black text-emerald-950 mt-0.5 font-mono">
                        ₹{fmt(selectedMonthData.totalCost)}
                      </div>
                    </div>
                  </div>

                  {/* Monthly Download Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={handleDownloadMonthly}
                      disabled={downloading === 'monthly'}
                      className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {downloading === 'monthly' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5" />
                      )}
                      <span>Download Master Excel</span>
                    </button>

                    <button
                      onClick={handleDownloadZip}
                      disabled={downloading === 'zip'}
                      className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-black shadow-2xs transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {downloading === 'zip' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : (
                        <Package className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>Daily ZIP Archive</span>
                    </button>
                  </div>

                  {/* List of Dates in this month */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 block">
                      Attendance Dates ({selectedMonthData.datesCount})
                    </span>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {selectedMonthData.dates.map(item => (
                        <div
                          key={item.isoKey}
                          className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-black text-slate-900">
                              {formatDateDisplay(item.dateObj)}
                            </span>
                            {item.result && (
                              <span className="text-slate-500 text-[11px] ml-2">
                                HC: <strong className="text-slate-800">{fmtN(item.result.gHC)}</strong> &bull; Total: <strong className="text-emerald-700 font-mono">₹{fmt(item.result.gTot)}</strong>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1">
                            {item.result && (
                              <button
                                onClick={() => handleDownloadDay(item)}
                                disabled={downloading === item.isoKey}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-bold shadow-2xs transition cursor-pointer flex items-center space-x-1"
                                title="Download single day Excel"
                              >
                                {downloading === item.isoKey ? (
                                  <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                                ) : (
                                  <FileSpreadsheet className="w-3 h-3 text-blue-600" />
                                )}
                                <span>Excel</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                if (confirm(`Delete attendance data for ${formatDateDisplay(item.dateObj)}?`)) {
                                  onDeleteDate && onDeleteDate(item.dateKey || item.dateObj);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Delete this date"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400 font-medium">
                  No attendance files uploaded for {selectedMonthData.name} {calYear}.
                </div>
              )}
            </div>
          </div>

          {/* ── Modal Footer ───────────────────────────── */}
          <div className="p-3.5 px-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
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
