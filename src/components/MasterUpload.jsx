import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle, Users, HardDrive, ArrowRight } from 'lucide-react';
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
        operatorCount: Object.keys(masterData.operator).length,
        contractCount: Object.keys(masterData.contract).length,
        napsCount: Object.keys(masterData.naps).length
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error parsing Master CTC workbook.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-400" />
              <span>Stage 1: CTC Master Roster Configuration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload <code className="text-amber-300 font-mono">CL CTC Input 2.xlsx</code> containing Contract, NAPS, and Operator CTC rate master sheets.
            </p>
          </div>
          {master && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Roster Active & Stored</span>
            </span>
          )}
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`mt-6 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-amber-400 bg-amber-400/5 scale-[0.99]'
              : master
              ? 'border-emerald-500/40 bg-emerald-950/10 hover:border-emerald-500'
              : 'border-slate-700 bg-slate-950/40 hover:border-amber-400 hover:bg-slate-800/50'
          }`}
        >
          <input
            type="file"
            ref={inputRef}
            onChange={(e) => handleFiles(e.target.files)}
            accept=".xlsx,.xls"
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition ${
              master ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20' : 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
            }`}>
              {loading ? (
                <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : master ? (
                <CheckCircle className="w-8 h-8" />
              ) : (
                <UploadCloud className="w-8 h-8" />
              )}
            </div>

            <div>
              <div className="text-sm font-bold text-slate-200">
                {masterMeta?.fileName || 'Drop "CL CTC Input 2.xlsx" or Click to Browse'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Supports .xlsx workbooks with Contract, NAPS, and OPERATOR sheets
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* Master Stats Breakdown */}
        {master && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Operators (ATC)</span>
                <Users className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold text-white mt-2">
                {Object.keys(master.operator || {}).length}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Production & Support</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Contract Labour (CL)</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-extrabold text-white mt-2">
                {Object.keys(master.contract || {}).length}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Direct & Indirect Contractors</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">NAPS Apprentices</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-white mt-2">
                {Object.keys(master.naps || {}).length}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">National Apprenticeship Scheme</div>
            </div>
          </div>
        )}

        {/* Next Step Action */}
        {master && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={onNext}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <span>Proceed to Attendance Upload</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
