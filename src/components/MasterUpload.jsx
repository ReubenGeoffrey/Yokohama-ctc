import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Users,
  ArrowRight,
  Sparkles,
  FileCheck,
  AlertCircle
} from 'lucide-react';
import { parseMasterWorkbook } from '../services/parser';
import { StorageService } from '../services/storage';

export function MasterUpload({ master, masterMeta, onMasterLoaded, onNext }) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Please upload an Excel workbook (.xlsx or .xls)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const masterData = parseMasterWorkbook(buffer);

      // Save to IndexedDB persistent storage
      await StorageService.saveMaster(masterData, file.name);

      onMasterLoaded(masterData, {
        fileName: file.name,
        savedAt: new Date().toISOString(),
        operatorCount: Object.keys(masterData.operator || {}).length,
        contractCount: Object.keys(masterData.contract || {}).length,
        napsCount: Object.keys(masterData.naps || {}).length
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error parsing Master CTC workbook.');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => (n || 0).toLocaleString('en-IN');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      {/* ── Main Upload Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[11px] font-black uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>Input 02 • Master Roster &amp; Rates</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Upload CTC Master Roster
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Upload your employee rate configuration workbook (<code className="text-blue-600 bg-blue-50/70 border border-blue-200 px-1.5 py-0.5 rounded font-mono font-bold">CL CTC Input 2.xlsx</code>).
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center space-x-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Browse Workbook</span>
            </button>

            {master && (
              <button
                onClick={onNext}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-3 ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50 scale-[1.005]'
              : master
              ? 'border-emerald-300 bg-emerald-50/20 hover:border-emerald-400'
              : 'border-slate-200 bg-slate-50/60 hover:border-blue-300 hover:bg-blue-50/20'
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-2xs ${
            master ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-blue-600'
          }`}>
            {loading ? (
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : master ? (
              <FileCheck className="w-6 h-6 text-emerald-600" />
            ) : (
              <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            )}
          </div>

          <div>
            <div className="text-sm font-black text-slate-800">
              {loading
                ? 'Parsing Master Roster workbook...'
                : master
                ? 'Master Roster Active & Loaded'
                : 'Click to select or drag & drop Master Workbook here'}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Supports .xlsx and .xls formats containing Operator, Contract Labour, and NAPS sheets.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Active Master Statistics Summary Cards */}
        {master && masterMeta && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Loaded Roster Statistics
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {masterMeta.fileName}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Company Operators
                  </span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {fmt(masterMeta.operatorCount)}
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Contract Labour (CL)
                  </span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {fmt(masterMeta.contractCount)}
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    NAPS Apprentices
                  </span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {fmt(masterMeta.napsCount)}
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default MasterUpload;
