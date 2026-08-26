import React, { useState } from 'react';
import { Table2, AlertTriangle, ArrowRight, Download, Users, DollarSign, Clock } from 'lucide-react';
import { formatDateDisplay } from '../services/parser';
import { generateSingleDayWorkbook, downloadBlob } from '../services/excelEngine';

export function ReconciliationMatrix({ batchResults, master, onNext }) {
  const [downloadingIdx, setDownloadingIdx] = useState(null);

  if (!batchResults || !batchResults.length) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
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
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Headcount</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">{fmtN(totHC)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Across all {batchResults.length} dates</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Daily CTC</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">{fmt(totCTC)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Standard Working Wages</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total OT Wages</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">{fmt(totOT)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Overtime Compensation</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/30">
          <div className="flex items-center justify-between text-amber-300 text-xs font-semibold">
            <span>Plant Grand Total</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400 mt-2">{fmt(totCost)}</div>
          <div className="text-[10px] text-amber-300/70 mt-1">Combined CTC + OT</div>
        </div>
      </div>

      {/* Main Reconciliation Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Table2 className="w-5 h-5 text-amber-400" />
              <span>Stage 3: Reconciliation Matrix (Direct vs Indirect Breakdown)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Live summary matrix with categorized headcount, CTC costs, and OT calculations.
            </p>
          </div>

          <button
            onClick={onNext}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <span>Proceed to Export</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-3 text-right">Direct HC</th>
                <th className="py-3.5 px-3 text-right">Direct Cost</th>
                <th className="py-3.5 px-3 text-right">Indirect HC</th>
                <th className="py-3.5 px-3 text-right">Indirect Cost</th>
                <th className="py-3.5 px-3 text-right font-bold text-white">Total HC</th>
                <th className="py-3.5 px-3 text-right">Daily CTC</th>
                <th className="py-3.5 px-3 text-right">OT Wages</th>
                <th className="py-3.5 px-4 text-right font-bold text-amber-400">Grand Total</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {batchResults.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-bold text-slate-200">{formatDateDisplay(r.date)}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">{fmtN(r.dHC)}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">{fmt(r.dTot)}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">{fmtN(r.iHC)}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">{fmt(r.iTot)}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-white bg-slate-950/30">{fmtN(r.gHC)}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">{fmt(r.gCTC)}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">{fmt(r.gOT)}</td>
                  <td className="py-3 px-4 text-right font-mono font-extrabold text-amber-400 bg-amber-400/5">{fmt(r.gTot)}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleDownloadDay(r, idx)}
                      disabled={downloadingIdx === idx}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold border border-slate-700 transition"
                    >
                      {downloadingIdx === idx ? 'Generating...' : '📥 Day Excel'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-950 font-bold border-t-2 border-slate-700 text-slate-200">
                <td className="py-4 px-4 uppercase tracking-wider text-amber-400">Total</td>
                <td className="py-4 px-3 text-right font-mono">{fmtN(batchResults.reduce((s, r) => s + r.dHC, 0))}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(batchResults.reduce((s, r) => s + r.dTot, 0))}</td>
                <td className="py-4 px-3 text-right font-mono">{fmtN(batchResults.reduce((s, r) => s + r.iHC, 0))}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(batchResults.reduce((s, r) => s + r.iTot, 0))}</td>
                <td className="py-4 px-3 text-right font-mono text-white text-sm">{fmtN(totHC)}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(totCTC)}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(totOT)}</td>
                <td className="py-4 px-4 text-right font-mono text-amber-400 text-sm">{fmt(totCost)}</td>
                <td className="py-4 px-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Unmatched / Missing Master Codes Section */}
      {allUnmatched.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30">
          <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Unmatched Employees ({allUnmatched.length} Records not in Master CTC Roster)</span>
          </div>
          <p className="text-xs text-amber-200/70 mt-1">
            The following employee codes appeared in attendance reports but were not found in the CTC Master roster:
          </p>
          <div className="mt-3 max-h-40 overflow-y-auto space-y-1.5 pr-2">
            {allUnmatched.map((u, i) => (
              <div key={i} className="flex justify-between items-center text-xs bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                <span className="font-mono font-bold text-amber-300">{u.code}</span>
                <span className="text-slate-300">{u.name || 'Unknown Name'}</span>
                <span className="text-slate-400">{u.category}</span>
                <span className="text-slate-500">{formatDateDisplay(u.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
