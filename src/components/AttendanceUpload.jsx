import React, { useRef, useState } from 'react';
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
  Clock
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
      alert('Please upload the CTC Master Roster first in Stage 1.');
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

  const handleDeleteDate = async (e, dKey) => {
    e.stopPropagation();
    const updated = { ...batchDates };
    delete updated[dKey];
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
      {/* Main Upload Card */}
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

          {/* Action Buttons */}
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

        {/* Hidden File Inputs */}
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

        {/* Dropzone */}
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
                ? `${detectedDateKeys.length} Attendance Dates Loaded`
                : 'Click to select daily attendance folder or drag & drop files here'}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Automatically identifies Contract Labour, Operators, and NAPS attendance sheets.
            </p>
          </div>
        </div>

        {/* Detected Dates Grid */}
        {detectedDateKeys.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Detected Attendance Dates ({detectedDateKeys.length})
                </span>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Click reconcile below to compute payroll
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {detectedDateKeys.map(dKey => {
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

                    {/* Category Tags */}
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

            {/* Reconcile Bottom Action Bar */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 font-medium flex items-center space-x-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Attendance records verified against Employee Rate Master.</span>
              </div>

              <button
                onClick={handleReconcileAll}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Generate Cost Summary</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default AttendanceUpload;
