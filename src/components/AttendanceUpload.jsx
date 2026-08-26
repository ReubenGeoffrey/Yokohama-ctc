import React, { useRef, useState } from 'react';
import { FolderUp, UploadCloud, Calendar, Layers, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>Stage 2: Multi-Date Attendance Report Upload</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload individual daily attendance sheets or entire folders (<code className="text-amber-300 font-mono">INPUT AUG Present/</code>).
            </p>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <FolderUp className="w-4 h-4 text-amber-400" />
              <span>Upload Folder</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <UploadCloud className="w-4 h-4 text-blue-400" />
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
          className={`mt-6 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-amber-400 bg-amber-400/5 scale-[0.99]'
              : 'border-slate-700 bg-slate-950/40 hover:border-amber-400 hover:bg-slate-800/50'
          }`}
          onClick={() => folderInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center justify-center shadow-lg">
              {isProcessing ? (
                <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <FolderUp className="w-8 h-8" />
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200">
                Drag & Drop Attendance Folder or Files Here
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Auto-detects dates, Operator, CL, NAPS categories, and WOP (Weekly Off Present) shifts
              </div>
            </div>
          </div>
        </div>

        {/* Detected Dates Breakdown */}
        {detectedDateKeys.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Detected Dates ({detectedDateKeys.length} Days Ready)</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {detectedDateKeys.map(dKey => {
                const item = batchDates[dKey];
                const clCount = item.CL ? item.CL.length : 0;
                const opCount = item.OP ? item.OP.length : 0;
                const napsCount = item.NAPS ? item.NAPS.length : 0;
                const totalWop = (item.CL ? item.CL.filter(r => r.isWop).length : 0) +
                                 (item.OP ? item.OP.filter(r => r.isWop).length : 0) +
                                 (item.NAPS ? item.NAPS.filter(r => r.isWop).length : 0);

                return (
                  <div key={dKey} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 shadow-sm hover:border-slate-700 transition">
                    <div className="text-sm font-bold text-amber-400">
                      {formatDateDisplay(item.date)}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Operator:</span> <span className="font-mono text-slate-200">{opCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Contract:</span> <span className="font-mono text-slate-200">{clCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>NAPS:</span> <span className="font-mono text-slate-200">{napsCount}</span>
                      </div>
                      {totalWop > 0 && (
                        <div className="flex justify-between text-amber-400 font-semibold pt-1 border-t border-slate-800/60">
                          <span>WOP Shifts:</span> <span className="font-mono">{totalWop}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reconcile Action Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleReconcileAll}
                className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/20 transition cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>Reconcile & Generate Summary Matrix</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
