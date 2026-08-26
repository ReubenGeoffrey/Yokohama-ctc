import React, { useState } from 'react';
import { Download, FileSpreadsheet, Archive, CheckCircle, Sparkles, Layers } from 'lucide-react';
import { generateMonthlyWorkbook, generateZipBundle, downloadBlob } from '../services/excelEngine';

export function ExportPanel({ batchResults, master, empStats }) {
  const [downloadingMonthly, setDownloadingMonthly] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const year = batchResults && batchResults.length ? new Date(batchResults[0].date).getUTCFullYear() : 2026;
  const month = batchResults && batchResults.length ? new Date(batchResults[0].date).getUTCMonth() : 7;

  const handleDownloadMonthly = async () => {
    setDownloadingMonthly(true);
    try {
      const buffer = await generateMonthlyWorkbook(batchResults, master, empStats, year, month);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, 'CTC_Output_August_2026.xlsx');
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
      const blob = await generateZipBundle(batchResults, master, empStats, year, month);
      downloadBlob(blob, 'ATC_CTC_Reconciliation_August_2026.zip');
    } catch (err) {
      console.error(err);
      alert('Error exporting ZIP bundle: ' + err.message);
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Download className="w-5 h-5 text-amber-400" />
              <span>Stage 4: Executive Excel & Archive Export Center</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Download professionally styled workbooks formatted with warm minimalist yellow headers, 0 merged rows, and Total WOP counts.
            </p>
          </div>

          <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-400/10 text-amber-400 border border-amber-400/30 rounded-full text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ready for Export</span>
          </span>
        </div>

        {/* Action Export Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Combined Monthly Master Workbook */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-950/80 to-slate-950 border border-amber-500/30 flex flex-col justify-between shadow-xl">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xl shadow-lg shadow-amber-500/30">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white mt-4">
                Combined Monthly Master Workbook
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Contains the Master <strong>Summary</strong> worksheet plus full employee rosters in <strong>ATC</strong>, <strong>CL</strong>, and <strong>NAPS</strong> sheets.
              </p>

              <div className="mt-4 space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Minimalist Yellow Headers (<code className="text-amber-300 font-mono">#FFE699</code>)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Columns A to I (NO Column A Gap, starts at Col 1)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Includes <strong className="text-amber-300">Total WOP Count</strong> (Weekly Off Present)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>0 Merged Rows (1 single row per employee)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Clean Number Formatting (<code className="text-amber-300 font-mono">#,##0</code> without ₹ symbol)</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDownloadMonthly}
              disabled={downloadingMonthly}
              className="mt-6 w-full flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingMonthly ? 'Building Master Excel...' : '📥 Download Monthly Workbook (.xlsx)'}</span>
            </button>
          </div>

          {/* Card 2: Complete ZIP Archive */}
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-xl">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20">
                <Archive className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white mt-4">
                Complete ZIP Archive Bundle
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Bundles all individual date workbooks (21-Aug, 22-Aug, 23-Aug, 24-Aug...) along with the Combined Monthly Master into a single zip file.
              </p>

              <div className="mt-4 space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-400" />
                  <span>All individual single-day Excel workbooks</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-400" />
                  <span>Monthly Master Consolidated Workbook</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-400" />
                  <span>Ready for plant management sharing & archiving</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="mt-6 w-full flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition cursor-pointer"
            >
              <Archive className="w-4 h-4 text-blue-400" />
              <span>{downloadingZip ? 'Compressing Files...' : '📦 Download All Daily Files (ZIP)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
