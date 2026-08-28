import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Table2, AlertTriangle, ArrowRight, Download, Users, DollarSign, Clock, Sparkles } from 'lucide-react';
import { formatDateDisplay } from '../services/parser';
import { generateSingleDayWorkbook, downloadBlob } from '../services/excelEngine';

export function ReconciliationMatrix({ batchResults, master, onNext }) {
  const [downloadingIdx, setDownloadingIdx] = useState(null);

  if (!batchResults || !batchResults.length) {
    return (
      <div className="p-12 text-center maya-card text-slate-500 font-medium">
        No reconciliation data available. Please upload attendance files in Stage 2.
      </div>
    );
  }

  // Calculate Aggregates
  const totHC = batchResults.reduce((s, r) => s + r.gHC, 0);
  const totCTC = batchResults.reduce((s, r) => s + r.gCTC, 0);
  const totOT = batchResults.reduce((s, r) => s + r.gOT, 0);
  const totCost = totCTC + totOT;

  // Aggregate all unmatched records
  const allUnmatched = batchResults.flatMap(r => r.unmatched || []);

  const handleDownloadDay = async (r, idx) => {
    setDownloadingIdx(idx);
    try {
      const year = new Date(r.date).getUTCFullYear();
      const month = new Date(r.date).getUTCMonth();
      const buffer = await generateSingleDayWorkbook(r, master, year, month);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `CTC_Output_${formatDateDisplay(r.date)}.xlsx`);
    } catch (e) {
      console.error('Download single day error:', e);
      alert('Error generating day workbook: ' + e.message);
    } finally {
      setDownloadingIdx(null);
    }
  };

  const fmtN = (n) => (n || 0).toLocaleString('en-IN');
  const fmt = (n) => (Math.round(n) || 0).toLocaleString('en-IN');

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Top Friendly KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <div className="maya-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total Headcount</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-3">{fmtN(totHC)}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">Across all {batchResults.length} dates</div>
        </div>

        <div className="maya-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total Daily CTC</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-3">₹{fmt(totCTC)}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">Standard Working Wages</div>
        </div>

        <div className="maya-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total OT Wages</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-3">₹{fmt(totOT)}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">Overtime Compensation</div>
        </div>

        <div className="maya-card-highlight p-6 flex flex-col justify-between bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20">
          <div className="flex items-center justify-between text-slate-900 text-xs font-black uppercase tracking-wider">
            <span>Plant Grand Total</span>
            <div className="w-8 h-8 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center font-bold">
              ₹
            </div>
          </div>
          <div className="text-3xl font-black text-slate-950 mt-3">₹{fmt(totCost)}</div>
          <div className="text-[11px] text-slate-800 font-bold mt-1">Combined CTC + OT Wages</div>
        </div>
      </div>

      {/* Main Reconciliation Table */}
      <div className="maya-card overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Stage 03 • Breakdown Matrix</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
              <span>Executive Cost Matrix</span>
              <span className="text-amber-500 font-handwriting text-3xl ml-1 font-bold">
                Clear & Exact ☀️
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Categorized direct vs indirect headcount, daily CTC costs, and OT calculations.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onNext}
            className="btn-yellow px-7 py-3 text-xs flex items-center space-x-2 cursor-pointer shadow-md self-start sm:self-auto"
          >
            <span>Proceed to Export</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider font-black border-b border-slate-200">
                <th className="py-4 px-5">Date</th>
                <th className="py-4 px-3 text-right">Direct HC</th>
                <th className="py-4 px-3 text-right">Direct Cost</th>
                <th className="py-4 px-3 text-right">Indirect HC</th>
                <th className="py-4 px-3 text-right">Indirect Cost</th>
                <th className="py-4 px-3 text-right font-black text-slate-900 bg-slate-100">Total HC</th>
                <th className="py-4 px-3 text-right">Daily CTC</th>
                <th className="py-4 px-3 text-right">OT Wages</th>
                <th className="py-4 px-5 text-right font-black text-slate-950 bg-amber-100">Grand Total</th>
                <th className="py-4 px-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {batchResults.map((r, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60 hover:bg-amber-50/40 transition'}>
                  <td className="py-3.5 px-5 font-black text-slate-900">{formatDateDisplay(r.date)}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-700">{fmtN(r.dHC)}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-700">{fmt(r.dTot)}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-700">{fmtN(r.iHC)}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-700">{fmt(r.iTot)}</td>
                  <td className="py-3.5 px-3 text-right font-mono font-black text-slate-900 bg-slate-100/70">{fmtN(r.gHC)}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-700">{fmt(r.gCTC)}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-700">{fmt(r.gOT)}</td>
                  <td className="py-3.5 px-5 text-right font-mono font-black text-slate-950 bg-amber-50">{fmt(r.gTot)}</td>
                  <td className="py-3.5 px-5 text-center">
                    <button
                      onClick={() => handleDownloadDay(r, idx)}
                      disabled={downloadingIdx === idx}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-amber-400 hover:text-slate-950 text-slate-800 rounded-full text-[11px] font-bold border border-slate-200 transition cursor-pointer"
                    >
                      {downloadingIdx === idx ? '...' : '📥 Day Excel'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-slate-900">
                <td className="py-4 px-5 uppercase tracking-wider text-slate-900 font-black">Total</td>
                <td className="py-4 px-3 text-right font-mono">{fmtN(batchResults.reduce((s, r) => s + r.dHC, 0))}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(batchResults.reduce((s, r) => s + r.dTot, 0))}</td>
                <td className="py-4 px-3 text-right font-mono">{fmtN(batchResults.reduce((s, r) => s + r.iHC, 0))}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(batchResults.reduce((s, r) => s + r.iTot, 0))}</td>
                <td className="py-4 px-3 text-right font-mono text-slate-900 text-sm font-black">{fmtN(totHC)}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(totCTC)}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(totOT)}</td>
                <td className="py-4 px-5 text-right font-mono text-slate-950 bg-amber-200 text-sm font-black">{fmt(totCost)}</td>
                <td className="py-4 px-5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Unmatched Employees Notice */}
      {allUnmatched.length > 0 && (
        <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200">
          <div className="flex items-center space-x-2 text-amber-950 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Unmatched Employees ({allUnmatched.length} Records not in Master Roster)</span>
          </div>
          <p className="text-xs text-amber-900/80 mt-1">
            The following employee codes appeared in daily attendance reports but were not present in the Master Roster:
          </p>
          <div className="mt-4 max-h-40 overflow-y-auto space-y-2 pr-2">
            {allUnmatched.map((u, i) => (
              <div key={i} className="flex justify-between items-center text-xs bg-white p-3 rounded-2xl border border-amber-200 shadow-2xs">
                <span className="font-mono font-bold text-amber-950">{u.code}</span>
                <span className="text-slate-700 font-medium">{u.name || 'Unknown Name'}</span>
                <span className="text-slate-500">{u.category}</span>
                <span className="text-slate-400">{formatDateDisplay(u.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
