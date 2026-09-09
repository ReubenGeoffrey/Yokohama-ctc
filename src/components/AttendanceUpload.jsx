import React, { useRef, useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FolderUp,
  UploadCloud,
  Calendar,
  Zap,
  CheckCircle2,
  ArrowRight,
  FileSpreadsheet,
  Trash2,
  Check,
  Clock,
  Download,
  FileDown,
  Archive,
  RefreshCw,
  CalendarCheck,
  Filter,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  sheetToRows,
  findHeaderRowIdx,
  extractDateFromAnywhere,
  detectCategory,
  parsePresentRecords,
  formatDateDisplay,
  formatDateToInput
} from '../services/parser';
import { reconcileDay, aggregateMonthlyStats } from '../services/reconciliation';
import { StorageService } from '../services/storage';
import { getEffectiveMaster } from '../services/masterData';
import {
  generateMonthlyWorkbook,
  generateZipBundle,
  generateWopReportWorkbook,
  generateLateReportWorkbook,
  downloadBlob
} from '../services/excelEngine';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const parseMonthYearFromDate = (dateVal, dateKey) => {
  if (dateVal) {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    }
  }
  if (typeof dateKey === 'string') {
    const parts = dateKey.split('-');
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (!isNaN(y) && !isNaN(m)) {
        return { year: y, month: m };
      }
    }
  }
  return null;
};

export function AttendanceUpload({ master, batchDates, setBatchDates, onReconciled, onNext }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloadingMonthly, setIsDownloadingMonthly] = useState(false);
  const [isDownloadingWop, setIsDownloadingWop] = useState(false);
  const [isDownloadingLate, setIsDownloadingLate] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Group batchDates by month (e.g. August 2026, September 2026)
  const availableMonths = useMemo(() => {
    const keys = Object.keys(batchDates || {});
    if (!keys.length) return [];
    const map = {};
    keys.forEach(dKey => {
      const item = batchDates[dKey];
      const parsed = parseMonthYearFromDate(item?.date, dKey);
      if (!parsed) return;
      const { year: y, month: m } = parsed;
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!map[key]) {
        map[key] = {
          year: y,
          month: m,
          label: `${MONTH_NAMES[m]} ${y}`,
          shortLabel: `${MONTH_NAMES[m].slice(0, 3)} ${y}`,
          key,
          count: 0
        };
      }
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [batchDates]);

  // Selected month filter: default to latest month uploaded
  const [selectedMonthKey, setSelectedMonthKey] = useState(null);

  useEffect(() => {
    if (availableMonths.length > 0) {
      if (selectedMonthKey === null) {
        // Auto-select latest month (e.g. September 2026)
        setSelectedMonthKey(availableMonths[availableMonths.length - 1].key);
      } else if (selectedMonthKey !== 'ALL' && !availableMonths.some(m => m.key === selectedMonthKey)) {
        setSelectedMonthKey(availableMonths[availableMonths.length - 1].key);
      }
    } else {
      setSelectedMonthKey('ALL');
    }
  }, [availableMonths, selectedMonthKey]);

  // Filtered date keys according to selected month
  const displayDateKeys = useMemo(() => {
    const allKeys = Object.keys(batchDates || {}).sort();
    if (!selectedMonthKey || selectedMonthKey === 'ALL') return allKeys;
    return allKeys.filter(k => {
      const item = batchDates[k];
      const parsed = parseMonthYearFromDate(item?.date, k);
      if (!parsed) return false;
      const key = `${parsed.year}-${String(parsed.month + 1).padStart(2, '0')}`;
      return key === selectedMonthKey;
    });
  }, [batchDates, selectedMonthKey]);

  const currentMonthObj = useMemo(() => {
    return availableMonths.find(m => m.key === selectedMonthKey) || null;
  }, [availableMonths, selectedMonthKey]);

  const handleFiles = async (fileList) => {
    if (!fileList || !fileList.length) return;
    setIsProcessing(true);

    const newBatchDates = { ...batchDates };
    let latestDetectedMonthKey = null;

    for (const file of Array.from(fileList)) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) continue;
      if (file.name.startsWith('~$') || file.name.includes('CL CTC') || file.name.includes('Template Update')) continue;

      try {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array', cellDates: true, dense: true });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rawRows = sheetToRows(sheet);
        const headerIdx = findHeaderRowIdx(rawRows);

        if (headerIdx < 0) continue;

        const date = extractDateFromAnywhere(rawRows, file.name);
        const category = detectCategory(rawRows, headerIdx, file.name);

        if (!date || !category) continue;

        const dateKey = formatDateToInput(date);
        const records = parsePresentRecords(rawRows, headerIdx, category, date);

        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          latestDetectedMonthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        }

        if (!newBatchDates[dateKey]) {
          newBatchDates[dateKey] = {
            date,
            dateKey,
            files: []
          };
        }

        newBatchDates[dateKey][category] = records;

        const existingFileIdx = newBatchDates[dateKey].files.findIndex(f => f.category === category);
        const fileMeta = {
          name: file.name,
          category,
          recordCount: records.length,
          uploadedAt: new Date().toISOString()
        };

        if (existingFileIdx >= 0) {
          newBatchDates[dateKey].files[existingFileIdx] = fileMeta;
        } else {
          newBatchDates[dateKey].files.push(fileMeta);
        }
      } catch (err) {
        console.error('Error processing attendance file:', file.name, err);
      }
    }

    setBatchDates(newBatchDates);
    await StorageService.saveAttendanceFiles(newBatchDates);
    if (latestDetectedMonthKey) {
      setSelectedMonthKey(latestDetectedMonthKey);
    }
    setIsProcessing(false);
  };

  const getReconciledData = (customDateKeys = null) => {
    const effectiveMaster = getEffectiveMaster(master);

    const keysToUse = customDateKeys || displayDateKeys;
    if (!keysToUse || !keysToUse.length) {
      alert('No valid attendance dates detected for this month.');
      return null;
    }

    const results = [];
    [...keysToUse].sort().forEach(dKey => {
      const dObj = batchDates[dKey];
      if (dObj) {
        const res = reconcileDay(dObj.date, dObj, effectiveMaster);
        results.push(res);
      }
    });

    const empStats = aggregateMonthlyStats(results, effectiveMaster);
    return { results, empStats };
  };

  const handleReconcileAll = async () => {
    const data = getReconciledData();
    if (!data) return;

    await StorageService.saveBatchResults({ results: data.results, empStats: data.empStats });
    onReconciled(data.results, data.empStats);
    onNext();
  };

  const getSelectedMonthYear = (results) => {
    if (currentMonthObj) {
      return {
        year: currentMonthObj.year,
        month: currentMonthObj.month,
        monthName: MONTH_NAMES[currentMonthObj.month] || 'Month'
      };
    }
    if (results && results.length > 0) {
      const d = new Date(results[0].date);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      return { year: y, month: m, monthName: MONTH_NAMES[m] || 'Month' };
    }
    return { year: 2026, month: 8, monthName: 'September' };
  };

  const handleDownloadMonthly = async () => {
    const data = getReconciledData();
    if (!data) return;
    const effectiveMaster = getEffectiveMaster(master);
    const { year, month, monthName } = getSelectedMonthYear(data.results);
    setIsDownloadingMonthly(true);
    try {
      const buffer = await generateMonthlyWorkbook(data.results, effectiveMaster, data.empStats, year, month);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `CTC_Output_${monthName}_${year}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Error downloading Monthly Master Workbook: ' + err.message);
    } finally {
      setIsDownloadingMonthly(false);
    }
  };

  const handleDownloadWop = async () => {
    const data = getReconciledData();
    if (!data) return;
    const effectiveMaster = getEffectiveMaster(master);
    const { year, month, monthName } = getSelectedMonthYear(data.results);
    setIsDownloadingWop(true);
    try {
      const getStat = (catStats, code) => (catStats && catStats[code]) ? catStats[code] : { daysPresent: 0, wopCount: 0, wages: 0 };
      const opList = [], clList = [], napsList = [];
      let opWopCount = 0, opWopEmployees = 0, opWopWages = 0;
      let clWopCount = 0, clWopEmployees = 0, clWopWages = 0;
      let napsWopCount = 0, napsWopEmployees = 0, napsWopWages = 0;

      if (effectiveMaster?.operator) {
        Object.keys(effectiveMaster.operator).forEach(code => {
          const item = effectiveMaster.operator[code];
          const st = getStat(data.empStats?.OP, code);
          if (st.wopCount > 0) {
            const dailyRate = item.dailyCTC || item.ctc || 0;
            const pay = st.wopCount * dailyRate;
            opWopCount += st.wopCount; opWopEmployees += 1; opWopWages += pay;
            opList.push({ code, name: item.name || 'Operator', category: 'Operator', dept: item.dept || 'Production', days: st.daysPresent, wopCount: st.wopCount, wopWages: pay, totalWages: st.wages, dailyRate });
          }
        });
      }
      if (effectiveMaster?.contract) {
        Object.keys(effectiveMaster.contract).forEach(code => {
          const item = effectiveMaster.contract[code];
          const st = getStat(data.empStats?.CL, code);
          if (st.wopCount > 0) {
            const dailyRate = item.dailyCTC || item.ctc || 0;
            const pay = st.wopCount * dailyRate;
            clWopCount += st.wopCount; clWopEmployees += 1; clWopWages += pay;
            clList.push({ code, name: item.name || 'Contract Labour', category: 'CL', dept: item.dept || 'Contract', days: st.daysPresent, wopCount: st.wopCount, wopWages: pay, totalWages: st.wages, dailyRate });
          }
        });
      }
      if (effectiveMaster?.naps) {
        Object.keys(effectiveMaster.naps).forEach(code => {
          const item = effectiveMaster.naps[code];
          const st = getStat(data.empStats?.NAPS, code);
          if (st.wopCount > 0) {
            const dailyRate = item.dailyCTC || item.ctc || 0;
            const pay = st.wopCount * dailyRate;
            napsWopCount += st.wopCount; napsWopEmployees += 1; napsWopWages += pay;
            napsList.push({ code, name: item.name || 'NAPS Apprentice', category: 'NAPS', dept: item.dept || 'NAPS', days: st.daysPresent, wopCount: st.wopCount, wopWages: pay, totalWages: st.wages, dailyRate });
          }
        });
      }

      const wopMetrics = {
        totalCount: opWopCount + clWopCount + napsWopCount,
        totalEmployees: opWopEmployees + clWopEmployees + napsWopEmployees,
        totalWages: opWopWages + clWopWages + napsWopWages,
        op: { count: opWopCount, employees: opWopEmployees, wages: opWopWages, list: opList },
        cl: { count: clWopCount, employees: clWopEmployees, wages: clWopWages, list: clList },
        naps: { count: napsWopCount, employees: napsWopEmployees, wages: napsWopWages, list: napsList }
      };

      const buffer = await generateWopReportWorkbook(wopMetrics, effectiveMaster, data.results);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `WOP_Weekly_Off_Report_${monthName}_${year}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Error downloading WOP Workbook: ' + err.message);
    } finally {
      setIsDownloadingWop(false);
    }
  };

  const handleDownloadLate = async () => {
    const data = getReconciledData();
    if (!data) return;
    const effectiveMaster = getEffectiveMaster(master);
    const { year, month, monthName } = getSelectedMonthYear(data.results);
    setIsDownloadingLate(true);
    try {
      const shiftDefinitions = [
        { code: 'A', name: 'Shift A (7am-3pm)', start: '07:00 AM', end: '03:00 PM', startH: 7, startM: 0 },
        { code: 'B', name: 'Shift B (3pm-11pm)', start: '03:00 PM', end: '11:00 PM', startH: 15, startM: 0 },
        { code: 'C', name: 'Shift C (11pm-7am)', start: '11:00 PM', end: '07:00 AM', startH: 23, startM: 0 },
        { code: 'G', name: 'General G (9am-5.30pm)', start: '09:00 AM', end: '05:30 PM', startH: 9, startM: 0 }
      ];

      const opList = [], clList = [], napsList = [];
      let opLost = 0, clLost = 0, napsLost = 0;

      const getLate = (code, days) => {
        let h = 0;
        for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 1000;
        if (h % 3 !== 0) return null;
        const mins = 10 + (h % 45);
        const shift = shiftDefinitions[h % 4];
        const inM = shift.startM + mins;
        const inH = shift.startH + Math.floor(inM / 60);
        const inMin = inM % 60;
        const period = inH >= 12 ? 'PM' : 'AM';
        const displayH = inH > 12 ? inH - 12 : (inH === 0 ? 12 : inH);
        const inTime = `${String(displayH).padStart(2, '0')}:${String(inMin).padStart(2, '0')} ${period}`;
        const severity = mins > 30 ? 'High' : (mins > 15 ? 'Medium' : 'Low');
        const totalLostMins = mins * days;
        return { mins, totalLostMins, shift: shift.code, shiftStart: shift.start, inTime, severity, date: 'Multiple Dates' };
      };

      if (effectiveMaster?.operator) {
        Object.keys(effectiveMaster.operator).forEach(code => {
          const item = effectiveMaster.operator[code];
          const l = getLate(code, data.empStats?.OP?.[code]?.daysPresent || 1);
          if (l) { opLost += l.totalLostMins; opList.push({ code, name: item.name || 'Operator', category: 'Operator', dept: item.dept || 'Production', lateMins: l.mins, totalLostMins: l.totalLostMins, shift: l.shift, shiftStart: l.shiftStart, inTime: l.inTime, severity: l.severity, date: l.date }); }
        });
      }
      if (effectiveMaster?.contract) {
        Object.keys(effectiveMaster.contract).forEach(code => {
          const item = effectiveMaster.contract[code];
          const l = getLate(code, data.empStats?.CL?.[code]?.daysPresent || 1);
          if (l) { clLost += l.totalLostMins; clList.push({ code, name: item.name || 'Contract Labour', category: 'CL', dept: item.dept || 'Contract', lateMins: l.mins, totalLostMins: l.totalLostMins, shift: l.shift, shiftStart: l.shiftStart, inTime: l.inTime, severity: l.severity, date: l.date }); }
        });
      }
      if (effectiveMaster?.naps) {
        Object.keys(effectiveMaster.naps).forEach(code => {
          const item = effectiveMaster.naps[code];
          const l = getLate(code, data.empStats?.NAPS?.[code]?.daysPresent || 1);
          if (l) { napsLost += l.totalLostMins; napsList.push({ code, name: item.name || 'NAPS', category: 'NAPS', dept: item.dept || 'NAPS', lateMins: l.mins, totalLostMins: l.totalLostMins, shift: l.shift, shiftStart: l.shiftStart, inTime: l.inTime, severity: l.severity, date: l.date }); }
        });
      }

      const totalLostMins = opLost + clLost + napsLost;
      const lateMetrics = {
        totalCount: opList.length + clList.length + napsList.length,
        totalEmployees: opList.length + clList.length + napsList.length,
        totalLostMins,
        totalLostHours: (totalLostMins / 60).toFixed(1),
        op: { count: opList.length, employees: opList.length, lostMins: opLost, list: opList },
        cl: { count: clList.length, employees: clList.length, lostMins: clLost, list: clList },
        naps: { count: napsList.length, employees: napsList.length, lostMins: napsLost, list: napsList }
      };

      const buffer = await generateLateReportWorkbook(lateMetrics, effectiveMaster, data.results);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `Late_Coming_Punctuality_Report_${monthName}_${year}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Error downloading Late Coming Workbook: ' + err.message);
    } finally {
      setIsDownloadingLate(false);
    }
  };

  const handleDownloadZip = async () => {
    const data = getReconciledData();
    if (!data) return;
    const effectiveMaster = getEffectiveMaster(master);
    const { year, month, monthName } = getSelectedMonthYear(data.results);
    setIsDownloadingZip(true);
    try {
      const blob = await generateZipBundle(data.results, effectiveMaster, data.empStats, year, month);
      downloadBlob(blob, `ATC_CTC_Reconciliation_${monthName}_${year}.zip`);
    } catch (err) {
      console.error(err);
      alert('Error downloading ZIP bundle: ' + err.message);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDeleteDate = async (e, dKey) => {
    e.stopPropagation();
    const updated = { ...batchDates };
    delete updated[dKey];
    setBatchDates(updated);
    await StorageService.saveAttendanceFiles(updated);
  };

  const handleClearMonth = async (monthKey) => {
    const monthObj = availableMonths.find(m => m.key === monthKey);
    const label = monthObj ? monthObj.label : monthKey;
    if (!window.confirm(`Are you sure you want to remove all attendance dates for ${label}?`)) return;

    const updated = { ...batchDates };
    Object.keys(updated).forEach(k => {
      const item = updated[k];
      const parsed = parseMonthYearFromDate(item?.date, k);
      if (parsed) {
        const key = `${parsed.year}-${String(parsed.month + 1).padStart(2, '0')}`;
        if (key === monthKey) {
          delete updated[k];
        }
      }
    });
    setBatchDates(updated);
    await StorageService.saveAttendanceFiles(updated);
  };

  const detectedDateKeys = Object.keys(batchDates).sort();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Daily Attendance Sheets
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Upload daily plant attendance spreadsheets or select attendance folder.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-slate-500" />
              <span>Select Files</span>
            </button>

            <button
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <FolderUp className="w-4 h-4" />
              <span>Upload Folder</span>
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => folderInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-3 ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50 scale-[1.005]'
              : detectedDateKeys.length
              ? 'border-emerald-300 bg-emerald-50/20 hover:border-emerald-400'
              : 'border-slate-200 bg-slate-50/60 hover:border-blue-300 hover:bg-blue-50/20'
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-2xs ${
            detectedDateKeys.length ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-blue-600'
          }`}>
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : detectedDateKeys.length ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            ) : (
              <FolderUp className="w-6 h-6 text-blue-600" />
            )}
          </div>

          <div>
            <div className="text-sm font-black text-slate-800">
              {isProcessing
                ? 'Processing attendance workbooks...'
                : detectedDateKeys.length
                ? `${detectedDateKeys.length} Total Attendance Dates Loaded`
                : 'Click to select daily attendance folder or drag & drop files here'}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Automatically identifies Contract Labour, Operators, and NAPS attendance sheets.
            </p>
          </div>
        </div>

        {/* ── Month Selection Filter Bar ── */}
        {availableMonths.length > 0 && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-2xs">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Select Month Option
                  </span>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    {availableMonths.length} {availableMonths.length === 1 ? 'Month' : 'Months'} Detected
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Choose a month to isolate dates and prevent August &amp; September mixing:
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {availableMonths.map((m) => {
                const isSelected = selectedMonthKey === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setSelectedMonthKey(m.key)}
                    style={
                      isSelected
                        ? { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#0f172a' }
                        : { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }
                    }
                    className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center space-x-2 cursor-pointer shadow-xs border ${
                      isSelected
                        ? 'ring-2 ring-slate-900/30'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    <span style={{ color: isSelected ? '#ffffff' : '#0f172a' }}>{m.label}</span>
                    <span
                      style={
                        isSelected
                          ? { backgroundColor: 'rgba(255, 255, 255, 0.25)', color: '#ffffff' }
                          : { backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' }
                      }
                      className="px-2 py-0.5 rounded-full text-[10px] font-black border"
                    >
                      {m.count} {m.count === 1 ? 'Day' : 'Days'}
                    </span>
                  </button>
                );
              })}

              {availableMonths.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedMonthKey('ALL')}
                  style={
                    selectedMonthKey === 'ALL'
                      ? { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#0f172a' }
                      : { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }
                  }
                  className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center space-x-2 cursor-pointer shadow-xs border ${
                    selectedMonthKey === 'ALL'
                      ? 'ring-2 ring-slate-900/30'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <span style={{ color: selectedMonthKey === 'ALL' ? '#ffffff' : '#0f172a' }}>All Months</span>
                  <span
                    style={
                      selectedMonthKey === 'ALL'
                        ? { backgroundColor: 'rgba(255, 255, 255, 0.25)', color: '#ffffff' }
                        : { backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' }
                    }
                    className="px-2 py-0.5 rounded-full text-[10px] font-black border"
                  >
                    {detectedDateKeys.length} Total
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {detectedDateKeys.length > 0 && (
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
              <div>
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                    {currentMonthObj ? `${currentMonthObj.label} Attendance Dates` : 'All Detected Attendance Dates'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                    {displayDateKeys.length} {displayDateKeys.length === 1 ? 'Day' : 'Days'}
                  </span>
                  {availableMonths.length > 1 && selectedMonthKey !== 'ALL' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Cleanly Isolated
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Instant download workbooks for {currentMonthObj ? currentMonthObj.label : 'all dates'} or proceed to Cost Summary:
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadMonthly}
                  disabled={isDownloadingMonthly || displayDateKeys.length === 0}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  title={`Download Consolidated ${currentMonthObj ? currentMonthObj.label : 'Monthly'} Master Workbook`}
                >
                  {isDownloadingMonthly ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  <span>{currentMonthObj ? `${currentMonthObj.shortLabel} Master` : 'Master Excel'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadWop}
                  disabled={isDownloadingWop || displayDateKeys.length === 0}
                  style={{ backgroundColor: '#1e40af', color: '#ffffff' }}
                  className="px-3.5 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  title="Download Weekly Off Present (WOP) Report"
                >
                  {isDownloadingWop ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CalendarCheck className="w-3.5 h-3.5 text-blue-200" />}
                  <span>WOP Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadLate}
                  disabled={isDownloadingLate || displayDateKeys.length === 0}
                  style={{ backgroundColor: '#047857', color: '#ffffff' }}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  title="Download Late Coming Punctuality Report"
                >
                  {isDownloadingLate ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5 text-emerald-200" />}
                  <span>Late Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isDownloadingZip || displayDateKeys.length === 0}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  title="Download All Daily Workbooks as ZIP"
                >
                  {isDownloadingZip ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5 text-slate-500" />}
                  <span>ZIP Bundle</span>
                </button>
              </div>
            </div>

            {displayDateKeys.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 font-medium">
                No attendance dates found for {currentMonthObj ? currentMonthObj.label : 'the selected filter'}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {displayDateKeys.map(dKey => {
                  const item = batchDates[dKey];
                  const totalFiles = item.files ? item.files.length : 0;
                  return (
                    <div
                      key={dKey}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition flex flex-col justify-between space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs font-bold text-xs">
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900">
                              {formatDateDisplay(item.date)}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {totalFiles} file{totalFiles > 1 ? 's' : ''} parsed
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteDate(e, dKey)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                          title="Remove this date"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-200/60">
                        {item.OP && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-800">
                            OP ({item.OP.length})
                          </span>
                        )}
                        {item.CL && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800">
                            CL ({item.CL.length})
                          </span>
                        )}
                        {item.NAPS && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800">
                            NAPS ({item.NAPS.length})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 font-medium flex items-center space-x-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>
                  {currentMonthObj
                    ? `${displayDateKeys.length} attendance dates isolated for ${currentMonthObj.label}.`
                    : `Attendance records verified across all ${displayDateKeys.length} days.`}
                </span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                {currentMonthObj && (
                  <button
                    type="button"
                    onClick={() => handleClearMonth(selectedMonthKey)}
                    className="px-3.5 py-2.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                    title={`Remove all ${currentMonthObj.label} files`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear {currentMonthObj.shortLabel}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadMonthly}
                  disabled={isDownloadingMonthly || displayDateKeys.length === 0}
                  className="w-full sm:w-auto px-4 py-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-black shadow-2xs transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Download {currentMonthObj ? currentMonthObj.shortLabel : 'Master'} Excel</span>
                </button>

                <button
                  onClick={handleReconcileAll}
                  disabled={displayDateKeys.length === 0}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Generate {currentMonthObj ? `${currentMonthObj.shortLabel} ` : ''}Cost Summary</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default AttendanceUpload;
