import React, { useState, useEffect } from 'react';
import { X, Calendar, Download, FolderArchive, FileSpreadsheet, Layers, RefreshCw } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 font-bold">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Year-by-Year Cloud Archive Explorer</h3>
              <p className="text-xs text-slate-400">Stores 120+ attendance files per month permanently in Supabase</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Year and Month Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Year
            </label>
            <div className="flex space-x-2">
              {years.map(yr => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    selectedYear === yr
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-amber-400"
            >
              {months.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Monthly Summary Overview Card */}
        {currentSummary && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-slate-950 border border-amber-500/30 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400">Total Headcount</span>
              <div className="text-base font-extrabold text-white mt-1">{(currentSummary.total_headcount || 0).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-slate-400">Daily CTC</span>
              <div className="text-base font-extrabold text-white mt-1">₹{(currentSummary.daily_ctc || 0).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-slate-400">OT Wages</span>
              <div className="text-base font-extrabold text-white mt-1">₹{(currentSummary.ot_wages || 0).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-amber-300 font-semibold">Grand Total</span>
              <div className="text-base font-extrabold text-amber-400 mt-1">₹{(currentSummary.grand_total || 0).toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Files Explorer Grid */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>Querying Supabase Cloud Storage...</span>
            </div>
          ) : (
            <>
              {/* Output Workbooks Section */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Generated Monthly Workbooks ({filesList.output.length})</span>
                </div>
                {filesList.output.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filesList.output.map((f, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2 truncate">
                          <FileSpreadsheet className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span className="font-bold text-slate-200 truncate">{f.name}</span>
                        </div>
                        <button
                          onClick={() => handleDownloadCloudFile('output', f.name)}
                          disabled={downloadingFile === f.name}
                          className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-[11px] flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>{downloadingFile === f.name ? '...' : 'Download'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950/40 text-xs text-slate-500">
                    No output workbooks archived for {months[selectedMonth]} {selectedYear}.
                  </div>
                )}
              </div>

              {/* Attendance Files Section */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Archived Attendance Reports ({filesList.attendance.length} Files)</span>
                </div>
                {filesList.attendance.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                    {filesList.attendance.map((f, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 truncate font-mono">{f.name}</span>
                        <button
                          onClick={() => handleDownloadCloudFile('attendance', f.name)}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950/40 text-xs text-slate-500">
                    No daily attendance reports archived for this month.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
