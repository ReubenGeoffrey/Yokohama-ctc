import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Table2, AlertTriangle, ArrowRight, Users, DollarSign, Clock, Sparkles } from 'lucide-react';
import { formatDateDisplay } from '../services/parser';
import { generateSingleDayWorkbook, downloadBlob } from '../services/excelEngine';

// ── Pure-SVG Donut Chart (no extra library) ──────────────────
function DonutChart({ segments, size = 180, thickness = 36 }) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) return null;

  let offset = 0;
  const slices = segments.map((seg) => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const slice = { ...seg, dash, gap, offset, pct };
    offset += dash;
    return slice;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
      {slices.map((seg, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={thickness}
          strokeDasharray={`${seg.dash} ${seg.gap}`}
          strokeDashoffset={-seg.offset + circumference / 4}
          strokeLinecap="butt"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      ))}
      {/* Centre label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">Total</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="13" fontWeight="900" fill="#0f172a">
        {segments[0]?.total ?? '—'}
      </text>
    </svg>
  );
}

export function ReconciliationMatrix({ batchResults, master, onNext }) {
  const [downloadingIdx, setDownloadingIdx] = useState(null);

  if (!batchResults || !batchResults.length) {
    return (
      <div className="p-12 text-center maya-card text-slate-500 font-medium">
        No reconciliation data available. Please upload attendance files in Stage 2.
      </div>
    );
  }

  // ── Aggregates ──────────────────────────────────────────────
  const totDirHC  = batchResults.reduce((s, r) => s + r.dHC, 0);
  const totIndHC  = batchResults.reduce((s, r) => s + r.iHC, 0);
  const totHC     = batchResults.reduce((s, r) => s + r.gHC, 0);
  const totCTC    = batchResults.reduce((s, r) => s + r.gCTC, 0);
  const totOT     = batchResults.reduce((s, r) => s + r.gOT, 0);
  const totCost   = totCTC + totOT;
  const totDirCost = batchResults.reduce((s, r) => s + r.dTot, 0);
  const totIndCost = batchResults.reduce((s, r) => s + r.iTot, 0);

  const allUnmatched = batchResults.flatMap(r => r.unmatched || []);

  const handleDownloadDay = async (r, idx) => {
    setDownloadingIdx(idx);
    try {
      const year  = new Date(r.date).getUTCFullYear();
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
  const fmt  = (n) => (Math.round(n) || 0).toLocaleString('en-IN');
  const pct  = (a, b) => b ? ((a / b) * 100).toFixed(1) + '%' : '0%';

  // ── Pie chart data ──────────────────────────────────────────
  const hcSegments = [
    { label: 'Direct',   value: totDirHC, color: '#2563eb' },
    { label: 'Indirect', value: totIndHC, color: '#f59e0b' },
  ];
  hcSegments[0].total = fmtN(totHC);

  const costSegments = [
    { label: 'CTC',         value: totCTC,     color: '#6366f1' },
    { label: 'OT Wages',    value: totOT,       color: '#f59e0b' },
  ];
  costSegments[0].total = `₹${fmt(totCost)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Headcount',  value: fmtN(totHC),      sub: `${batchResults.length} dates`,      icon: <Users className="w-4 h-4"/>,      iconBg: 'bg-blue-50 text-blue-600' },
          { label: 'Daily CTC Wages',  value: `₹${fmt(totCTC)}`, sub: 'Standard working wages',            icon: <DollarSign className="w-4 h-4"/>, iconBg: 'bg-amber-50 text-amber-600' },
          { label: 'OT Wages',         value: `₹${fmt(totOT)}`,  sub: 'Overtime compensation',             icon: <Clock className="w-4 h-4"/>,      iconBg: 'bg-emerald-50 text-emerald-600' },
          { label: 'Plant Grand Total',value: `₹${fmt(totCost)}`,sub: 'CTC + OT combined',                 icon: <span className="font-black text-sm">₹</span>, iconBg: 'bg-slate-900 text-amber-400', highlight: true },
        ].map((kpi, i) => (
          <div
            key={i}
            className={`p-5 rounded-2xl flex flex-col gap-3 border ${
              kpi.highlight
                ? 'bg-amber-400 border-amber-400 shadow-lg shadow-amber-300/30'
                : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${kpi.highlight ? 'text-slate-900' : 'text-slate-500'}`}>
                {kpi.label}
              </span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${kpi.iconBg}`}>
                {kpi.icon}
              </div>
            </div>
            <div className={`text-2xl font-black tracking-tight ${kpi.highlight ? 'text-slate-950' : 'text-slate-900'}`}>
              {kpi.value}
            </div>
            <div className={`text-[11px] font-semibold ${kpi.highlight ? 'text-slate-800' : 'text-slate-400'}`}>
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Analytics Row: Pie Charts + Distribution ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Headcount Distribution Pie */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="mb-4">
            <h3 className="text-sm font-black text-slate-900">Headcount Distribution</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Direct vs Indirect workers across all dates</p>
          </div>
          <div className="flex items-center gap-6">
            <DonutChart segments={hcSegments} size={160} thickness={32} />
            <div className="flex flex-col gap-3 flex-1">
              {[
                { label: 'Direct',   value: fmtN(totDirHC), color: '#2563eb', cost: `₹${fmt(totDirCost)}` },
                { label: 'Indirect', value: fmtN(totIndHC), color: '#f59e0b', cost: `₹${fmt(totIndCost)}` },
              ].map((seg) => (
                <div key={seg.label} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">{seg.label}</span>
                      <span className="text-xs font-black text-slate-900">{seg.value} HC</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: pct(seg.label === 'Direct' ? totDirHC : totIndHC, totHC), backgroundColor: seg.color }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{seg.cost} wages</div>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 text-xs font-black text-slate-900 flex justify-between">
                <span>Total</span>
                <span>{fmtN(totHC)} workers</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Breakdown Pie */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="mb-4">
            <h3 className="text-sm font-black text-slate-900">Cost Breakdown</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">CTC vs Overtime wages — monthly total</p>
          </div>
          <div className="flex items-center gap-6">
            <DonutChart segments={costSegments} size={160} thickness={32} />
            <div className="flex flex-col gap-3 flex-1">
              {[
                { label: 'CTC Wages',  value: totCTC, color: '#6366f1', pctVal: pct(totCTC, totCost) },
                { label: 'OT Wages',   value: totOT,  color: '#f59e0b', pctVal: pct(totOT,  totCost) },
              ].map((seg) => (
                <div key={seg.label} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">{seg.label}</span>
                      <span className="text-xs font-black text-slate-900">₹{fmt(seg.value)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: seg.pctVal, backgroundColor: seg.color }} />
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{seg.pctVal} of grand total</div>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 text-xs font-black text-slate-900 flex justify-between">
                <span>Grand Total</span>
                <span>₹{fmt(totCost)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Reconciliation Table ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Stage 03 · Breakdown Matrix</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">Executive Cost Matrix</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
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
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50/30 transition' : 'bg-slate-50/60 hover:bg-amber-50/40 transition'}>
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
                <td className="py-4 px-3 text-right font-mono">{fmtN(totDirHC)}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(totDirCost)}</td>
                <td className="py-4 px-3 text-right font-mono">{fmtN(totIndHC)}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(totIndCost)}</td>
                <td className="py-4 px-3 text-right font-mono text-slate-900 text-sm font-black">{fmtN(totHC)}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(totCTC)}</td>
                <td className="py-4 px-3 text-right font-mono">{fmt(totOT)}</td>
                <td className="py-4 px-5 text-right font-mono text-slate-950 bg-amber-200 text-sm font-black">{fmt(totCost)}</td>
                <td className="py-4 px-5" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Unmatched Warning ───────────────────────────────── */}
      {allUnmatched.length > 0 && (
        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="flex items-center space-x-2 text-amber-950 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Unmatched Employees ({allUnmatched.length} records not in Master Roster)</span>
          </div>
          <p className="text-xs text-amber-900/80 mt-1">
            The following employee codes appeared in daily attendance reports but were not present in the Master Roster:
          </p>
          <div className="mt-4 max-h-40 overflow-y-auto space-y-2 pr-2">
            {allUnmatched.map((u, i) => (
              <div key={i} className="flex justify-between items-center text-xs bg-white p-3 rounded-xl border border-amber-200">
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
