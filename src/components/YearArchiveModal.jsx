import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Download, FolderArchive, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { SupabaseService, getSupabaseClient } from '../services/supabase';
import { downloadBlob } from '../services/excelEngine';

export function YearArchiveModal({ isOpen, onClose }) {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(7); // August (0-indexed)
  const [filesList, setFilesList] = useState({ master: [], attendance: [], output: [] });
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(null);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [2024, 2025, 2026, 2027, 2028];

  const loadData = async () => {
    if (!getSupabaseClient()) return;
    setLoading(true);
    try {
      const fl = await SupabaseService.listMonthlyFiles(selectedYear, selectedMonth);
      setFilesList(fl);
      const sumList = await SupabaseService.getHistoricalSummaries();
      setSummaries(sumList);
    } catch (e) {
      console.warn('Error loading archive data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, selectedYear, selectedMonth]);

  if (!isOpen) return null;

  const currentSummary = summaries.find(s => s.year === selectedYear && s.month === selectedMonth);

  const handleDownloadCloudFile = async (category, fileName) => {
    setDownloadingFile(fileName);
    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const path = `${selectedYear}/${monthStr}/${category}/${fileName}`;
    const data = await SupabaseService.downloadFile(path);
    if (data) {
      downloadBlob(data, fileName);
    } else {
      alert('Could not download file from cloud.');
    }
    setDownloadingFile(null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="luxury-glass rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/70">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25 font-black">
                <FolderArchive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Year-by-Year Cloud Archive Explorer</h3>
                <p className="text-xs text-slate-500 font-medium">Stores 120+ attendance files per month permanently in Supabase</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Year and Month Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Select Year
              </label>
              <div className="flex space-x-2">
                {years.map(yr => (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      selectedYear === yr
                        ? 'luxury-btn-primary text-white shadow-md'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs'
                    }`}
                  >
                    {yr}
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Select Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-2xs"
              >
                {months.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Monthly Summary Overview Card */}
          {currentSummary && (
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shadow-xs">
              <div>
                <span className="text-slate-500 font-semibold">Total Man-days</span>
                <div className="text-base font-black text-slate-900 mt-1">{(currentSummary.total_headcount || 0).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Daily CTC</span>
                <div className="text-base font-black text-slate-900 mt-1">{(currentSummary.daily_ctc || 0).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">OT Wages</span>
                <div className="text-base font-black text-slate-900 mt-1">{(currentSummary.ot_wages || 0).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-rose-700 font-black">Grand Total</span>
                <div className="text-base font-black text-rose-700 mt-1">{(currentSummary.grand_total || 0).toLocaleString()}</div>
              </div>
            </div>
          )}

          {/* Files Explorer Grid */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-rose-600" />
                <span>Querying Supabase Cloud Storage...</span>
              </div>
            ) : (
              <>
                {/* Output Workbooks Section */}
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-800 flex items-center justify-between">
                    <span>Generated Monthly Workbooks ({filesList.output.length})</span>
                  </div>
                  {filesList.output.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {filesList.output.map((f, i) => (
                        <div key={i} className="p-3.5 rounded-2xl bg-white/90 border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                          <div className="flex items-center space-x-2 truncate">
                            <FileSpreadsheet className="w-4 h-4 text-rose-600 flex-shrink-0" />
                            <span className="font-bold text-slate-900 truncate">{f.name}</span>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDownloadCloudFile('output', f.name)}
                            disabled={downloadingFile === f.name}
                            className="luxury-btn-primary px-3 py-1 text-white font-bold rounded-xl text-[11px] flex items-center space-x-1 shadow-xs cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>{downloadingFile === f.name ? '...' : 'Download'}</span>
                          </motion.button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-400 font-medium">
                      No output workbooks archived for {months[selectedMonth]} {selectedYear}.
                    </div>
                  )}
                </div>

                {/* Attendance Files Section */}
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-800 flex items-center justify-between">
                    <span>Archived Attendance Reports ({filesList.attendance.length} Files)</span>
                  </div>
                  {filesList.attendance.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                      {filesList.attendance.map((f, i) => (
                        <div key={i} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-[11px] shadow-2xs">
                          <span className="text-slate-800 truncate font-mono font-medium">{f.name}</span>
                          <button
                            onClick={() => handleDownloadCloudFile('attendance', f.name)}
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-400 font-medium">
                      No daily attendance reports archived for this month.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200/70 flex justify-end">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition cursor-pointer"
            >
              Close
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
