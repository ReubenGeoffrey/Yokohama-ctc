import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, Archive, CheckCircle, Sparkles, ArrowRight } from 'lucide-react';
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
              <span>Stage 04 • Export Center</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Executive Excel Packages{' '}
              <span className="text-amber-500 font-handwriting text-4xl ml-1 font-bold">
                Big Impact ☀️
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              Download professionally styled workbooks formatted with warm minimalist yellow headers, 0 merged rows, and Total WOP counts.
            </p>
          </div>

          <span className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black self-start sm:self-auto shadow-2xs">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Ready for Export</span>
          </span>
        </div>

        {/* Packages Grid (Exact Maya Style with "MOST POPULAR" Badge) */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Package 1 - Highlighting "MOST POPULAR" */}
          <div className="maya-card-highlight p-8 relative flex flex-col justify-between bg-amber-50/20">
            {/* Top Golden Most Popular Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 font-black text-[11px] uppercase tracking-wider px-4 py-1 rounded-full shadow-md">
              ⭐ Most Popular Output
            </div>

            <div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-3 py-1 rounded-full">
                  Monthly Master
                </span>
                <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>

              <h3 className="text-2xl font-black text-slate-900 mt-4">
                Consolidated Master Excel
              </h3>
              <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                Contains the Master <strong>Summary</strong> worksheet plus full employee rosters in <strong>ATC</strong>, <strong>CL</strong>, and <strong>NAPS</strong> sheets.
              </p>

              <div className="mt-6 space-y-2.5 text-xs text-slate-700 font-medium">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Minimalist Yellow Headers (<code className="text-amber-900 bg-amber-200/60 px-1.5 py-0.5 rounded font-mono font-bold">#FFE699</code>)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Columns A to I (NO Column A Gap, starts at Col 1)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Includes <strong className="text-amber-900">Total WOP Count</strong> (Weekly Off Present)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>0 Merged Rows (1 single row per employee)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Clean Number Formatting (<code className="text-slate-800 bg-white px-1.5 py-0.5 rounded font-mono font-bold border border-slate-200">#,##0</code> without ₹ symbol)</span>
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
              <span>{downloadingMonthly ? 'Building Master Excel...' : 'Get Consolidated Master (.xlsx)'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </motion.button>
          </div>

          {/* Package 2 - Complete ZIP Archive */}
          <div className="maya-card p-8 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                  Batch Archive
                </span>
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
                  <Archive className="w-5 h-5" />
                </div>
              </div>

              <h3 className="text-2xl font-black text-slate-900 mt-4">
                Complete Daily ZIP Archive
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                Bundles all individual date workbooks (21-Aug, 22-Aug, 23-Aug, 24-Aug...) along with the Combined Monthly Master into a single zip file.
              </p>

              <div className="mt-6 space-y-2.5 text-xs text-slate-700 font-medium">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>All individual single-day Excel workbooks</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>Monthly Master Consolidated Workbook</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>Ready for plant management sharing & archiving</span>
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
              <span>{downloadingZip ? 'Compressing Files...' : 'Download All Daily Files (ZIP)'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
