import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, HardDrive, FileSpreadsheet, Calendar, Trash2,
  CheckCircle2, Download, RefreshCw, FileDown,
  Package, BarChart3, AlertCircle, Play, ChevronDown, ChevronRight,
  ChevronLeft, FileText, ArrowUpRight, Check, LayoutGrid, List
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

function safeParseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function FileManagerModal({
  isOpen, onClose, masterMeta, batchDates, batchResults,
  master, empStats, onClearStorage, onRerunReconciliation, onDeleteDate
}) {
  const [downloading, setDownloading] = useState(null);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [selectedYear, setSelectedYear] = useState('ALL'); // 'ALL' or number (2025, 2026, 2027)
  const [selectedMonth, setSelectedMonth] = useState('ALL'); // 'ALL' or 0..11 (number)

  const hasMaster = !!masterMeta;
  const safeBatchDates = batchDates || {};
  const safeBatchResults = Array.isArray(batchResults) ? batchResults : [];

  // Merge all unique dates from both batchDates and batchResults
  const allStoredDates = useMemo(() => {
    const map = {};

    // 1. Ingest from batchDates
    Object.keys(safeBatchDates).forEach(dKey => {
      const item = safeBatchDates[dKey] || {};
      const d = safeParseDate(item.date) || safeParseDate(dKey);
      if (d) {
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const isoKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        map[isoKey] = {
          dateKey: dKey,
          dateObj: d,
          year: y,
          month: m,
          files: item.files || [],
          CL: item.CL || null,
          OP: item.OP || null,
          NAPS: item.NAPS || null,
          result: null
        };
      }
    });

    // 2. Ingest or merge from batchResults
    safeBatchResults.forEach(r => {
      const d = safeParseDate(r.date);
      if (d) {
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const isoKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        if (!map[isoKey]) {
          map[isoKey] = {
            dateKey: typeof r.date === 'string' ? r.date : isoKey,
            dateObj: d,
            year: y,
            month: m,
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

    return Object.values(map).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [safeBatchDates, safeBatchResults]);

  // Extract comprehensive years (2020 to 2035 + any custom years found in stored data)
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    for (let y = 2020; y <= 2035; y++) {
      yearsSet.add(y);
    }
    allStoredDates.forEach(item => yearsSet.add(item.year));
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [allStoredDates]);

  // Extract years that currently have stored attendance data
  const yearsWithData = useMemo(() => {
    const s = new Set();
    allStoredDates.forEach(item => s.add(item.year));
    return Array.from(s).sort((a, b) => a - b);
  }, [allStoredDates]);

  // File count per month for selected year
  const monthCounts = useMemo(() => {
    const counts = Array(12).fill(0);
    allStoredDates.forEach(item => {
      if (selectedYear === 'ALL' || item.year === Number(selectedYear)) {
        if (item.month >= 0 && item.month < 12) {
          counts[item.month]++;
        }
      }
    });
    return counts;
  }, [allStoredDates, selectedYear]);

  // Filtered dates based on selected Year & Month
  const filteredDates = useMemo(() => {
    return allStoredDates.filter(item => {
      const yMatch = selectedYear === 'ALL' || item.year === Number(selectedYear);
      const mMatch = selectedMonth === 'ALL' || item.month === Number(selectedMonth);
      return yMatch && mMatch;
    });
  }, [allStoredDates, selectedYear, selectedMonth]);

  // Filtered batchResults for exports
  const filteredResults = useMemo(() => {
    return filteredDates
      .map(item => item.result)
      .filter(Boolean);
  }, [filteredDates]);

  // Metrics
  const filteredTotCTC = filteredResults.reduce((s, r) => s + (r.gCTC || 0), 0);
  const filteredTotOT = filteredResults.reduce((s, r) => s + (r.gOT || 0), 0);
  const filteredTotCost = filteredTotCTC + filteredTotOT;
  const filteredTotHC = filteredResults.reduce((s, r) => s + (r.gHC || 0), 0);

  const fmt = (n) => (Math.round(n) || 0).toLocaleString('en-IN');
  const fmtN = (n) => (n || 0).toLocaleString('en-IN');

  const getExportMonthIndex = () => {
    if (selectedMonth !== 'ALL') return Number(selectedMonth);
    if (filteredDates.length > 0) return filteredDates[0].month;
    return 7; // August default
  };

  const getExportYear = () => {
    if (selectedYear !== 'ALL') return Number(selectedYear);
    if (filteredDates.length > 0) return filteredDates[0].year;
    return 2026;
  };

  const handleDownloadMonthly = async () => {
    if (!filteredResults.length) {
      alert('Please run reconciliation (Stage 3) first to generate the Monthly Master Excel.');
      return;
    }
    setDownloading('monthly');
    try {
      const mIdx = getExportMonthIndex();
      const expYear = getExportYear();
      const monthName = MONTH_NAMES[mIdx];
      const buffer = await generateMonthlyWorkbook(filteredResults, master, empStats, expYear, mIdx);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `ATC_Monthly_Summary_${monthName}_${expYear}.xlsx`);
    } catch (e) {
      alert('Error generating monthly workbook: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadZip = async () => {
    if (!filteredResults.length) {
      alert('Please run reconciliation (Stage 3) first to generate the ZIP archive.');
      return;
    }
    setDownloading('zip');
    try {
      const mIdx = getExportMonthIndex();
      const expYear = getExportYear();
      const monthName = MONTH_NAMES[mIdx];
      const blob = await generateZipBundle(filteredResults, master, empStats, expYear, mIdx);
      downloadBlob(blob, `ATC_Daily_Files_${monthName}_${expYear}.zip`);
    } catch (e) {
      alert('Error generating zip bundle: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadDay = async (item) => {
    if (!item.result) {
      alert('This date has not been reconciled yet. Click "Re-Open Reconciliation" below.');
      return;
    }
    const dKey = item.dateKey;
    setDownloading(dKey);
    try {
      const buffer = await generateSingleDayWorkbook(item.result, master, item.year, item.month);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `CTC_Output_${formatDateDisplay(item.dateObj)}.xlsx`);
    } catch (e) {
      alert('Error downloading day workbook: ' + e.message);
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
        recordCount: filteredDates.length,
        dates: filteredDates.map(item => ({
          date: item.dateKey,
          files: item.files,
          result: item.result
        }))
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `ATC_Vault_Backup_${selectedYear}_${selectedMonth !== 'ALL' ? MONTH_SHORT[selectedMonth] : 'All'}.json`);
    } catch (e) {
      alert('Error exporting JSON: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  // Group filtered dates by month for display
  const monthGroups = useMemo(() => {
    const groups = {};
    filteredDates.forEach(item => {
      const key = `${item.year}-${String(item.month + 1).padStart(2, '0')}`;
      if (!groups[key]) {
        groups[key] = {
          year: item.year,
          monthIdx: item.month,
          monthName: MONTH_NAMES[item.month],
          key,
          items: []
        };
      }
      groups[key].items.push(item);
    });
    return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredDates]);

  // Render interactive 7-column calendar cells for a month group
  const renderCalendarCells = (group) => {
    const daysInMonth = new Date(group.year, group.monthIdx + 1, 0).getDate();
    // Monday-first index: (dayOfWeek + 6) % 7
    const firstDayOfWeek = (new Date(group.year, group.monthIdx, 1).getDay() + 6) % 7;

    const dayMap = {};
    group.items.forEach(item => {
      const dayNum = item.dateObj.getUTCDate();
      dayMap[dayNum] = item;
    });

    const cells = [];
    // Lead-in empty days
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(
        <div key={`empty-${i}`} className="min-h-[86px] rounded-xl bg-slate-50/40 border border-dashed border-slate-200/50" />
      );
    }

    // Days 1 to daysInMonth
    for (let d = 1; d <= daysInMonth; d++) {
      const item = dayMap[d];
      const isWeekend = (firstDayOfWeek + d - 1) % 7 >= 5;

      if (item) {
        const r = item.result;
        cells.push(
          <div
            key={`day-${d}`}
            className="min-h-[86px] p-2 rounded-xl bg-amber-50/90 border-2 border-amber-300 hover:border-amber-400 hover:shadow-md transition flex flex-col justify-between"
          >
            {/* Top row: Day number & Green active indicator */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 bg-white px-1.5 py-0.5 rounded-md shadow-2xs border border-amber-200">
                {d}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" title="Attendance Stored" />
            </div>

            {/* Middle: Metrics */}
            <div className="my-1">
              {r ? (
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold text-slate-700 leading-none">
                    HC: <strong className="text-slate-900">{r.gHC}</strong>
                  </div>
                  <div className="text-[11px] font-mono font-black text-emerald-800 leading-none">
                    ₹{fmt(r.gTot)}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] font-bold text-amber-800 leading-tight">
                  {item.files?.length || 1} file(s)
                </div>
              )}
            </div>

            {/* Bottom: Quick Excel & Trash Buttons */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-amber-200/70">
              <button
                onClick={() => handleDownloadDay(item)}
                disabled={downloading === item.dateKey}
                className="flex-1 py-1 px-1 bg-white hover:bg-amber-100 text-slate-800 hover:text-amber-950 rounded text-[10px] font-black border border-slate-200 shadow-2xs flex items-center justify-center space-x-1 cursor-pointer"
                title="Download single day Excel"
              >
                {downloading === item.dateKey ? (
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <Download className="w-2.5 h-2.5 text-blue-600" />
                )}
                <span>Excel</span>
              </button>

              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete attendance data for ${formatDateDisplay(item.dateObj)}?\nThis cannot be undone.`)) {
                    onDeleteDate && onDeleteDate(item.dateKey || item.dateObj);
                  }
                }}
                className="w-5 h-5 rounded bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 border border-rose-200 flex items-center justify-center cursor-pointer flex-shrink-0"
                title="Delete this date"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        );
      } else {
        cells.push(
          <div
            key={`day-${d}`}
            className={`min-h-[86px] p-2 rounded-xl border border-slate-100 flex flex-col justify-between ${
              isWeekend ? 'bg-slate-50/70 text-slate-400' : 'bg-white text-slate-300'
            }`}
          >
            <div className="text-xs font-bold text-slate-400">
              {d}
            </div>
            <div className="text-[10px] text-slate-300 text-center font-medium">
              —
            </div>
            <div className="h-4" />
          </div>
        );
      }
    }

    return cells;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border-2 border-amber-300 relative z-50 overflow-hidden flex flex-col"
          style={{ maxHeight: '92vh' }}
        >
          {/* ── Modal Header ───────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-400/30 flex-shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Stored Files &amp; Month Vault</h3>
                <p className="text-xs text-slate-500 font-medium">Browse, download, or remove plant attendance records by Month &amp; Year</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── YEAR & MONTH INTERACTIVE SELECTOR ─────── */}
          <div className="px-6 py-3.5 bg-warm-canvas border-b border-slate-200 flex-shrink-0 space-y-3">
            {/* Year Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">Year:</span>
                </div>
                
                <div className="flex items-center space-x-1 bg-white rounded-xl border border-slate-200 p-1 shadow-2xs">
                  {/* All Years Button */}
                  <button
                    onClick={() => setSelectedYear('ALL')}
                    className={`px-3 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                      selectedYear === 'ALL'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    All Years
                  </button>

                  {/* Year Stepper < */}
                  <button
                    onClick={() => {
                      const cur = selectedYear === 'ALL' ? (yearsWithData[0] || 2026) : Number(selectedYear);
                      setSelectedYear(cur - 1);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="Previous Year"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Comprehensive Year Dropdown Selector (2020 to 2035+) */}
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                    className="text-xs font-black text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="ALL">All Years (Full Vault)</option>
                    {availableYears.map(y => {
                      const count = allStoredDates.filter(i => i.year === y).length;
                      return (
                        <option key={y} value={y}>
                          {y} {count > 0 ? `(${count} dates)` : ''}
                        </option>
                      );
                    })}
                  </select>

                  {/* Year Stepper > */}
                  <button
                    onClick={() => {
                      const cur = selectedYear === 'ALL' ? (yearsWithData[0] || 2026) : Number(selectedYear);
                      setSelectedYear(cur + 1);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="Next Year"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick shortcut pills for years with active data */}
                {yearsWithData.length > 0 && (
                  <div className="hidden sm:flex items-center space-x-1">
                    {yearsWithData.map(y => (
                      <button
                        key={y}
                        onClick={() => setSelectedYear(y)}
                        className={`px-2.5 py-1 text-xs font-black rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${
                          selectedYear === y
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-amber-50 border border-amber-200'
                        }`}
                        title={`Jump to ${y}`}
                      >
                        <span>{y}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Pill */}
              <div className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
                {selectedYear === 'ALL' && selectedMonth === 'ALL'
                  ? `Showing All Years & All Months (${filteredDates.length} dates stored)`
                  : selectedYear === 'ALL'
                  ? `Showing All ${MONTH_NAMES[selectedMonth]} Records (${filteredDates.length} dates stored)`
                  : selectedMonth === 'ALL'
                  ? `Showing All Months in ${selectedYear} (${filteredDates.length} dates stored)`
                  : `Showing ${MONTH_NAMES[selectedMonth]} ${selectedYear} (${filteredDates.length} dates stored)`}
              </div>
            </div>

            {/* 12 Months Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
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
                  {allStoredDates.filter(item => selectedYear === 'ALL' || item.year === Number(selectedYear)).length}
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

          {/* ── Scrollable Content ────────────────────── */}
          <div className="overflow-y-auto flex-1 p-6 space-y-6 bg-white">

            {/* Quick Metrics */}
            {filteredResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-center">
                  <div className="text-lg font-black text-blue-900">{filteredDates.length}</div>
                  <div className="text-[11px] font-bold text-blue-700 mt-0.5">Dates in Selection</div>
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
                  <div className="text-[11px] font-bold text-emerald-700 mt-0.5">Selection Grand Total</div>
                </div>
              </div>
            )}

            {/* ── DOWNLOAD PACKAGES FOR SELECTED MONTH ── */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
              <div className="bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    Download Packages &bull; {selectedMonth === 'ALL' ? (selectedYear === 'ALL' ? 'All Years & All Months' : `Year ${selectedYear}`) : `${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-500 normal-case">
                  {filteredDates.length} dates stored
                </span>
              </div>

              <div className="p-4 space-y-3">
                {filteredDates.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                    <div className="text-xs font-black text-slate-700">
                      No files stored for {selectedMonth === 'ALL' ? (selectedYear === 'ALL' ? 'All Years' : `Year ${selectedYear}`) : `${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Upload daily attendance sheets in Stage 2 to store and generate workbooks.
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
                          <span className="text-xs font-black">Vault Backup (JSON)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Full parsed numbers and file references for backup.
                        </p>
                      </div>
                      <button
                        onClick={handleDownloadJson}
                        disabled={downloading === 'json'}
                        className="w-full py-2 text-xs font-bold bg-white text-slate-800 border border-slate-300 rounded-full hover:bg-slate-100 transition cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        {downloading === 'json' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-slate-600" />}
                        <span>Export Backup</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── STORED DAILY ATTENDANCE FILES ────────── */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-slate-700">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>
                    Stored Daily Attendance Records ({filteredDates.length} Active in Filter)
                  </span>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center space-x-2">
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      onClick={() => setViewMode('calendar')}
                      className={`px-3 py-1 text-xs font-black rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                        viewMode === 'calendar'
                          ? 'bg-amber-400 text-slate-950 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Calendar Mode</span>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-1 text-xs font-black rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                        viewMode === 'list'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>List Mode</span>
                    </button>
                  </div>
                </div>
              </div>

              {monthGroups.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <div className="text-sm font-black text-slate-700">No attendance reports loaded for this selection</div>
                  <p className="text-xs text-slate-400 mt-1">Switch month above or upload new files in Stage 2.</p>
                </div>
              ) : (
                monthGroups.map(group => (
                  <div key={group.key} className="rounded-2xl border-2 border-amber-200 bg-white overflow-hidden shadow-2xs">
                    {/* Month Group Header */}
                    <div className="px-5 py-3 bg-amber-100/80 border-b border-amber-200 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-xs rounded-md shadow-2xs">
                          {group.monthName} {group.year}
                        </span>
                        <span className="text-xs font-bold text-amber-950">
                          {group.items.length} attendance date{group.items.length > 1 ? 's' : ''} stored
                        </span>
                      </div>
                      {group.items.some(i => i.result) && (
                        <span className="text-xs font-mono font-black text-amber-900">
                          ₹{fmt(group.items.reduce((s, i) => s + (i.result ? i.result.gTot : 0), 0))} total
                        </span>
                      )}
                    </div>

                    {/* ── CALENDAR MODE ── */}
                    {viewMode === 'calendar' ? (
                      <div className="p-3 bg-slate-50/40">
                        {/* Weekday Names */}
                        <div className="grid grid-cols-7 text-center pb-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                          <div>Mon</div>
                          <div>Tue</div>
                          <div>Wed</div>
                          <div>Thu</div>
                          <div>Fri</div>
                          <div className="text-amber-700">Sat</div>
                          <div className="text-rose-700">Sun</div>
                        </div>

                        {/* 7-Column Days Grid */}
                        <div className="grid grid-cols-7 gap-2">
                          {renderCalendarCells(group)}
                        </div>
                      </div>
                    ) : (
                      /* ── LIST MODE ── */
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white">
                        {group.items.map(item => {
                          const r = item.result;
                          const filesCount = item.files ? item.files.length : 0;
                          return (
                            <div
                              key={item.dateKey}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-300 transition flex flex-col justify-between space-y-2"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="text-xs font-black text-slate-900">{formatDateDisplay(item.dateObj)}</div>
                                  <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                    {r ? (
                                      <>
                                        HC: <strong className="text-slate-800">{r.gHC}</strong> &bull; Total: <strong className="text-emerald-700 font-mono">₹{fmt(r.gTot)}</strong>
                                      </>
                                    ) : (
                                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                                        {filesCount} files loaded (Pending Reconcile)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center space-x-1.5 flex-shrink-0">
                                  {r && (
                                    <button
                                      onClick={() => handleDownloadDay(item)}
                                      disabled={downloading === item.dateKey}
                                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-400 hover:text-slate-950 text-slate-700 text-[11px] font-bold border border-slate-200 transition cursor-pointer flex items-center space-x-1"
                                      title="Download single day Excel"
                                    >
                                      {downloading === item.dateKey ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Download className="w-3 h-3" />
                                      )}
                                      <span>Excel</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete attendance data for ${formatDateDisplay(item.dateObj)}?\nThis cannot be undone.`)) {
                                        onDeleteDate && onDeleteDate(item.dateKey || item.dateObj);
                                      }
                                    }}
                                    className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 border border-rose-200 transition cursor-pointer flex items-center justify-center"
                                    title={`Delete ${formatDateDisplay(item.dateObj)}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Show uploaded filenames if available */}
                              {item.files && item.files.length > 0 && (
                                <div className="pt-1.5 border-t border-slate-200/60 flex flex-wrap gap-1">
                                  {item.files.map((f, fi) => (
                                    <span key={fi} className="inline-flex items-center text-[10px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono">
                                      <FileText className="w-2.5 h-2.5 mr-1 text-blue-500" />
                                      {f.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* ── ACTIVE RATE MASTER ROSTER ────────────── */}
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

            {/* ── RE-OPEN RECONCILIATION BUTTON ────────── */}
            {allStoredDates.length > 0 && onRerunReconciliation && (
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
          <div className="flex items-center justify-between p-5 border-t border-slate-200 bg-slate-50 flex-shrink-0">
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
