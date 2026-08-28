import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, HardDrive, FileSpreadsheet, Calendar, Trash2,
  CheckCircle2, Download, RefreshCw, FileDown,
  Package, BarChart3, AlertCircle, Play, ChevronDown, ChevronRight,
  ChevronLeft, FileText, ArrowUpRight, Check, LayoutGrid, List, Sparkles
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

const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
  const [viewMode, setViewMode] = useState('gcal'); // 'gcal' (Google Cal) or 'list'

  // Google Calendar state
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(7); // 7 = August (0-indexed)
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  const hasMaster = !!masterMeta;
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
  }, [safeBatchDates, safeBatchResults]);

  const allStoredDates = useMemo(() => {
    return Object.values(allStoredDatesMap).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [allStoredDatesMap]);

  // Set default selectedDayKey if available
  useEffect(() => {
    if (!selectedDayKey && allStoredDates.length > 0) {
      setSelectedDayKey(allStoredDates[0].isoKey);
      setCalYear(allStoredDates[0].year);
      setCalMonth(allStoredDates[0].month);
    }
  }, [allStoredDates, selectedDayKey]);

  // Extract comprehensive years (1990 to 2060 + any custom years found in stored data)
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    for (let y = 1990; y <= 2060; y++) {
      yearsSet.add(y);
    }
    allStoredDates.forEach(item => yearsSet.add(item.year));
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [allStoredDates]);

  // Month navigation
  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(prev => prev - 1);
    } else {
      setCalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(prev => prev + 1);
    } else {
      setCalMonth(prev => prev + 1);
    }
  };

  // Google Calendar 42-day grid math (Sunday = 0)
  const calendarGrid = useMemo(() => {
    const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay(); // Sunday = 0, Saturday = 6
    const daysInCurrentMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

    const cells = [];

    // 1. Previous month trailing days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevM = calMonth === 0 ? 11 : calMonth - 1;
      const prevY = calMonth === 0 ? calYear - 1 : calYear;
      const dateObj = new Date(Date.UTC(prevY, prevM, dayNum));
      const dateIso = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const storedItem = allStoredDatesMap[dateIso];
      cells.push({
        dayNum,
        isCurrentMonth: false,
        year: prevY,
        month: prevM,
        dateObj,
        dateIso,
        storedItem
      });
    }

    // 2. Current month days (1 to daysInCurrentMonth)
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateObj = new Date(Date.UTC(calYear, calMonth, d));
      const dateIso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const storedItem = allStoredDatesMap[dateIso];
      cells.push({
        dayNum: d,
        isCurrentMonth: true,
        year: calYear,
        month: calMonth,
        dateObj,
        dateIso,
        storedItem
      });
    }

    // 3. Next month leading days (fill to 35 or 42 slots)
    const remaining = (7 - (cells.length % 7)) % 7;
    const nextM = calMonth === 11 ? 0 : calMonth + 1;
    const nextY = calMonth === 11 ? calYear + 1 : calYear;
    for (let d = 1; d <= remaining || (cells.length < 35 && d <= remaining + 7); d++) {
      if (cells.length >= 35 && cells.length % 7 === 0) break;
      const dateObj = new Date(Date.UTC(nextY, nextM, d));
      const dateIso = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const storedItem = allStoredDatesMap[dateIso];
      cells.push({
        dayNum: d,
        isCurrentMonth: false,
        year: nextY,
        month: nextM,
        dateObj,
        dateIso,
        storedItem
      });
    }

    return cells;
  }, [calYear, calMonth, allStoredDatesMap]);

  // Current month's stored dates
  const currentMonthStoredDates = useMemo(() => {
    return allStoredDates.filter(i => i.year === calYear && i.month === calMonth);
  }, [allStoredDates, calYear, calMonth]);

  const currentMonthResults = useMemo(() => {
    return currentMonthStoredDates.map(i => i.result).filter(Boolean);
  }, [currentMonthStoredDates]);

  // Current selected day's item
  const selectedDayItem = useMemo(() => {
    if (!selectedDayKey) return currentMonthStoredDates[0] || null;
    return allStoredDatesMap[selectedDayKey] || null;
  }, [selectedDayKey, allStoredDatesMap, currentMonthStoredDates]);

  // Metrics for current month
  const monthTotCTC = currentMonthResults.reduce((s, r) => s + (r.gCTC || 0), 0);
  const monthTotOT = currentMonthResults.reduce((s, r) => s + (r.gOT || 0), 0);
  const monthTotCost = monthTotCTC + monthTotOT;
  const monthTotHC = currentMonthResults.reduce((s, r) => s + (r.gHC || 0), 0);

  const fmt = (n) => (Math.round(n) || 0).toLocaleString('en-IN');
  const fmtN = (n) => (n || 0).toLocaleString('en-IN');

  const handleDownloadMonthly = async () => {
    if (!currentMonthResults.length) {
      alert(`No reconciled results found for ${MONTH_NAMES[calMonth]} ${calYear}.`);
      return;
    }
    setDownloading('monthly');
    try {
      const monthName = MONTH_NAMES[calMonth];
      const buffer = await generateMonthlyWorkbook(currentMonthResults, master, empStats, calYear, calMonth);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `CTC_Output_${monthName}_${calYear}.xlsx`);
    } catch (e) {
      alert('Error generating monthly workbook: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadZip = async () => {
    if (!currentMonthResults.length) {
      alert(`No reconciled results found for ${MONTH_NAMES[calMonth]} ${calYear}.`);
      return;
    }
    setDownloading('zip');
    try {
      const monthName = MONTH_NAMES[calMonth];
      const blob = await generateZipBundle(currentMonthResults, master, empStats, calYear, calMonth);
      downloadBlob(blob, `ATC_CTC_Reconciliation_${monthName}_${calYear}.zip`);
    } catch (e) {
      alert('Error generating zip bundle: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadDay = async (item) => {
    if (!item || !item.result) {
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
        month: `${MONTH_NAMES[calMonth]} ${calYear}`,
        masterMeta,
        recordCount: currentMonthStoredDates.length,
        dates: currentMonthStoredDates.map(item => ({
          date: item.dateKey,
          files: item.files,
          result: item.result
        }))
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `ATC_Vault_Backup_${MONTH_NAMES[calMonth]}_${calYear}.json`);
    } catch (e) {
      alert('Error exporting JSON: ' + e.message);
    } finally {
      setDownloading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border-2 border-amber-300 relative z-50 overflow-hidden flex flex-col"
          style={{ maxHeight: '94vh' }}
        >
          {/* ── Top Header ───────────────────────────── */}
          <div className="p-5 sm:px-8 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md font-black">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Attendance Calendar &amp; Stored Vault
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Select any month or date to view shift headcount, wages, and download workbooks.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* View Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  onClick={() => setViewMode('gcal')}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                    viewMode === 'gcal'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calendar</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>List View</span>
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Scrollable Body ────────────────────────── */}
          <div className="overflow-y-auto flex-1 p-5 sm:p-7 space-y-6 bg-slate-50/50">

            {viewMode === 'gcal' ? (
              /* ── GOOGLE CALENDAR MODE ────────────────── */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Google Calendar Mini Month Picker (col 1-7) */}
                <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  {/* Calendar Top Month Navigation Bar (Exact Google Calendar Style) */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2 flex-wrap">
                    <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-1 shadow-2xs">
                      {/* Month Dropdown */}
                      <select
                        value={calMonth}
                        onChange={(e) => setCalMonth(Number(e.target.value))}
                        className="text-sm sm:text-base font-black text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl px-2.5 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                      >
                        {MONTH_NAMES.map((name, idx) => (
                          <option key={idx} value={idx}>{name}</option>
                        ))}
                      </select>

                      {/* Direct Editable Year Input */}
                      <input
                        type="number"
                        value={calYear}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) setCalYear(val);
                        }}
                        className="w-20 text-sm sm:text-base font-black text-slate-900 bg-white border border-slate-200 rounded-xl px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                        min="1900"
                        max="2100"
                        title="Type any year freely"
                      />
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setCalYear(2026);
                          setCalMonth(7); // August 2026
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer border border-slate-200"
                        title="Jump to August 2026"
                      >
                        Aug 2026
                      </button>
                      <button
                        onClick={handlePrevMonth}
                        className="p-1.5 text-slate-600 hover:text-slate-950 hover:bg-slate-100 rounded-full transition cursor-pointer border border-slate-200"
                        title="Previous Month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleNextMonth}
                        className="p-1.5 text-slate-600 hover:text-slate-950 hover:bg-slate-100 rounded-full transition cursor-pointer border border-slate-200"
                        title="Next Month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Days of Week Header (S M T W T F S) */}
                  <div className="grid grid-cols-7 text-center text-xs font-black text-slate-400 py-1">
                    {WEEKDAYS_SHORT.map((wd, i) => (
                      <div key={i} className={i === 0 || i === 6 ? 'text-amber-600' : ''}>
                        {wd}
                      </div>
                    ))}
                  </div>

                  {/* 42-Slot Calendar Grid (Exact Google Calendar Design) */}
                  <div className="grid grid-cols-7 gap-y-2.5 gap-x-1 text-center select-none">
                    {calendarGrid.map((cell, idx) => {
                      const hasData = !!cell.storedItem;
                      const isSelected = selectedDayKey === cell.dateIso;
                      const isCurrentM = cell.isCurrentMonth;

                      return (
                        <div key={idx} className="flex flex-col items-center justify-center relative py-1">
                          <button
                            onClick={() => {
                              setSelectedDayKey(cell.dateIso);
                              if (!isCurrentM) {
                                setCalYear(cell.year);
                                setCalMonth(cell.month);
                              }
                            }}
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full text-xs font-black flex items-center justify-center transition cursor-pointer relative ${
                              hasData
                                ? isSelected
                                  ? 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-200 scale-105'
                                  : 'bg-amber-400 text-slate-950 hover:bg-amber-500 shadow-xs'
                                : isSelected
                                ? 'bg-slate-800 text-white ring-2 ring-slate-300'
                                : isCurrentM
                                ? 'text-slate-800 hover:bg-slate-100'
                                : 'text-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span>{cell.dayNum}</span>
                          </button>

                          {/* Green active dot for stored attendance records */}
                          {hasData && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shadow-xs" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Month summary pill */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span>= Stored Attendance Sheet</span>
                    </span>
                    <span className="font-bold text-slate-900">
                      {currentMonthStoredDates.length} dates recorded in {MONTH_NAMES[calMonth]} {calYear}
                    </span>
                  </div>
                </div>

                {/* Right Column: Selected Date Details & Actions (col 8-12) */}
                <div className="lg:col-span-5 space-y-4">
                  {selectedDayItem ? (
                    <motion.div
                      key={selectedDayItem.isoKey}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-5 rounded-3xl bg-white border-2 border-blue-200 shadow-sm space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                            Selected Date
                          </span>
                          <h3 className="text-xl font-black text-slate-900 mt-1">
                            {formatDateDisplay(selectedDayItem.dateObj)}
                          </h3>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black">
                          ● Stored
                        </span>
                      </div>

                      {/* Day Stats */}
                      {selectedDayItem.result ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-100">
                              <div className="text-[11px] font-bold text-blue-700">Total Headcount</div>
                              <div className="text-xl font-black text-blue-950 mt-0.5">
                                {fmtN(selectedDayItem.result.gHC)}
                              </div>
                            </div>
                            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
                              <div className="text-[11px] font-bold text-amber-800">Total CTC Wages</div>
                              <div className="text-xl font-black text-amber-950 mt-0.5">
                                ₹{fmt(selectedDayItem.result.gTot)}
                              </div>
                            </div>
                          </div>

                          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                            <div className="flex justify-between text-slate-600 font-medium">
                              <span>Direct Labour CTC:</span>
                              <strong className="text-slate-900">₹{fmt(selectedDayItem.result.dTot)} ({selectedDayItem.result.dHC} HC)</strong>
                            </div>
                            <div className="flex justify-between text-slate-600 font-medium">
                              <span>Indirect Labour CTC:</span>
                              <strong className="text-slate-900">₹{fmt(selectedDayItem.result.iTot)} ({selectedDayItem.result.iHC} HC)</strong>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
                          {selectedDayItem.files?.length || 1} file(s) loaded for this date (Pending reconciliation in Stage 3).
                        </div>
                      )}

                      {/* Day Action Buttons */}
                      <div className="pt-2 flex gap-2">
                        {selectedDayItem.result && (
                          <button
                            onClick={() => handleDownloadDay(selectedDayItem)}
                            disabled={downloading === selectedDayItem.dateKey}
                            className="flex-1 btn-yellow py-3 text-xs font-black flex items-center justify-center space-x-1.5 cursor-pointer shadow-md"
                          >
                            {downloading === selectedDayItem.dateKey ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            )}
                            <span>Download Day Excel</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete attendance data for ${formatDateDisplay(selectedDayItem.dateObj)}?\nThis cannot be undone.`)) {
                              onDeleteDate && onDeleteDate(selectedDayItem.dateKey || selectedDayItem.dateObj);
                            }
                          }}
                          className="px-3 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 border border-rose-200 transition cursor-pointer flex items-center justify-center"
                          title="Delete this date"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="p-8 rounded-3xl bg-white border border-dashed border-slate-200 text-center space-y-2">
                      <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                      <div className="text-sm font-black text-slate-700">Select a date from calendar</div>
                      <p className="text-xs text-slate-400">
                        Click on any highlighted day to inspect headcount, wages, or download Excel.
                      </p>
                    </div>
                  )}

                  {/* Month Export Packages Quick Widget */}
                  <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        {MONTH_NAMES[calMonth]} {calYear} Outputs
                      </div>
                      <span className="text-[11px] font-bold text-slate-500">
                        ₹{fmt(monthTotCost)} total
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleDownloadMonthly}
                        disabled={downloading === 'monthly' || currentMonthResults.length === 0}
                        className="btn-yellow py-2.5 px-3 text-xs font-black flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Master Excel</span>
                      </button>

                      <button
                        onClick={handleDownloadZip}
                        disabled={downloading === 'zip' || currentMonthResults.length === 0}
                        className="btn-blue py-2.5 px-3 text-xs font-black flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Daily ZIP</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── LIST VIEW MODE ──────────────────────── */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                    All Stored Records ({allStoredDates.length} Dates Total)
                  </span>
                  <button
                    onClick={handleDownloadJson}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Backup Vault (JSON)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allStoredDates.map(item => {
                    const r = item.result;
                    return (
                      <div
                        key={item.isoKey}
                        className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 transition flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            {formatDateDisplay(item.dateObj)}
                          </div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            {r ? (
                              <>HC: <strong>{r.gHC}</strong> &bull; Total: <strong className="text-emerald-700 font-mono">₹{fmt(r.gTot)}</strong></>
                            ) : (
                              <span className="text-amber-700 font-bold">Pending Reconcile</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {r && (
                            <button
                              onClick={() => handleDownloadDay(item)}
                              className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs flex items-center space-x-1"
                            >
                              <Download className="w-3 h-3" />
                              <span>Excel</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Delete attendance data for ${formatDateDisplay(item.dateObj)}?`)) {
                                onDeleteDate && onDeleteDate(item.dateKey || item.dateObj);
                              }
                            }}
                            className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Master Roster Info Footer */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span className="font-black text-slate-900">Active Rate Master:</span>
                <span className="text-slate-600 font-medium">{masterMeta?.fileName || 'Loaded'}</span>
                {masterMeta && (
                  <span className="text-slate-400 font-mono">({masterMeta.operatorCount + masterMeta.contractCount + masterMeta.napsCount} employees)</span>
                )}
              </div>

              {onRerunReconciliation && (
                <button
                  onClick={() => {
                    onRerunReconciliation();
                    onClose();
                  }}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition cursor-pointer flex items-center space-x-1.5 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Re-Open Reconciliation Matrix</span>
                </button>
              )}
            </div>

          </div>

          {/* ── Modal Footer ───────────────────────────── */}
          <div className="p-4 px-6 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to RESET all stored plant files and start fresh? This cannot be undone.')) {
                  onClearStorage && onClearStorage();
                  onClose();
                }
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center space-x-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset All Stored Data</span>
            </button>

            <button
              onClick={onClose}
              className="btn-yellow px-6 py-2 text-xs font-black cursor-pointer shadow-sm"
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
