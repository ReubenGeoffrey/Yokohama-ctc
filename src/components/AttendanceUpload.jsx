import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FolderUp, UploadCloud, Calendar, Zap, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
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

export function AttendanceUpload({ master, batchDates, setBatchDates, onReconciled, onNext }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleFiles = async (fileList) => {
    if (!fileList || !fileList.length) return;
    setIsProcessing(true);

    const newBatchDates = { ...batchDates };

    for (const file of Array.from(fileList)) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) continue;
      if (file.name.startsWith('~$') || file.name.includes('CL CTC') || file.name.includes('Template Update')) continue;

      try {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array', cellDates: true });
        const wsName = wb.SheetNames.includes('Present') ? 'Present' : wb.SheetNames[0];
        const rows = sheetToRows(wb.Sheets[wsName]);
        const hIdx = findHeaderRowIdx(rows);
        if (hIdx === -1) continue;

        const detectedDate = extractDateFromAnywhere(rows, file.name);
        if (!detectedDate) continue;

        const category = detectCategory(rows, hIdx, file.name);
        const records = parsePresentRecords(rows, hIdx);
        const dateKey = formatDateToInput(detectedDate);

        if (!newBatchDates[dateKey]) {
          newBatchDates[dateKey] = {
            date: detectedDate,
            CL: null,
            OP: null,
            NAPS: null,
            files: []
          };
        }

        newBatchDates[dateKey][category] = records;
        newBatchDates[dateKey].files.push({
          name: file.name,
          category,
          recordsCount: records.length,
          wopCount: records.filter(r => r.isWop).length
        });
      } catch (err) {
        console.warn('Error reading attendance file:', file.name, err);
      }
    }

    setBatchDates(newBatchDates);
    await StorageService.saveAttendanceFiles(newBatchDates);
    setIsProcessing(false);
  };

  const handleReconcileAll = async () => {
    if (!master) {
      alert('Please upload the CTC Master Roster first.');
      return;
    }

    const sortedDateKeys = Object.keys(batchDates).sort();
    if (!sortedDateKeys.length) {
      alert('No valid attendance dates detected.');
      return;
    }

    const results = [];
    sortedDateKeys.forEach(dKey => {
      const dObj = batchDates[dKey];
      const res = reconcileDay(dObj.date, dObj, master);
      results.push(res);
    });

    const empStats = aggregateMonthlyStats(results, master);
    await StorageService.saveBatchResults({ results, empStats });
    onReconciled(results, empStats);
    onNext();
  };

  const detectedDateKeys = Object.keys(batchDates).sort();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div className="maya-card p-8 sm:p-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-black uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Stage 02 • Daily Reports</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Daily Attendance Sheets
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              Upload individual daily attendance sheets or entire folders (<code className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md font-mono font-bold">INPUT AUG Present/</code>).
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => folderInputRef.current?.click()}
              className="btn-yellow px-5 py-2.5 text-xs flex items-center space-x-1.5 cursor-pointer shadow-md"
            >
              <FolderUp className="w-4 h-4" />
              <span>Upload Folder</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-blue px-5 py-2.5 text-xs flex items-center space-x-1.5 cursor-pointer shadow-md"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Files</span>
            </button>
          </div>
        </div>

        {/* Hidden Inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFiles(e.target.files)}
          multiple
          accept=".xlsx,.xls"
          className="hidden"
        />
        <input
          type="file"
          ref={folderInputRef}
          onChange={(e) => handleFiles(e.target.files)}
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
        />

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          className={`mt-6 border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
              : 'border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/20'
          }`}
          onClick={() => folderInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
              {isProcessing ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FolderUp className="w-8 h-8" />
              )}
            </div>
            <div>
              <div className="text-base font-black text-slate-900">
                Drag & Drop Attendance Folder or Files Here
              </div>
              <div className="text-xs text-slate-500 mt-1 font-medium">
                Auto-detects dates, Operator, CL, NAPS categories, and WOP (Weekly Off Present) shifts
              </div>
            </div>
          </div>
        </div>

        {/* Detected Dates Breakdown Grid */}
        {detectedDateKeys.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Detected Dates ({detectedDateKeys.length} Days Ready for Reconciliation)</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {detectedDateKeys.map(dKey => {
                const item = batchDates[dKey];
                const clCount = item.CL ? item.CL.length : 0;
                const opCount = item.OP ? item.OP.length : 0;
                const napsCount = item.NAPS ? item.NAPS.length : 0;
                const totalWop = (item.CL ? item.CL.filter(r => r.isWop).length : 0) +
                                 (item.OP ? item.OP.filter(r => r.isWop).length : 0) +
                                 (item.NAPS ? item.NAPS.filter(r => r.isWop).length : 0);

                return (
                  <div
                    key={dKey}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-amber-400 hover:shadow-md transition"
                  >
                    <div className="text-sm font-black text-slate-900 flex items-center justify-between">
                      <span>{formatDateDisplay(item.date)}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2.5 py-0.5 rounded-full">
                        Ready
                      </span>
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs text-slate-600 font-medium">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Operator:</span> <span className="font-mono font-bold text-slate-900">{opCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Contract:</span> <span className="font-mono font-bold text-slate-900">{clCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">NAPS:</span> <span className="font-mono font-bold text-slate-900">{napsCount}</span>
                      </div>
                      {totalWop > 0 && (
                        <div className="flex justify-between text-amber-600 font-bold pt-1.5 border-t border-slate-100">
                          <span>WOP Shifts:</span> <span className="font-mono">{totalWop}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reconcile Action Button */}
            <div className="mt-8 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleReconcileAll}
                className="btn-yellow px-9 py-3.5 text-sm flex items-center space-x-2 cursor-pointer shadow-lg"
              >
                <Zap className="w-4 h-4" />
                <span>Reconcile All Dates & Open Matrix</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
