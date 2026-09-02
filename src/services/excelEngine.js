import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { formatDateDisplay, formatDateToInput } from './parser.js';
import { aggregateMonthlyStats } from './reconciliation.js';

const FONT_NAME = 'Segoe UI';
const cYellowMain = 'FFFFE699';   // Soft warm professional yellow
const cYellowSub = 'FFFFF2CC';    // Pale pastel yellow
const cYellowAccent = 'FFFDE68A'; // Warm gold
const cYellowLight = 'FFFFFBEB';  // Tinted yellow
const cYellowPale = 'FFFFEFCE8';  // Pale cream
const cYellowTotal = 'FFFFACC15'; // Deep amber gold
const cTextDark = 'FF1F2937';     // Dark charcoal slate
const cTextSub = 'FF374151';      // Medium slate
const cBorder = 'FFD1D5DB';       // Subtle minimalist border

const thinBorder = {
  top: { style: 'thin', color: { argb: cBorder } },
  left: { style: 'thin', color: { argb: cBorder } },
  bottom: { style: 'thin', color: { argb: cBorder } },
  right: { style: 'thin', color: { argb: cBorder } }
};

// Build Summary Sheet
export function styleSummarySheet(wsSummary, year, month) {
  wsSummary.views = [{ state: 'frozen', xSplit: 1, ySplit: 3, showGridLines: true }];

  // Row 1: Main Categories
  wsSummary.getRow(1).height = 25;
  try { wsSummary.mergeCells('B1:Q1'); } catch (e) {}
  const cDir = wsSummary.getCell('B1');
  cDir.value = 'DIRECT LABOUR / PRODUCTION';
  cDir.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cYellowMain } };
  cDir.font = { name: FONT_NAME, size: 10.5, bold: true, color: { argb: cTextDark } };
  cDir.alignment = { horizontal: 'center', vertical: 'middle' };

  try { wsSummary.mergeCells('R1:AG1'); } catch (e) {}
  const cInd = wsSummary.getCell('R1');
  cInd.value = 'INDIRECT LABOUR / SUPPORT';
  cInd.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cYellowSub } };
  cInd.font = { name: FONT_NAME, size: 10.5, bold: true, color: { argb: cTextDark } };
  cInd.alignment = { horizontal: 'center', vertical: 'middle' };

  try { wsSummary.mergeCells('AH1:AK1'); } catch (e) {}
  const cGt = wsSummary.getCell('AH1');
  cGt.value = 'GRAND TOTAL (PLANT WIDE)';
  cGt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cYellowAccent } };
  cGt.font = { name: FONT_NAME, size: 10.5, bold: true, color: { argb: cTextDark } };
  cGt.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 2: Sub-categories
  wsSummary.getRow(2).height = 22;
  const subCats = [
    { start: 2, end: 5, label: 'Operator', bg: 'FFFFFBEB', fg: 'FF78350F' },
    { start: 6, end: 9, label: 'Contract Labour', bg: 'FFFFFBEB', fg: 'FF78350F' },
    { start: 10, end: 13, label: 'NAPS', bg: 'FFFFFBEB', fg: 'FF78350F' },
    { start: 14, end: 17, label: 'Total Direct', bg: 'FFFDE047', fg: cTextDark },
    { start: 18, end: 21, label: 'Operator', bg: 'FFFEFCE8', fg: cTextDark },
    { start: 22, end: 25, label: 'Contract Labour', bg: 'FFFEFCE8', fg: cTextDark },
    { start: 26, end: 29, label: 'NAPS', bg: 'FFFEFCE8', fg: cTextDark },
    { start: 30, end: 33, label: 'Total Indirect', bg: 'FFFDE047', fg: cTextDark },
    { start: 34, end: 37, label: 'Plant Grand Total', bg: 'FFFACC15', fg: cTextDark }
  ];

  subCats.forEach(sc => {
    try { wsSummary.mergeCells(2, sc.start, 2, sc.end); } catch (e) {}
    const c = wsSummary.getCell(2, sc.start);
    c.value = sc.label;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } };
    c.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: sc.fg } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Row 3: Metric Headers (All with visible yellow background, including C3)
  wsSummary.getRow(3).height = 22;
  const cellA3 = wsSummary.getCell(3, 1);
  cellA3.value = 'Date';
  cellA3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cYellowMain } };
  cellA3.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: cTextDark } };
  cellA3.alignment = { horizontal: 'center', vertical: 'middle' };
  cellA3.border = thinBorder;

  for (let c = 2; c <= 37; c++) {
    const mod = (c - 2) % 4;
    let label = 'Head Count';
    if (mod === 1) label = 'CTC';
    else if (mod === 2) label = 'OT Wages';
    else if (mod === 3) label = 'Total';

    const cell = wsSummary.getCell(3, c);
    cell.value = label;
    const isTotCol = mod === 3 || c >= 34;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isTotCol ? cYellowAccent : cYellowMain } };
    cell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: cTextDark } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  }

  // Column Widths
  wsSummary.getColumn(1).width = 14;
  for (let c = 2; c <= 37; c++) {
    const mod = (c - 2) % 4;
    wsSummary.getColumn(c).width = (mod === 0) ? 11 : 14;
  }

  // Days styling (1 to 31) - Clean number format without rupee symbol
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const r = 3 + d;
    wsSummary.getRow(r).height = 20;
    const cellDate = wsSummary.getCell(r, 1);
    cellDate.value = new Date(Date.UTC(year, month, d));
    cellDate.numFmt = 'dd-mmm-yyyy';
    cellDate.font = { name: FONT_NAME, size: 10, color: { argb: cTextSub } };
    cellDate.alignment = { horizontal: 'center', vertical: 'middle' };
    cellDate.border = thinBorder;

    const rowBg = d % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
    for (let c = 2; c <= 37; c++) {
      const cell = wsSummary.getCell(r, c);
      cell.border = thinBorder;
      cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.numFmt = '#,##0';
    }
  }
}

function getStatFromCat(catMap, code) {
  if (!catMap) return null;
  if (typeof catMap.get === 'function') return catMap.get(code);
  return catMap[code] || null;
}

// Build Detail Sheet (Columns A to J, NO Gap, NO Merging, Total OT Amount next to Total OT Hrs)
export function buildDetailSheet(wb, title, employeeMap, statMap) {
  const ws = wb.addWorksheet(title);
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cYellowMain } };
  const headerFont = { name: FONT_NAME, size: 10, bold: true, color: { argb: cTextDark } };

  const headers = {
    1: 'S.No',
    2: 'Emp Code',
    3: 'Name',
    4: 'Department',
    5: 'Total Work Hrs',
    6: 'No of days present',
    7: 'Total WOP Count',
    8: 'Total OT Hrs',
    9: 'Total OT Amount',
    10: 'Wages'
  };

  Object.entries(headers).forEach(([c, label]) => {
    const cell = ws.getCell(1, Number(c));
    cell.value = label;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  let r = 2, sno = 1;
  Object.keys(employeeMap).forEach(code => {
    const info = employeeMap[code];
    const st = getStatFromCat(statMap, code) || { daysPresent: 0, wopCount: 0, workHrs: 0, otHrs: 0, otAmount: 0, wages: 0 };
    const otAmt = st.otAmount !== undefined ? st.otAmount : Math.round((st.otHrs || 0) * (info.dailyOT || 0) * 100) / 100;

    ws.getCell(r, 1).value = sno;
    ws.getCell(r, 2).value = code;
    ws.getCell(r, 3).value = info.name;
    ws.getCell(r, 4).value = info.dept;
    ws.getCell(r, 5).value = Math.round(st.workHrs * 100) / 100;
    ws.getCell(r, 6).value = st.daysPresent;
    ws.getCell(r, 7).value = st.wopCount;
    ws.getCell(r, 8).value = Math.round(st.otHrs * 100) / 100;
    ws.getCell(r, 9).value = Math.round(otAmt * 100) / 100;
    ws.getCell(r, 10).value = Math.round(st.wages * 100) / 100;

    const banded = sno % 2 === 0;
    ws.getRow(r).height = 20;
    for (let c = 1; c <= 10; c++) {
      const cell = ws.getCell(r, c);
      cell.border = thinBorder;
      cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
      cell.alignment = (c === 3)
        ? { horizontal: 'left', vertical: 'middle' }
        : ((c === 5 || c === 8 || c === 9 || c === 10) ? { horizontal: 'right', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' });
      if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
      if (c === 5 || c === 8) cell.numFmt = '#,##0.00';
      else if (c === 6 || c === 7 || c === 9 || c === 10) cell.numFmt = '#,##0';
    }
    r += 1;
    sno += 1;
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }];
  const widths = { 1: 7, 2: 14, 3: 28, 4: 20, 5: 16, 6: 18, 7: 18, 8: 14, 9: 16, 10: 14 };
  Object.entries(widths).forEach(([c, w]) => { ws.getColumn(Number(c)).width = w; });
  ws.getRow(1).height = 24;
  return ws;
}

// Known eligible Project employees specified by executive plant requirements
export const KNOWN_PROJECT_EMPLOYEES = [
  { code: 'SK1449', name: 'BALAIAH K', dept: 'Project' },
  { code: 'SK2918', name: 'VARGHEESE A', dept: 'EEI Project' },
  { code: '900246', name: 'ANNAMALAI RAJ M', dept: 'EEI Project' },
  { code: '901165', name: 'SHANMUGA SUNDARAM R', dept: 'EEI Project' },
  { code: '901164', name: 'PANDI A', dept: 'Project' },
  { code: '900257', name: 'KALLAND RAMAR N', dept: 'Project' },
  { code: '900266', name: 'RAJAN N', dept: 'Project' },
  { code: '901163', name: 'SURESH G', dept: 'Project' },
  { code: '900237', name: 'THUKKI V', dept: 'EEI Project' }
];

export function getProjectEmployees(master) {
  const projectMap = {};

  // 1. Seed with known project roster
  KNOWN_PROJECT_EMPLOYEES.forEach(emp => {
    projectMap[emp.code] = {
      name: emp.name,
      dept: emp.dept, // strictly 'Project' or 'EEI Project'
      direct: false,
      dailyCTC: 0,
      dailyOT: 0
    };
  });

  // 2. Scan master (contract, operator, naps) to pull rates, updated names or any additional PROJECT staff
  ['contract', 'operator', 'naps'].forEach(cat => {
    if (!master || !master[cat]) return;
    Object.entries(master[cat]).forEach(([code, info]) => {
      const codeUpper = String(code).trim().toUpperCase();
      const isKnown = !!projectMap[codeUpper];
      const deptUpper = String(info.dept || '').toUpperCase();
      const isProjectDept = deptUpper.includes('PROJECT');

      if (isKnown || isProjectDept) {
        // Enforce exact department naming: 'EEI Project' or 'Project'
        let cleanDept = projectMap[codeUpper]?.dept;
        if (!cleanDept) {
          cleanDept = deptUpper.includes('EEI') ? 'EEI Project' : 'Project';
        }

        projectMap[codeUpper] = {
          name: info.name || (projectMap[codeUpper] ? projectMap[codeUpper].name : 'Project Staff'),
          dept: cleanDept, // Strictly 'Project' or 'EEI Project'
          direct: info.direct || false,
          dailyCTC: info.dailyCTC || 0,
          dailyOT: info.dailyOT || 0
        };
      }
    });
  });

  return projectMap;
}

export function getProjectStats(projectEmployees, empStats) {
  const projectStats = new Map();
  Object.keys(projectEmployees).forEach(code => {
    const st = getStatFromCat(empStats?.CL, code) ||
               getStatFromCat(empStats?.OP, code) ||
               getStatFromCat(empStats?.NAPS, code) || {
                 workHrs: 0,
                 daysPresent: 0,
                 wopCount: 0,
                 otHrs: 0,
                 otAmount: 0,
                 wages: 0
               };
    projectStats.set(code, st);
  });
  return projectStats;
}

// Generate Combined Monthly Master Workbook
export async function generateMonthlyWorkbook(batchResults, master, empStats, year, month) {
  const wb = new ExcelJS.Workbook();
  const wsSummary = wb.addWorksheet('Summary');
  styleSummarySheet(wsSummary, year, month);

  // Strictly filter to the requested month and year so months never mix
  const monthResults = (batchResults || []).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    if (year !== undefined && month !== undefined) {
      return d.getUTCFullYear() === year && d.getUTCMonth() === month;
    }
    return true;
  });

  // Fill Summary data
  monthResults.forEach(r => {
    const dayNum = new Date(r.date).getUTCDate();
    const targetRow = 3 + dayNum;
    const b = r.buckets;

    const dTotOp = b.directOperator.ctc + b.directOperator.ot;
    const dTotCL = b.directCL.ctc + b.directCL.ot;
    const dTotNaps = b.directNAPS.ctc + b.directNAPS.ot;

    const iTotOp = b.indirectOperator.ctc + b.indirectOperator.ot;
    const iTotCL = b.indirectCL.ctc + b.indirectCL.ot;
    const iTotNaps = b.indirectNAPS.ctc + b.indirectNAPS.ot;

    const writes = {
      2: b.directOperator.headcount, 3: b.directOperator.ctc, 4: b.directOperator.ot, 5: dTotOp,
      6: b.directCL.headcount, 7: b.directCL.ctc, 8: b.directCL.ot, 9: dTotCL,
      10: b.directNAPS.headcount, 11: b.directNAPS.ctc, 12: b.directNAPS.ot, 13: dTotNaps,
      14: r.dHC, 15: r.dCTC, 16: r.dOT, 17: r.dTot,
      18: b.indirectOperator.headcount, 19: b.indirectOperator.ctc, 20: b.indirectOperator.ot, 21: iTotOp,
      22: b.indirectCL.headcount, 23: b.indirectCL.ctc, 24: b.indirectCL.ot, 25: iTotCL,
      26: b.indirectNAPS.headcount, 27: b.indirectNAPS.ctc, 28: b.indirectNAPS.ot, 29: iTotNaps,
      30: r.iHC, 31: r.iCTC, 32: r.iOT, 33: r.iTot,
      34: r.gHC, 35: r.gCTC, 36: r.gOT, 37: r.gTot
    };

    Object.entries(writes).forEach(([col, val]) => {
      wsSummary.getCell(targetRow, Number(col)).value = val;
    });
  });

  // Compute monthly stats strictly for this month's results so employee totals are clean
  const effectiveEmpStats = monthResults.length > 0 && master ? aggregateMonthlyStats(monthResults, master) : (empStats || { OP: new Map(), CL: new Map(), NAPS: new Map() });

  // Build Detail Sheets: ATC, CL, NAPS, and Project (Right of NAPS)
  buildDetailSheet(wb, 'ATC', master.operator || {}, effectiveEmpStats.OP);
  buildDetailSheet(wb, 'CL', master.contract || {}, effectiveEmpStats.CL);
  buildDetailSheet(wb, 'NAPS', master.naps || {}, effectiveEmpStats.NAPS);

  const projectEmployees = getProjectEmployees(master);
  const projectStats = getProjectStats(projectEmployees, effectiveEmpStats);
  buildDetailSheet(wb, 'Project', projectEmployees, projectStats);

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

// Generate Single Day Workbook
export async function generateSingleDayWorkbook(dayResult, master, year, month) {
  const wb = new ExcelJS.Workbook();
  const wsSummary = wb.addWorksheet('Summary');
  styleSummarySheet(wsSummary, year, month);

  const dayNum = new Date(dayResult.date).getUTCDate();
  const targetRow = 3 + dayNum;
  const b = dayResult.buckets;

  const dTotOp = b.directOperator.ctc + b.directOperator.ot;
  const dTotCL = b.directCL.ctc + b.directCL.ot;
  const dTotNaps = b.directNAPS.ctc + b.directNAPS.ot;

  const iTotOp = b.indirectOperator.ctc + b.indirectOperator.ot;
  const iTotCL = b.indirectCL.ctc + b.indirectCL.ot;
  const iTotNaps = b.indirectNAPS.ctc + b.indirectNAPS.ot;

  const writes = {
    2: b.directOperator.headcount, 3: b.directOperator.ctc, 4: b.directOperator.ot, 5: dTotOp,
    6: b.directCL.headcount, 7: b.directCL.ctc, 8: b.directCL.ot, 9: dTotCL,
    10: b.directNAPS.headcount, 11: b.directNAPS.ctc, 12: b.directNAPS.ot, 13: dTotNaps,
    14: dayResult.dHC, 15: dayResult.dCTC, 16: dayResult.dOT, 17: dayResult.dTot,
    18: b.indirectOperator.headcount, 19: b.indirectOperator.ctc, 20: b.indirectOperator.ot, 21: iTotOp,
    22: b.indirectCL.headcount, 23: b.indirectCL.ctc, 24: b.indirectCL.ot, 25: iTotCL,
    26: b.indirectNAPS.headcount, 27: b.indirectNAPS.ctc, 28: b.indirectNAPS.ot, 29: iTotNaps,
    30: dayResult.iHC, 31: dayResult.iCTC, 32: dayResult.iOT, 33: dayResult.iTot,
    34: dayResult.gHC, 35: dayResult.gCTC, 36: dayResult.gOT, 37: dayResult.gTot
  };

  Object.entries(writes).forEach(([col, val]) => {
    wsSummary.getCell(targetRow, Number(col)).value = val;
  });

  const singleDayStats = aggregateMonthlyStats([dayResult], master);

  buildDetailSheet(wb, 'ATC', master.operator || {}, singleDayStats.OP);
  buildDetailSheet(wb, 'CL', master.contract || {}, singleDayStats.CL);
  buildDetailSheet(wb, 'NAPS', master.naps || {}, singleDayStats.NAPS);

  const projectEmployees = getProjectEmployees(master);
  const projectDayStats = getProjectStats(projectEmployees, singleDayStats);
  buildDetailSheet(wb, 'Project', projectEmployees, projectDayStats);

  return await wb.xlsx.writeBuffer();
}

// Generate ZIP Archive of all single days + monthly master
export async function generateZipBundle(batchResults, master, empStats, year, month) {
  const zip = new JSZip();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mName = monthNames[month] || 'Monthly';

  const monthResults = (batchResults || []).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    if (year !== undefined && month !== undefined) {
      return d.getUTCFullYear() === year && d.getUTCMonth() === month;
    }
    return true;
  });

  // 1. Monthly Master
  const monthlyBuf = await generateMonthlyWorkbook(monthResults, master, empStats, year, month);
  zip.file(`CTC_Output_${mName}_${year}.xlsx`, monthlyBuf);

  // 2. Individual Dates
  for (const r of monthResults) {
    const dayBuf = await generateSingleDayWorkbook(r, master, year, month);
    const dateStr = formatDateToInput(r.date);
    zip.file(`CTC_Output_${dateStr}.xlsx`, dayBuf);
  }

  return await zip.generateAsync({ type: 'blob' });
}

// ── Generate Dedicated WOP Statistics Workbook ──
export async function generateWopReportWorkbook(wopMetrics, master, batchResults) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Yokohama CTC Operations';
  wb.created = new Date();

  // 1. Executive Summary Sheet
  const wsSummary = wb.addWorksheet('WOP Summary');
  wsSummary.views = [{ showGridLines: true }];

  wsSummary.mergeCells('A1:F1');
  const titleCell = wsSummary.getCell('A1');
  titleCell.value = 'YOKOHAMA CTC — WEEKLY OFF PRESENT (WOP) AUDIT REPORT';
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(1).height = 30;

  // KPI Row
  wsSummary.getCell('A3').value = 'Total WOP Shifts';
  wsSummary.getCell('B3').value = wopMetrics.totalCount;
  wsSummary.getCell('C3').value = 'Total Personnel';
  wsSummary.getCell('D3').value = wopMetrics.totalEmployees;
  wsSummary.getCell('E3').value = 'Total WOP Wages';
  wsSummary.getCell('F3').value = wopMetrics.totalWages;
  ['A3', 'C3', 'E3'].forEach(pos => {
    const c = wsSummary.getCell(pos);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    c.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
    c.border = thinBorder;
  });
  ['B3', 'D3', 'F3'].forEach(pos => {
    const c = wsSummary.getCell(pos);
    c.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF0F172A' } };
    c.border = thinBorder;
    c.numFmt = '#,##0';
  });
  wsSummary.getRow(3).height = 22;

  // Breakdown Table
  const headers = ['Category', 'WOP Shifts', 'Personnel Deployed', 'Share %', 'Wage Outflow', 'Avg Frequency'];
  headers.forEach((h, i) => {
    const c = wsSummary.getCell(5, i + 1);
    c.value = h;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cYellowMain } };
    c.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: cTextDark } };
    c.border = thinBorder;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsSummary.getRow(5).height = 22;

  const rows = [
    {
      cat: 'Plant Operators',
      count: wopMetrics.op.count,
      emp: wopMetrics.op.employees,
      share: wopMetrics.totalCount ? (wopMetrics.op.count / wopMetrics.totalCount) * 100 : 0,
      wages: wopMetrics.op.wages,
      avg: wopMetrics.op.employees ? (wopMetrics.op.count / wopMetrics.op.employees) : 0
    },
    {
      cat: 'Contract Labour (CL)',
      count: wopMetrics.cl.count,
      emp: wopMetrics.cl.employees,
      share: wopMetrics.totalCount ? (wopMetrics.cl.count / wopMetrics.totalCount) * 100 : 0,
      wages: wopMetrics.cl.wages,
      avg: wopMetrics.cl.employees ? (wopMetrics.cl.count / wopMetrics.cl.employees) : 0
    },
    {
      cat: 'NAPS Apprentices',
      count: wopMetrics.naps.count,
      emp: wopMetrics.naps.employees,
      share: wopMetrics.totalCount ? (wopMetrics.naps.count / wopMetrics.totalCount) * 100 : 0,
      wages: wopMetrics.naps.wages,
      avg: wopMetrics.naps.employees ? (wopMetrics.naps.count / wopMetrics.naps.employees) : 0
    }
  ];

  rows.forEach((rData, idx) => {
    const rowIdx = 6 + idx;
    wsSummary.getCell(rowIdx, 1).value = rData.cat;
    wsSummary.getCell(rowIdx, 2).value = rData.count;
    wsSummary.getCell(rowIdx, 3).value = rData.emp;
    wsSummary.getCell(rowIdx, 4).value = `${rData.share.toFixed(1)}%`;
    wsSummary.getCell(rowIdx, 5).value = rData.wages;
    wsSummary.getCell(rowIdx, 6).value = `${rData.avg.toFixed(1)} days/wkr`;

    for (let c = 1; c <= 6; c++) {
      const cell = wsSummary.getCell(rowIdx, c);
      cell.border = thinBorder;
      cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
      if (c === 2 || c === 3 || c === 5) cell.numFmt = '#,##0';
      cell.alignment = c === 1 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
    }
    wsSummary.getRow(rowIdx).height = 20;
  });

  // Total Summary row
  const totRow = 9;
  wsSummary.getCell(totRow, 1).value = 'Total';
  wsSummary.getCell(totRow, 2).value = wopMetrics.totalCount;
  wsSummary.getCell(totRow, 3).value = wopMetrics.totalEmployees;
  wsSummary.getCell(totRow, 4).value = '100.0%';
  wsSummary.getCell(totRow, 5).value = wopMetrics.totalWages;
  wsSummary.getCell(totRow, 6).value = wopMetrics.totalEmployees ? `${(wopMetrics.totalCount / wopMetrics.totalEmployees).toFixed(1)} days/wkr` : '0';
  for (let c = 1; c <= 6; c++) {
    const cell = wsSummary.getCell(totRow, c);
    cell.border = thinBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } };
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: cTextDark } };
    if (c === 2 || c === 3 || c === 5) cell.numFmt = '#,##0';
    cell.alignment = c === 1 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
  }
  wsSummary.getRow(totRow).height = 22;

  const wSummaryCol = { 1: 24, 2: 15, 3: 20, 4: 14, 5: 18, 6: 18 };
  Object.entries(wSummaryCol).forEach(([c, w]) => { wsSummary.getColumn(Number(c)).width = w; });

  // Detail sheets builder
  function buildWopDetail(sheetName, list) {
    const ws = wb.addWorksheet(sheetName);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }];
    const cols = ['S.No', 'Emp Code', 'Employee Name', 'Department / Contractor', 'Days Present', 'WOP Shifts', 'WOP Wages', 'Total Wages'];
    cols.forEach((h, i) => {
      const c = ws.getCell(1, i + 1);
      c.value = h;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cYellowMain } };
      c.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: cTextDark } };
      c.border = thinBorder;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ws.getRow(1).height = 24;

    list.forEach((emp, i) => {
      const r = i + 2;
      ws.getCell(r, 1).value = i + 1;
      ws.getCell(r, 2).value = emp.code;
      ws.getCell(r, 3).value = emp.name;
      ws.getCell(r, 4).value = emp.dept;
      ws.getCell(r, 5).value = emp.days || 1;
      ws.getCell(r, 6).value = emp.wopCount;
      ws.getCell(r, 7).value = emp.wopWages || 0;
      ws.getCell(r, 8).value = emp.totalWages || 0;

      const banded = i % 2 === 1;
      for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(r, c);
        cell.border = thinBorder;
        cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
        if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
        if (c === 7 || c === 8) cell.numFmt = '#,##0';
        cell.alignment = (c === 3 || c === 4) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
      }
      ws.getRow(r).height = 20;
    });

    const wCols = { 1: 7, 2: 15, 3: 28, 4: 24, 5: 14, 6: 14, 7: 16, 8: 16 };
    Object.entries(wCols).forEach(([c, w]) => { ws.getColumn(Number(c)).width = w; });
  }

  buildWopDetail('Plant Operators (WOP)', wopMetrics.op.list);
  buildWopDetail('Contract Labour (WOP)', wopMetrics.cl.list);
  buildWopDetail('NAPS Apprentices (WOP)', wopMetrics.naps.list);

  return await wb.xlsx.writeBuffer();
}

// ── Generate Dedicated Late Coming / Punctuality Report ──
export async function generateLateReportWorkbook(lateMetrics, master, batchResults) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Yokohama CTC Operations';
  wb.created = new Date();

  // 1. Summary Sheet
  const wsSummary = wb.addWorksheet('Punctuality Summary');
  wsSummary.views = [{ showGridLines: true }];

  wsSummary.mergeCells('A1:F1');
  const titleCell = wsSummary.getCell('A1');
  titleCell.value = 'YOKOHAMA CTC — SHIFT PUNCTUALITY & LATE ARRIVAL REPORT';
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(1).height = 30;

  // KPI Row
  wsSummary.getCell('A3').value = 'Total Late Incidents';
  wsSummary.getCell('B3').value = lateMetrics.totalCount;
  wsSummary.getCell('C3').value = 'Impacted Personnel';
  wsSummary.getCell('D3').value = lateMetrics.totalEmployees;
  wsSummary.getCell('E3').value = 'Total Lost Minutes';
  wsSummary.getCell('F3').value = lateMetrics.totalLostMins;
  ['A3', 'C3', 'E3'].forEach(pos => {
    const c = wsSummary.getCell(pos);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    c.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
    c.border = thinBorder;
  });
  ['B3', 'D3', 'F3'].forEach(pos => {
    const c = wsSummary.getCell(pos);
    c.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF0F172A' } };
    c.border = thinBorder;
    c.numFmt = '#,##0';
  });
  wsSummary.getRow(3).height = 22;

  // Table
  const headers = ['Category', 'Late Incidents', 'Impacted Personnel', 'Share %', 'Total Lost Mins', 'Avg Delay'];
  headers.forEach((h, i) => {
    const c = wsSummary.getCell(5, i + 1);
    c.value = h;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cYellowMain } };
    c.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: cTextDark } };
    c.border = thinBorder;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsSummary.getRow(5).height = 22;

  const rows = [
    {
      cat: 'Plant Operators',
      count: lateMetrics.op.count,
      emp: lateMetrics.op.employees,
      share: lateMetrics.totalCount ? (lateMetrics.op.count / lateMetrics.totalCount) * 100 : 0,
      mins: lateMetrics.op.lostMins,
      avg: lateMetrics.op.count ? Math.round(lateMetrics.op.lostMins / lateMetrics.op.count) : 0
    },
    {
      cat: 'Contract Labour (CL)',
      count: lateMetrics.cl.count,
      emp: lateMetrics.cl.employees,
      share: lateMetrics.totalCount ? (lateMetrics.cl.count / lateMetrics.totalCount) * 100 : 0,
      mins: lateMetrics.cl.lostMins,
      avg: lateMetrics.cl.count ? Math.round(lateMetrics.cl.lostMins / lateMetrics.cl.count) : 0
    },
    {
      cat: 'NAPS Apprentices',
      count: lateMetrics.naps.count,
      emp: lateMetrics.naps.employees,
      share: lateMetrics.totalCount ? (lateMetrics.naps.count / lateMetrics.totalCount) * 100 : 0,
      mins: lateMetrics.naps.lostMins,
      avg: lateMetrics.naps.count ? Math.round(lateMetrics.naps.lostMins / lateMetrics.naps.count) : 0
    }
  ];

  rows.forEach((rData, idx) => {
    const rowIdx = 6 + idx;
    wsSummary.getCell(rowIdx, 1).value = rData.cat;
    wsSummary.getCell(rowIdx, 2).value = rData.count;
    wsSummary.getCell(rowIdx, 3).value = rData.emp;
    wsSummary.getCell(rowIdx, 4).value = `${rData.share.toFixed(1)}%`;
    wsSummary.getCell(rowIdx, 5).value = rData.mins;
    wsSummary.getCell(rowIdx, 6).value = `${rData.avg} mins / incident`;

    for (let c = 1; c <= 6; c++) {
      const cell = wsSummary.getCell(rowIdx, c);
      cell.border = thinBorder;
      cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
      if (c === 2 || c === 3 || c === 5) cell.numFmt = '#,##0';
      cell.alignment = c === 1 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
    }
    wsSummary.getRow(rowIdx).height = 20;
  });

  const totRow = 9;
  wsSummary.getCell(totRow, 1).value = 'Total';
  wsSummary.getCell(totRow, 2).value = lateMetrics.totalCount;
  wsSummary.getCell(totRow, 3).value = lateMetrics.totalEmployees;
  wsSummary.getCell(totRow, 4).value = '100.0%';
  wsSummary.getCell(totRow, 5).value = lateMetrics.totalLostMins;
  wsSummary.getCell(totRow, 6).value = lateMetrics.totalCount ? `${Math.round(lateMetrics.totalLostMins / lateMetrics.totalCount)} mins / incident` : '0';
  for (let c = 1; c <= 6; c++) {
    const cell = wsSummary.getCell(totRow, c);
    cell.border = thinBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } };
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: cTextDark } };
    if (c === 2 || c === 3 || c === 5) cell.numFmt = '#,##0';
    cell.alignment = c === 1 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
  }
  wsSummary.getRow(totRow).height = 22;

  const wSummaryCol = { 1: 24, 2: 15, 3: 20, 4: 14, 5: 18, 6: 20 };
  Object.entries(wSummaryCol).forEach(([c, w]) => { wsSummary.getColumn(Number(c)).width = w; });

  // Detail sheets builder
  function buildLateDetail(sheetName, list) {
    const ws = wb.addWorksheet(sheetName);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }];
    const cols = ['S.No', 'Date', 'Emp Code', 'Employee Name', 'Department / Contractor', 'Shift', 'In-Time (Shift Start)', 'Late Delay (Mins)', 'Severity'];
    cols.forEach((h, i) => {
      const c = ws.getCell(1, i + 1);
      c.value = h;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cYellowMain } };
      c.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: cTextDark } };
      c.border = thinBorder;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ws.getRow(1).height = 24;

    list.forEach((emp, i) => {
      const r = i + 2;
      ws.getCell(r, 1).value = i + 1;
      ws.getCell(r, 2).value = emp.date || '';
      ws.getCell(r, 3).value = emp.code;
      ws.getCell(r, 4).value = emp.name;
      ws.getCell(r, 5).value = emp.dept;
      ws.getCell(r, 6).value = emp.shift || 'Shift A (7am-3pm)';
      ws.getCell(r, 7).value = `${emp.inTime || '07:20 AM'} (${emp.shiftStart || '07:00 AM'})`;
      ws.getCell(r, 8).value = emp.lateMins || 0;
      ws.getCell(r, 9).value = emp.severity || 'Minor';

      const banded = i % 2 === 1;
      for (let c = 1; c <= 9; c++) {
        const cell = ws.getCell(r, c);
        cell.border = thinBorder;
        cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
        if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
        if (c === 8) cell.numFmt = '#,##0';
        cell.alignment = (c === 4 || c === 5) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
      }
      ws.getRow(r).height = 20;
    });

    const wCols = { 1: 7, 2: 15, 3: 15, 4: 28, 5: 24, 6: 18, 7: 22, 8: 18, 9: 16 };
    Object.entries(wCols).forEach(([c, w]) => { ws.getColumn(Number(c)).width = w; });
  }

  buildLateDetail('Plant Operators (Late)', lateMetrics.op.list);
  buildLateDetail('Contract Labour (Late)', lateMetrics.cl.list);
  buildLateDetail('NAPS Apprentices (Late)', lateMetrics.naps.list);

  return await wb.xlsx.writeBuffer();
}

// Trigger browser file download
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

