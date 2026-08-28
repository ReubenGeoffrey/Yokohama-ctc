import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, FileSpreadsheet, CheckCircle, Users, ArrowRight, Sparkles } from 'lucide-react';
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
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Hero Banner Section */}
      <div className="maya-card p-8 sm:p-12 relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-black uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Stage 01 • Master Roster</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Mapping CTC Rates
          </h2>

          <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed font-medium">
            Upload your master rate workbook (<code className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md font-mono font-bold">CL CTC Input 2.xlsx</code>) containing Contract Labour, NAPS apprentices, and Company Operator standard wages.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              onClick={() => inputRef.current?.click()}
              className="btn-blue px-6 py-3 text-sm flex items-center space-x-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Browse Master Excel</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            {master && (
              <span className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold shadow-2xs">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Roster Active in Storage</span>
              </span>
            )}
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`mt-8 border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-amber-500 bg-amber-50/60 scale-[1.01]'
              : master
              ? 'border-emerald-300 bg-emerald-50/20 hover:border-emerald-400'
              : 'border-slate-300 bg-slate-50/60 hover:border-amber-400 hover:bg-amber-50/20'
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
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-md ${
              master ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'
            }`}>
              {loading ? (
                <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : master ? (
                <CheckCircle className="w-8 h-8" />
              ) : (
                <UploadCloud className="w-8 h-8" />
              )}
            </div>

            <div>
              <div className="text-base font-black text-slate-900">
                {masterMeta?.fileName || 'Drag & Drop "CL CTC Input 2.xlsx" Here'}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-medium">
                Supports Contract, NAPS, and OPERATOR sheets with single-rate and multi-component CTC
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            ⚠️ {error}
          </div>
        )}

        {/* Breakdown Feature Cards (Pricing/Package Style like the Reference Image!) */}
        {master && (
          <div className="mt-8">
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Roster Employee Distribution
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Card 1 */}
              <div className="maya-card p-6 relative flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                      ATC Operators
                    </span>
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-4">
                    {Object.keys(master.operator || {}).length}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Permanent & Company Technical Roles
                  </p>
                </div>
              </div>

              {/* Card 2 - Highlighted */}
              <div className="maya-card-highlight p-6 relative flex flex-col justify-between bg-amber-50/20">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-amber-900 bg-amber-300 px-2.5 py-1 rounded-full">
                      Contract Labour
                    </span>
                    <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-900 font-bold">
                      CL
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-4">
                    {Object.keys(master.contract || {}).length}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    Direct & Indirect Line Contractors
                  </p>
                </div>
              </div>

              {/* Card 3 */}
              <div className="maya-card p-6 relative flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                      NAPS Scheme
                    </span>
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-4">
                    {Object.keys(master.naps || {}).length}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    National Apprenticeship Scheme
                  </p>
                </div>
              </div>
            </div>

            {/* Next Step Action */}
            <div className="mt-8 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onNext}
                className="btn-yellow px-8 py-3.5 text-sm flex items-center space-x-2 cursor-pointer shadow-lg"
              >
                <span>Proceed to Attendance Upload</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
