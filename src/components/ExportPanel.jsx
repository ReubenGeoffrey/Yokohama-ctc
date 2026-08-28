import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, Archive, CheckCircle, Sparkles, ArrowRight, Calendar, Check } from 'lucide-react';
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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div className="maya-card p-8 sm:p-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-8 border-b border-slate-100 gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-black uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Stage 04 &bull; Export Center</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Executive Excel Packages
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              Download unified monthly summary reports and daily workbooks formatted for plant management and payroll reconciliation.
            </p>
          </div>

          <span className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black self-start sm:self-auto shadow-2xs">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Ready for Export</span>
          </span>
        </div>

        {/* If multiple months exist, show month selection tabs */}
        {availableMonths.length > 1 && (
          <div className="mt-6 flex items-center space-x-3 bg-warm-canvas p-3 rounded-2xl border border-slate-200">
            <Calendar className="w-4 h-4 text-blue-600 ml-2" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">Choose Export Month:</span>
            <div className="flex gap-2">
              {availableMonths.map(m => (
                <button
                  key={m.key}
                  onClick={() => setSelectedMonthKey(m.key)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    selectedMonthKey === m.key
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m.label} ({m.count} dates)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Packages Grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Package 1 - Consolidated Master Excel */}
          <div className="maya-card-highlight p-8 relative flex flex-col justify-between bg-amber-50/20">
            {/* Top Golden Most Popular Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 font-black text-[11px] uppercase tracking-wider px-4 py-1 rounded-full shadow-md">
              ⭐ Most Popular Output
            </div>

            <div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-3 py-1 rounded-full">
                  {currentMonthConfig.label} Master
                </span>
                <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>

              <h3 className="text-2xl font-black text-slate-900 mt-4">
                Consolidated Master Excel
              </h3>

              {/* Clean 2-line explanation */}
              <div className="mt-4 space-y-2 text-sm text-slate-700 font-medium leading-relaxed">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <span>
                    Full monthly executive breakdown combining <strong>Master Summary</strong> with <strong>ATC</strong>, <strong>CL</strong>, and <strong>NAPS</strong> employee rosters.
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <span>
                    Formatted with standard yellow headers, shift counts, overtime totals, and zero merged rows.
                  </span>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDownloadMonthly}
              disabled={downloadingMonthly}
              className="btn-yellow mt-8 w-full py-4 text-sm flex items-center justify-center space-x-2 cursor-pointer shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingMonthly ? 'Building Master Excel...' : `Get Consolidated Master (${currentMonthConfig.label})`}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </motion.button>
          </div>

          {/* Package 2 - Complete ZIP Archive */}
          <div className="maya-card p-8 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                  {currentMonthConfig.label} Archive
                </span>
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
                  <Archive className="w-5 h-5" />
                </div>
              </div>

              <h3 className="text-2xl font-black text-slate-900 mt-4">
                Complete Daily ZIP Archive
              </h3>

              {/* Clean 2-line explanation */}
              <div className="mt-4 space-y-2 text-sm text-slate-700 font-medium leading-relaxed">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <span>
                    All individual daily Excel workbooks packaged with the Monthly Consolidated Master into one archive.
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <span>
                    Ready for management review, plant audit, and long-term offline record-keeping.
                  </span>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="btn-blue mt-8 w-full py-4 text-sm flex items-center justify-center space-x-2 cursor-pointer shadow-lg"
            >
              <Archive className="w-4 h-4" />
              <span>{downloadingZip ? 'Compressing Files...' : `Download Daily Files ZIP (${currentMonthConfig.label})`}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default ExportPanel;
