import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Table2,
  AlertTriangle,
  ArrowRight,
  Users,
  DollarSign,
  Clock,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Building2,
  Calendar,
  Layers
} from 'lucide-react';
import { formatDateDisplay } from '../services/parser';
import { generateSingleDayWorkbook, generateMonthlyWorkbook, downloadBlob } from '../services/excelEngine';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ── Pure-SVG Donut Chart (Matching Enterprise Design) ───────────
function DonutChart({ segments, size = 150, thickness = 28 }) {
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
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b">Total</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="12" fontWeight="900" fill="#0f172a">
        {segments[0]?.total ?? '—'}
      </text>
    </svg>
  );
}

export function ReconciliationMatrix({ batchResults, master, onNext }) {
  const [downloadingIdx, setDownloadingIdx] = useState(null);
  const [downloadingMonth, setDownloadingMonth] = useState(false);

  // Group batchResults by available months (e.g. June, July, August, September)
  const availableMonths = useMemo(() => {
    if (!batchResults || !batchResults.length) return [];
    const map = {};
    batchResults.forEach(r => {
      if (!r.date) return;
      const d = new Date(r.date);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!map[key]) {
        map[key] = {
          year: y,
          month: m,
          label: `${MONTH_NAMES[m]} ${y}`,
          shortLabel: `${MONTH_NAMES[m].slice(0, 3)} ${y}`,
          key,
          count: 0
        };
      }
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [batchResults]);

  // Default to the latest month uploaded (e.g. September 2026 or June/July)
  const [selectedMonthKey, setSelectedMonthKey] = useState(
    availableMonths[availableMonths.length - 1]?.key || 'ALL'
  );

  useEffect(() => {
    if (availableMonths.length > 0 && selectedMonthKey !== 'ALL' && !availableMonths.some(m => m.key === selectedMonthKey)) {
      setSelectedMonthKey(availableMonths[availableMonths.length - 1].key);
    }
  }, [availableMonths, selectedMonthKey]);

  // Filter batchResults to selected month
  const displayResults = useMemo(() => {
    if (!batchResults || !batchResults.length) return [];
    if (selectedMonthKey === 'ALL') return batchResults;
    return batchResults.filter(r => {
      const d = new Date(r.date);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      return key === selectedMonthKey;
    });
  }, [batchResults, selectedMonthKey]);

  const currentMonthObj = useMemo(() => {
    return availableMonths.find(m => m.key === selectedMonthKey) || null;
  }, [availableMonths, selectedMonthKey]);

  if (!batchResults || !batchResults.length) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs text-slate-500 font-medium max-w-5xl mx-auto">
        No reconciliation data available. Please upload attendance files in Stage 2.
      </div>
    );
  }

  // ── Aggregates for Displayed Month ───────────────────────────
  const totDirHC   = displayResults.reduce((s, r) => s + (r.dHC || 0), 0);
  const totIndHC   = displayResults.reduce((s, r) => s + (r.iHC || 0), 0);
  const totHC      = displayResults.reduce((s, r) => s + (r.gHC || 0), 0);
  const totCTC     = displayResults.reduce((s, r) => s + (r.gCTC || 0), 0);
  const totOT      = displayResults.reduce((s, r) => s + (r.gOT || 0), 0);
  const totCost    = totCTC + totOT;
  const totDirCost = displayResults.reduce((s, r) => s + (r.dTot || 0), 0);
  const totIndCost = displayResults.reduce((s, r) => s + (r.iTot || 0), 0);

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

  const handleDownloadSelectedMonth = async () => {
    if (!displayResults.length) return;
    setDownloadingMonth(true);
    try {
      const targetM = currentMonthObj || {
        year: new Date(displayResults[0].date).getUTCFullYear(),
        month: new Date(displayResults[0].date).getUTCMonth(),
        label: 'Monthly'
      };
      const buffer = await generateMonthlyWorkbook(displayResults, master, null, targetM.year, targetM.month);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `CTC_Output_${MONTH_NAMES[targetM.month] || 'Month'}_${targetM.year}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('Error generating month workbook: ' + e.message);
    } finally {
      setDownloadingMonth(false);
    }
  };

  const fmtN = (n) => (n || 0).toLocaleString('en-IN');
  const fmt  = (n) => (Math.round(n) || 0).toLocaleString('en-IN');
  const pct  = (a, b) => b ? ((a / b) * 100).toFixed(1) + '%' : '0%';

  // ── Chart Segments ──────────────────────────────────────────
  const hcSegments = [
    { label: 'Direct',   value: totDirHC, color: '#0ea5e9' },
    { label: 'Indirect', value: totIndHC, color: '#059669' },
  ];
  hcSegments[0].total = fmtN(totHC);

  const costSegments = [
    { label: 'CTC',      value: totCTC,  color: '#6366f1' },
    { label: 'OT Wages', value: totOT,   color: '#f59e0b' },
  ];
  costSegments[0].total = fmt(totCost);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Daily Attendance &amp; Cost Summary
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Daily worker man-days, standard working wages, and overtime compensation.
          </p>
        </div>

        <button
          onClick={onNext}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center space-x-2 cursor-pointer self-start sm:self-auto"
        >
          <span>Proceed to Report Center</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Month Selection Filter Bar ── */}
      {availableMonths.length > 0 && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              Filter by Month:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {availableMonths.map((m) => {
              const isSelected = selectedMonthKey === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setSelectedMonthKey(m.key)}
                  style={
                    isSelected
                      ? { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#0f172a' }
                      : { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }
                  }
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center space-x-2 cursor-pointer shadow-xs border ${
                    isSelected ? 'ring-2 ring-slate-900/30' : 'hover:bg-slate-100'
                  }`}
                >
                  <span style={{ color: isSelected ? '#ffffff' : '#0f172a' }}>{m.label}</span>
                  <span
                    style={
                      isSelected
                        ? { backgroundColor: 'rgba(255, 255, 255, 0.25)', color: '#ffffff' }
                        : { backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' }
                    }
                    className="px-1.5 py-0.2 rounded-full text-[10px] font-black border"
                  >
                    {m.count}
                  </span>
                </button>
              );
            })}

            {availableMonths.length > 1 && (
              <button
                onClick={() => setSelectedMonthKey('ALL')}
                style={
                  selectedMonthKey === 'ALL'
                    ? { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#0f172a' }
                    : { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }
                }
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center space-x-2 cursor-pointer shadow-xs border ${
                  selectedMonthKey === 'ALL' ? 'ring-2 ring-slate-900/30' : 'hover:bg-slate-100'
                }`}
              >
                <span style={{ color: selectedMonthKey === 'ALL' ? '#ffffff' : '#0f172a' }}>All Months</span>
                <span
                  style={
                    selectedMonthKey === 'ALL'
                      ? { backgroundColor: 'rgba(255, 255, 255, 0.25)', color: '#ffffff' }
                      : { backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' }
                  }
                  className="px-1.5 py-0.2 rounded-full text-[10px] font-black border"
                >
                  {batchResults.length}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── KPI Cards (Matching Dashboard Style) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Man-days',  value: fmtN(totHC),      sub: `${displayResults.length} dates` },
          { label: 'Daily CTC Wages',  value: fmt(totCTC),      sub: 'Standard working wages' },
          { label: 'OT Compensation',  value: fmt(totOT),       sub: 'Overtime wages' },
          { label: 'Plant Total Cost', value: fmt(totCost),     sub: 'CTC + OT combined', highlight: true },
        ].map((kpi, i) => (
          <div
            key={i}
            className={`p-4 rounded-2xl bg-white border shadow-xs flex flex-col justify-between ${
              kpi.highlight ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {kpi.label}
              </span>
            </div>
            <div className="text-xl font-black text-slate-900 mt-2">
              {kpi.value}
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Analytics Row: Donut Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Headcount Distribution */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">Man-days Distribution</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Direct vs Indirect workers across all dates</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <DonutChart segments={hcSegments} size={140} thickness={26} />
            <div className="flex-1 w-full space-y-3">
              {[
                { label: 'Direct Labour',   value: fmtN(totDirHC), color: '#0ea5e9', cost: `${fmt(totDirCost)}` },
                { label: 'Indirect Labour', value: fmtN(totIndHC), color: '#059669', cost: `${fmt(totIndCost)}` },
              ].map((seg) => (
                <div key={seg.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span>{seg.label}</span>
                    </span>
                    <strong className="text-slate-900">{seg.value} Man-days</strong>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: pct(seg.label.startsWith('Direct') ? totDirHC : totIndHC, totHC), backgroundColor: seg.color }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{seg.cost} total</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">Cost Breakdown</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">CTC vs Overtime compensation</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <DonutChart segments={costSegments} size={140} thickness={26} />
            <div className="flex-1 w-full space-y-3">
              {[
                { label: 'Standard CTC', value: totCTC, color: '#6366f1', pctVal: pct(totCTC, totCost) },
                { label: 'Overtime Wages', value: totOT, color: '#f59e0b', pctVal: pct(totOT, totCost) },
              ].map((seg) => (
                <div key={seg.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span>{seg.label}</span>
                    </span>
                    <strong className="text-slate-900">{fmt(seg.value)}</strong>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: seg.pctVal, backgroundColor: seg.color }} />
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{seg.pctVal} of grand total</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Reconciliation Table (Matching Dashboard Table Design) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              {currentMonthObj ? `${currentMonthObj.label} Matrix Records` : 'Reconciled Daily Matrix Records'} ({displayResults.length} Dates)
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              Single day Excel workbooks ready for {currentMonthObj ? currentMonthObj.label : 'all dates'}
            </span>
          </div>

          <button
            onClick={handleDownloadSelectedMonth}
            disabled={downloadingMonth || !displayResults.length}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            title="Download full month Excel summary workbook"
          >
            {downloadingMonth ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5" />
            )}
            <span>Download {currentMonthObj ? currentMonthObj.shortLabel : 'Month'} Master</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-black border-b border-slate-200/80">
                <th className="py-3.5 px-5">Date</th>
                <th className="py-3.5 px-4 text-right">Direct Man-days</th>
                <th className="py-3.5 px-4 text-right">Direct Cost</th>
                <th className="py-3.5 px-4 text-right">Indirect Man-days</th>
                <th className="py-3.5 px-4 text-right">Indirect Cost</th>
                <th className="py-3.5 px-4 text-right font-black text-slate-900 bg-slate-100/70">Total Man-days</th>
                <th className="py-3.5 px-4 text-right font-black text-slate-900 bg-slate-100/70">Total Cost</th>
                <th className="py-3.5 px-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayResults.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition font-medium">
                  <td className="py-3.5 px-5 font-black text-slate-900">
                    {formatDateDisplay(r.date)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-700">
                    {fmtN(r.dHC)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    {fmt(r.dTot)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-700">
                    {fmtN(r.iHC)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    {fmt(r.iTot)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-slate-950 bg-slate-50/50">
                    {fmtN(r.gHC)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 bg-slate-50/50">
                    {fmt(r.gTot)}
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    <button
                      onClick={() => handleDownloadDay(r, idx)}
                      disabled={downloadingIdx === idx}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200 transition cursor-pointer inline-flex items-center space-x-1 shadow-2xs"
                      title="Download single day Excel"
                    >
                      {downloadingIdx === idx ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                      ) : (
                        <FileSpreadsheet className="w-3 h-3 text-blue-600" />
                      )}
                      <span>Excel</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-slate-900">
                <td className="py-4 px-5 uppercase tracking-wider">
                  Grand Total
                </td>
                <td className="py-4 px-4 text-right">{fmtN(totDirHC)}</td>
                <td className="py-4 px-4 text-right font-mono">{fmt(totDirCost)}</td>
                <td className="py-4 px-4 text-right">{fmtN(totIndHC)}</td>
                <td className="py-4 px-4 text-right font-mono">{fmt(totIndCost)}</td>
                <td className="py-4 px-4 text-right bg-slate-100 font-black text-slate-950">{fmtN(totHC)}</td>
                <td className="py-4 px-4 text-right bg-slate-100 font-mono font-black text-emerald-700">{fmt(totCost)}</td>
                <td className="py-4 px-5 text-center text-slate-400 font-normal text-[11px]">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

export default ReconciliationMatrix;
