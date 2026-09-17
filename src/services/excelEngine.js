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
export function styleSummarySheet(wsSummary, year, month, monthResults = []) {
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
    let label = 'Man Days';
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
    wsSummary.getColumn(c).width = (mod === 0) ? 13 : 14;
  }

  // Days styling: If single month, style 1 to daysInMonth; if all months / full year, style all dates dynamically
  const isAll = year === 'ALL' || month === 'ALL' || (year === undefined && month === undefined);
  if (!isAll && typeof year === 'number' && typeof month === 'number') {
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
  } else {
    // Multi-month / Full year: Style rows dynamically for all dates
    monthResults.forEach((res, idx) => {
      const r = 4 + idx;
      wsSummary.getRow(r).height = 20;
      const cellDate = wsSummary.getCell(r, 1);
      cellDate.value = new Date(res.date);
      cellDate.numFmt = 'dd-mmm-yyyy';
      cellDate.font = { name: FONT_NAME, size: 10, color: { argb: cTextSub } };
      cellDate.alignment = { horizontal: 'center', vertical: 'middle' };
      cellDate.border = thinBorder;

      const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFFAFAFA';
      for (let c = 2; c <= 37; c++) {
        const cell = wsSummary.getCell(r, c);
        cell.border = thinBorder;
        cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.numFmt = '#,##0';
      }
    });
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
  const statKeys = statMap instanceof Map ? Array.from(statMap.keys()) : Object.keys(statMap || {});
  const allCodes = Array.from(new Set([
    ...Object.keys(employeeMap || {}),
    ...statKeys
  ]));

  allCodes.forEach(code => {
    const st = getStatFromCat(statMap, code) || {};
    const isNapsCode = title === 'NAPS' || String(code).startsWith('LN');
    const info = (employeeMap && employeeMap[code]) || {
      name: st.name || code,
      dept: st.dept || (isNapsCode ? 'Apprentice' : 'Production'),
      dailyOT: st.dailyOT || (isNapsCode ? 0 : 162.61),
      dailyCTC: st.dailyCTC || (isNapsCode ? 483 : 783.59)
    };
    const otAmt = st.otAmount !== undefined ? st.otAmount : Math.round((st.otHrs || 0) * (info.dailyOT || 0) * 100) / 100;

    ws.getCell(r, 1).value = sno;
    ws.getCell(r, 2).value = code;
    ws.getCell(r, 3).value = info.name || st.name || code;
    ws.getCell(r, 4).value = info.dept || st.dept || 'Production';
    ws.getCell(r, 5).value = Math.round((st.workHrs || 0) * 100) / 100;
    ws.getCell(r, 6).value = st.daysPresent || 0;
    ws.getCell(r, 7).value = st.wopCount || 0;
    ws.getCell(r, 8).value = Math.round((st.otHrs || 0) * 100) / 100;
    ws.getCell(r, 9).value = Math.round(otAmt * 100) / 100;
    ws.getCell(r, 10).value = Math.round((st.wages || 0) * 100) / 100;

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
  wb.creator = 'Built by Joseph & Reuben Geoffrey (Hr Team)';
  wb.created = new Date();

  const isAll = year === 'ALL' || month === 'ALL' || (year === undefined && month === undefined);

  // Filter to requested month or keep all dates sorted chronologically
  const monthResults = (batchResults || []).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    if (!isAll && typeof year === 'number' && typeof month === 'number') {
      return d.getUTCFullYear() === year && d.getUTCMonth() === month;
    }
    return true;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  const wsSummary = wb.addWorksheet('Summary');
  styleSummarySheet(wsSummary, year, month, monthResults);

  // Fill Summary data
  monthResults.forEach((r, idx) => {
    const targetRow = isAll ? (4 + idx) : (3 + new Date(r.date).getUTCDate());
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

  // Compute monthly stats strictly for these results so employee totals are clean
  const effectiveEmpStats = monthResults.length > 0 && master ? aggregateMonthlyStats(monthResults, master) : (empStats || { OP: new Map(), CL: new Map(), NAPS: new Map() });

  // Build Detail Sheets: ATC, CL, NAPS, and Project (Right of NAPS)
  buildDetailSheet(wb, 'ATC', master?.operator || {}, effectiveEmpStats.OP);
  buildDetailSheet(wb, 'CL', master?.contract || {}, effectiveEmpStats.CL);
  buildDetailSheet(wb, 'NAPS', master?.naps || {}, effectiveEmpStats.NAPS);

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
  styleSummarySheet(wsSummary, year, month, [dayResult]);

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

  const dayStats = aggregateMonthlyStats([dayResult], master);
  buildDetailSheet(wb, 'ATC', master?.operator || {}, dayStats.OP);
  buildDetailSheet(wb, 'CL', master?.contract || {}, dayStats.CL);
  buildDetailSheet(wb, 'NAPS', master?.naps || {}, dayStats.NAPS);

  const projectEmployees = getProjectEmployees(master);
  const projectStats = getProjectStats(projectEmployees, dayStats);
  buildDetailSheet(wb, 'Project', projectEmployees, projectStats);

  return await wb.xlsx.writeBuffer();
}

// Generate ZIP Archive of all single days + monthly master
export async function generateZipBundle(batchResults, master, empStats, year, month) {
  const zip = new JSZip();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const isAll = year === 'ALL' || month === 'ALL' || (year === undefined && month === undefined);

  if (isAll) {
    // 1. Group results by month to generate per-month master workbooks
    const monthGroups = {};
    (batchResults || []).forEach(r => {
      if (!r.date) return;
      const d = new Date(r.date);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      if (!monthGroups[key]) monthGroups[key] = { year: d.getUTCFullYear(), month: d.getUTCMonth(), results: [] };
      monthGroups[key].results.push(r);
    });

    for (const group of Object.values(monthGroups)) {
      const gName = monthNames[group.month] || 'Month';
      const gBuf = await generateMonthlyWorkbook(group.results, master, empStats, group.year, group.month);
      zip.file(`CTC_Output_${gName}_${group.year}.xlsx`, gBuf);
    }

    // 2. Full Year master workbook
    const fullYearBuf = await generateMonthlyWorkbook(batchResults, master, empStats, 'ALL', 'ALL');
    zip.file(`CTC_Output_Full_Year.xlsx`, fullYearBuf);

    // 3. Individual Dates
    for (const r of (batchResults || [])) {
      const d = new Date(r.date);
      const dayBuf = await generateSingleDayWorkbook(r, master, d.getUTCFullYear(), d.getUTCMonth());
      const dateStr = formatDateToInput(r.date);
      zip.file(`CTC_Output_${dateStr}.xlsx`, dayBuf);
    }
  } else {
    const mName = monthNames[month] || 'Monthly';
    const monthResults = (batchResults || []).filter(r => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return d.getUTCFullYear() === year && d.getUTCMonth() === month;
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
  }

  return await zip.generateAsync({ type: 'blob' });
}

// ── Generate Dedicated WOP Statistics Workbook (Executive Blue Business Template) ──
export async function generateWopReportWorkbook(wopMetrics, master, batchResults) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Built by Joseph & Reuben Geoffrey (Hr Team)';
  wb.created = new Date();

  const cBlueDark = 'FF0F172A';   // Deep Navy Slate
  const cBlueHeader = 'FF1E40AF'; // Executive Royal Blue (Dark & Crisp)
  const cBlueAccent = 'FFDBEAFE'; // Light Ice Blue
  const cBlueTotal = 'FF1D4ED8';  // Vibrant Blue
  const cBlueRowEven = 'FFF8FAFC';
  const cBlueBorder = 'FFBFDBFE';

  const blueThinBorder = {
    top: { style: 'thin', color: { argb: cBlueBorder } },
    left: { style: 'thin', color: { argb: cBlueBorder } },
    bottom: { style: 'thin', color: { argb: cBlueBorder } },
    right: { style: 'thin', color: { argb: cBlueBorder } }
  };

  const blueDoubleBottomBorder = {
    top: { style: 'thin', color: { argb: cBlueBorder } },
    left: { style: 'thin', color: { argb: cBlueBorder } },
    bottom: { style: 'double', color: { argb: 'FF1E3A8A' } },
    right: { style: 'thin', color: { argb: cBlueBorder } }
  };

  // 1. Executive Summary Sheet
  const wsSummary = wb.addWorksheet('WOP Executive Summary');
  wsSummary.views = [{ showGridLines: true }];

  // Banner Title
  wsSummary.mergeCells('A1:F1');
  const titleCell = wsSummary.getCell('A1');
  titleCell.value = 'CTC — WEEKLY OFF PRESENT (WOP) EXECUTIVE AUDIT REPORT';
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cBlueDark } };
  titleCell.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(1).height = 32;

  // KPI Tiles
  wsSummary.getCell('A3').value = 'Total WOP Shifts';
  wsSummary.getCell('B3').value = wopMetrics.totalCount;
  wsSummary.getCell('C3').value = 'Total Personnel Deployed';
  wsSummary.getCell('D3').value = wopMetrics.totalEmployees;
  wsSummary.getCell('E3').value = 'Estimated WOP Wages';
  wsSummary.getCell('F3').value = wopMetrics.totalWages;

  ['A3', 'C3', 'E3'].forEach(pos => {
    const c = wsSummary.getCell(pos);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cBlueAccent } };
    c.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
    c.border = blueThinBorder;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  ['B3', 'D3', 'F3'].forEach(pos => {
    const c = wsSummary.getCell(pos);
    c.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: 'FF0F172A' } };
    c.border = blueThinBorder;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.numFmt = '#,##0';
  });
  wsSummary.getRow(3).height = 24;

  // Breakdown Table Header
  const headers = ['Category', 'WOP Shifts', 'Personnel Deployed', 'Category Share', 'Estimated Wage Outflow', 'Average Frequency'];
  headers.forEach((h, i) => {
    const c = wsSummary.getCell(5, i + 1);
    c.value = h;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cBlueHeader } };
    c.font = { name: FONT_NAME, size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    c.border = blueThinBorder;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsSummary.getRow(5).height = 24;

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
    wsSummary.getCell(rowIdx, 6).value = `${rData.avg.toFixed(1)} days / worker`;

    const isEven = idx % 2 === 1;
    for (let c = 1; c <= 6; c++) {
      const cell = wsSummary.getCell(rowIdx, c);
      cell.border = blueThinBorder;
      cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
      if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cBlueRowEven } };
      if (c === 2 || c === 3 || c === 5) cell.numFmt = '#,##0';
      cell.alignment = c === 1 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
    }
    wsSummary.getRow(rowIdx).height = 22;
  });

  // Total Summary row
  const totRow = 9;
  wsSummary.getCell(totRow, 1).value = 'Plant Grand Total';
  wsSummary.getCell(totRow, 2).value = wopMetrics.totalCount;
  wsSummary.getCell(totRow, 3).value = wopMetrics.totalEmployees;
  wsSummary.getCell(totRow, 4).value = '100.0%';
  wsSummary.getCell(totRow, 5).value = wopMetrics.totalWages;
  wsSummary.getCell(totRow, 6).value = wopMetrics.totalEmployees ? `${(wopMetrics.totalCount / wopMetrics.totalEmployees).toFixed(1)} days / worker` : '0';
  for (let c = 1; c <= 6; c++) {
    const cell = wsSummary.getCell(totRow, c);
    cell.border = blueDoubleBottomBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cBlueTotal } };
    cell.font = { name: FONT_NAME, size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    if (c === 2 || c === 3 || c === 5) cell.numFmt = '#,##0';
    cell.alignment = c === 1 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
  }
  wsSummary.getRow(totRow).height = 24;

  const wSummaryCol = { 1: 26, 2: 16, 3: 24, 4: 16, 5: 22, 6: 22 };
  Object.entries(wSummaryCol).forEach(([c, w]) => { wsSummary.getColumn(Number(c)).width = w; });

  // Detail sheets builder (Royal Blue Template)
  function buildWopDetail(sheetName, list) {
    const ws = wb.addWorksheet(sheetName);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }];
    const cols = ['S.No', 'Emp Code', 'Employee Name', 'Department / Contractor', 'Days Present', 'WOP Shifts', 'Daily Rate', 'WOP Wages', 'Total CTC Wages'];
    cols.forEach((h, i) => {
      const c = ws.getCell(1, i + 1);
      c.value = h;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cBlueHeader } };
      c.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.border = blueThinBorder;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    ws.getRow(1).height = 26;

    let totalWopDays = 0;
    let totalWopCost = 0;
    let totalAllCost = 0;

    list.forEach((emp, i) => {
      const r = i + 2;
      totalWopDays += (emp.wopCount || 0);
      totalWopCost += (emp.wopWages || 0);
      totalAllCost += (emp.totalWages || 0);

      ws.getCell(r, 1).value = i + 1;
      ws.getCell(r, 2).value = emp.code;
      ws.getCell(r, 3).value = emp.name;
      ws.getCell(r, 4).value = emp.dept;
      ws.getCell(r, 5).value = emp.days || 1;
      ws.getCell(r, 6).value = emp.wopCount;
      ws.getCell(r, 7).value = emp.dailyRate || (emp.wopCount > 0 ? Math.round(emp.wopWages / emp.wopCount) : 0);
      ws.getCell(r, 8).value = emp.wopWages || 0;
      ws.getCell(r, 9).value = emp.totalWages || 0;

      const banded = i % 2 === 1;
      for (let c = 1; c <= 9; c++) {
        const cell = ws.getCell(r, c);
        cell.border = blueThinBorder;
        cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
        if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cBlueRowEven } };
        if (c === 5 || c === 6 || c === 7 || c === 8 || c === 9) cell.numFmt = '#,##0';
        cell.alignment = (c === 3 || c === 4) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
      }
      ws.getRow(r).height = 20;
    });

    // Total Row
    const lastR = list.length + 2;
    ws.getCell(lastR, 1).value = '';
    ws.getCell(lastR, 2).value = 'TOTAL';
    ws.getCell(lastR, 3).value = `${list.length} Personnel`;
    ws.getCell(lastR, 4).value = '';
    ws.getCell(lastR, 5).value = '';
    ws.getCell(lastR, 6).value = totalWopDays;
    ws.getCell(lastR, 7).value = '';
    ws.getCell(lastR, 8).value = totalWopCost;
    ws.getCell(lastR, 9).value = totalAllCost;

    for (let c = 1; c <= 9; c++) {
      const cell = ws.getCell(lastR, c);
      cell.border = blueDoubleBottomBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cBlueTotal } };
      cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      if (c === 6 || c === 8 || c === 9) cell.numFmt = '#,##0';
      cell.alignment = (c === 3) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
    }
    ws.getRow(lastR).height = 24;

    const wCols = { 1: 7, 2: 15, 3: 28, 4: 24, 5: 14, 6: 14, 7: 14, 8: 16, 9: 16 };
    Object.entries(wCols).forEach(([c, w]) => { ws.getColumn(Number(c)).width = w; });
  }

  buildWopDetail('Plant Operators (WOP)', wopMetrics.op.list);
  buildWopDetail('Contract Labour (WOP)', wopMetrics.cl.list);
  buildWopDetail('NAPS Apprentices (WOP)', wopMetrics.naps.list);

  return await wb.xlsx.writeBuffer();
}

// ── Generate Dedicated Late Coming Report (Perfect Green Executive Theme) ──
export async function generateLateReportWorkbook(lateMetrics, master, batchResults) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Built by Joseph & Reuben Geoffrey (Hr Team)';
  wb.created = new Date();

  const cGreenDark = 'FF064E3B';   // Deep Forest / Emerald
  const cGreenHeader = 'FF047857'; // Rich Emerald Green Header (Solid & Crisp)
  const cGreenAccent = 'FFD1FAE5'; // Soft Mint Accent
  const cGreenTotal = 'FF059669';  // Vibrant Emerald Total
  const cGreenRowEven = 'FFF0FDF4'; // Soft Green Zebra
  const cGreenBorder = 'FFA7F3D0'; // Crisp Green Border

  const greenThinBorder = {
    top: { style: 'thin', color: { argb: cGreenBorder } },
    left: { style: 'thin', color: { argb: cGreenBorder } },
    bottom: { style: 'thin', color: { argb: cGreenBorder } },
    right: { style: 'thin', color: { argb: cGreenBorder } }
  };

  const greenDoubleBottomBorder = {
    top: { style: 'thin', color: { argb: cGreenBorder } },
    left: { style: 'thin', color: { argb: cGreenBorder } },
    bottom: { style: 'double', color: { argb: 'FF064E3B' } },
    right: { style: 'thin', color: { argb: cGreenBorder } }
  };

  // 1. Summary Sheet
  const wsSummary = wb.addWorksheet('Punctuality Summary');
  wsSummary.views = [{ showGridLines: true }];

  // Banner Title
  wsSummary.mergeCells('A1:F1');
  const titleCell = wsSummary.getCell('A1');
  titleCell.value = 'CTC — SHIFT PUNCTUALITY & LATE ARRIVAL EXECUTIVE REPORT';
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cGreenDark } };
  titleCell.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(1).height = 32;

  // KPI Tiles
  wsSummary.getCell('A3').value = 'Total Late Incidents';
  wsSummary.getCell('B3').value = lateMetrics.totalCount;
  wsSummary.getCell('C3').value = 'Impacted Personnel';
  wsSummary.getCell('D3').value = lateMetrics.totalEmployees;
  wsSummary.getCell('E3').value = 'Total Lost Work Time';
  wsSummary.getCell('F3').value = `${lateMetrics.totalLostHours}h (${lateMetrics.totalLostMins}m)`;

  ['A3', 'C3', 'E3'].forEach(pos => {
    const c = wsSummary.getCell(pos);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cGreenAccent } };
    c.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF064E3B' } };
    c.border = greenThinBorder;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  ['B3', 'D3', 'F3'].forEach(pos => {
    const c = wsSummary.getCell(pos);
    c.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: 'FF064E3B' } };
    c.border = greenThinBorder;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    if (pos !== 'F3') c.numFmt = '#,##0';
  });
  wsSummary.getRow(3).height = 24;

  // Breakdown Table Header
  const headers = ['Category', 'Late Incidents', 'Impacted Personnel', 'Category Share', 'Total Lost Mins', 'Average Delay'];
  headers.forEach((h, i) => {
    const c = wsSummary.getCell(5, i + 1);
    c.value = h;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cGreenHeader } };
    c.font = { name: FONT_NAME, size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    c.border = greenThinBorder;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsSummary.getRow(5).height = 24;

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

    const isEven = idx % 2 === 1;
    for (let c = 1; c <= 6; c++) {
      const cell = wsSummary.getCell(rowIdx, c);
      cell.border = greenThinBorder;
      cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
      if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cGreenRowEven } };
      if (c === 2 || c === 3 || c === 5) cell.numFmt = '#,##0';
      cell.alignment = c === 1 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
    }
    wsSummary.getRow(rowIdx).height = 22;
  });

  // Total Summary row
  const totRow = 9;
  wsSummary.getCell(totRow, 1).value = 'Plant Grand Total';
  wsSummary.getCell(totRow, 2).value = lateMetrics.totalCount;
  wsSummary.getCell(totRow, 3).value = lateMetrics.totalEmployees;
  wsSummary.getCell(totRow, 4).value = '100.0%';
  wsSummary.getCell(totRow, 5).value = lateMetrics.totalLostMins;
  wsSummary.getCell(totRow, 6).value = lateMetrics.totalCount ? `${Math.round(lateMetrics.totalLostMins / lateMetrics.totalCount)} mins / incident` : '0';
  for (let c = 1; c <= 6; c++) {
    const cell = wsSummary.getCell(totRow, c);
    cell.border = greenDoubleBottomBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cGreenTotal } };
    cell.font = { name: FONT_NAME, size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    if (c === 2 || c === 3 || c === 5) cell.numFmt = '#,##0';
    cell.alignment = c === 1 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
  }
  wsSummary.getRow(totRow).height = 24;

  const wSummaryCol = { 1: 26, 2: 16, 3: 24, 4: 16, 5: 22, 6: 24 };
  Object.entries(wSummaryCol).forEach(([c, w]) => { wsSummary.getColumn(Number(c)).width = w; });

  // Detail sheets builder (Emerald Green Theme)
  function buildLateDetail(sheetName, list) {
    const ws = wb.addWorksheet(sheetName);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }];
    const cols = ['S.No', 'Date', 'Emp Code', 'Employee Name', 'Department / Contractor', 'Shift', 'In-Time (Shift Start)', 'Late Delay (Mins)', 'Severity'];
    cols.forEach((h, i) => {
      const c = ws.getCell(1, i + 1);
      c.value = h;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cGreenHeader } };
      c.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.border = greenThinBorder;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    ws.getRow(1).height = 26;

    let totalLostMinutes = 0;

    list.forEach((emp, i) => {
      const r = i + 2;
      totalLostMinutes += (emp.lateMins || 0);

      ws.getCell(r, 1).value = i + 1;
      ws.getCell(r, 2).value = emp.date || '';
      ws.getCell(r, 3).value = emp.code;
      ws.getCell(r, 4).value = emp.name;
      ws.getCell(r, 5).value = emp.dept;
      ws.getCell(r, 6).value = emp.shift || 'Shift A (7am-3pm)';
      ws.getCell(r, 7).value = `${emp.inTime || '07:20 AM'} (${emp.shiftStart || '07:00 AM'})`;
      ws.getCell(r, 8).value = emp.lateMins || 0;
      ws.getCell(r, 9).value = emp.severity || 'Minor (<15m)';

      const banded = i % 2 === 1;
      for (let c = 1; c <= 9; c++) {
        const cell = ws.getCell(r, c);
        cell.border = greenThinBorder;
        cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
        if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cGreenRowEven } };
        if (c === 8) cell.numFmt = '#,##0';
        cell.alignment = (c === 4 || c === 5) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
      }
      ws.getRow(r).height = 20;
    });

    // Total Row
    const lastR = list.length + 2;
    ws.getCell(lastR, 1).value = '';
    ws.getCell(lastR, 2).value = '';
    ws.getCell(lastR, 3).value = 'TOTAL';
    ws.getCell(lastR, 4).value = `${list.length} Late Incidents`;
    ws.getCell(lastR, 5).value = '';
    ws.getCell(lastR, 6).value = '';
    ws.getCell(lastR, 7).value = '';
    ws.getCell(lastR, 8).value = totalLostMinutes;
    ws.getCell(lastR, 9).value = `${(totalLostMinutes / 60).toFixed(1)} hrs lost`;

    for (let c = 1; c <= 9; c++) {
      const cell = ws.getCell(lastR, c);
      cell.border = greenDoubleBottomBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cGreenTotal } };
      cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      if (c === 8) cell.numFmt = '#,##0';
      cell.alignment = (c === 4) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
    }
    ws.getRow(lastR).height = 24;

    const wCols = { 1: 7, 2: 15, 3: 15, 4: 28, 5: 24, 6: 22, 7: 24, 8: 18, 9: 18 };
    Object.entries(wCols).forEach(([c, w]) => { ws.getColumn(Number(c)).width = w; });
  }

  buildLateDetail('Plant Operators (Late)', lateMetrics.op.list);
  buildLateDetail('Contract Labour (Late)', lateMetrics.cl.list);
  buildLateDetail('NAPS Apprentices (Late)', lateMetrics.naps.list);

  return await wb.xlsx.writeBuffer();
}

// ── Generate Dedicated Overtime (OT) Audit Workbook (Executive Amber/Orange Template) ──
export async function generateOvertimeReportWorkbook(otMetrics, master, batchResults) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Built by Joseph & Reuben Geoffrey (Hr Team)';
  wb.created = new Date();

  const cAmberDark = 'FF78350F';   // Deep Warm Amber Slate
  const cAmberHeader = 'FFB45309'; // Executive Warm Amber
  const cAmberAccent = 'FFFEF3C7'; // Light Amber Cream
  const cAmberTotal = 'FFD97706';  // Vibrant Amber
  const cAmberRowEven = 'FFFFFBEB';
  const cAmberBorder = 'FFFDE68A';

  const amberThinBorder = {
    top: { style: 'thin', color: { argb: cAmberBorder } },
    left: { style: 'thin', color: { argb: cAmberBorder } },
    bottom: { style: 'thin', color: { argb: cAmberBorder } },
    right: { style: 'thin', color: { argb: cAmberBorder } }
  };

  const amberDoubleBottomBorder = {
    top: { style: 'thin', color: { argb: cAmberBorder } },
    left: { style: 'thin', color: { argb: cAmberBorder } },
    bottom: { style: 'double', color: { argb: 'FF92400E' } },
    right: { style: 'thin', color: { argb: cAmberBorder } }
  };

  // 1. Executive Summary Sheet
  const wsSummary = wb.addWorksheet('OT Executive Summary');
  wsSummary.views = [{ showGridLines: true }];

  // Banner Title
  wsSummary.mergeCells('A1:F1');
  const titleCell = wsSummary.getCell('A1');
  titleCell.value = 'CTC — OVERTIME (OT) EXECUTIVE AUDIT REPORT';
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cAmberDark } };
  titleCell.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(1).height = 32;

  // KPI Tiles
  wsSummary.getCell('A3').value = 'Total OT Hours';
  wsSummary.getCell('B3').value = otMetrics.totalHours;
  wsSummary.getCell('C3').value = 'Total Overtime Workers';
  wsSummary.getCell('D3').value = otMetrics.totalEmployees;
  wsSummary.getCell('E3').value = 'Total Overtime Wages';
  wsSummary.getCell('F3').value = otMetrics.totalWages;

  ['A3', 'C3', 'E3'].forEach(pos => {
    const c = wsSummary.getCell(pos);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cAmberAccent } };
    c.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF92400E' } };
    c.border = amberThinBorder;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  ['B3', 'D3', 'F3'].forEach((pos, idx) => {
    const c = wsSummary.getCell(pos);
    c.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: cAmberDark } };
    c.border = amberThinBorder;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    if (idx === 0) c.numFmt = '#,##0.00';
    else if (idx === 1) c.numFmt = '#,##0';
    else if (idx === 2) c.numFmt = '₹#,##0';
  });
  wsSummary.getRow(3).height = 22;

  // Category Breakdown Table
  const catHeaders = ['Labour Category', 'Personnel Count', 'Total OT Hours', 'Overtime Compensation', '% OT Share'];
  catHeaders.forEach((h, i) => {
    const cell = wsSummary.getCell(5, i + 1);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cAmberHeader } };
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.border = amberThinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsSummary.getRow(5).height = 22;

  const cats = [
    { label: 'Plant Operators', m: otMetrics.op },
    { label: 'Contract Labour', m: otMetrics.cl },
    { label: 'NAPS Apprentices', m: otMetrics.naps }
  ];

  let catRow = 6;
  cats.forEach(c => {
    const share = otMetrics.totalHours > 0 ? (c.m.hours / otMetrics.totalHours) : 0;
    wsSummary.getCell(catRow, 1).value = c.label;
    wsSummary.getCell(catRow, 2).value = c.m.employees;
    wsSummary.getCell(catRow, 3).value = c.m.hours;
    wsSummary.getCell(catRow, 4).value = c.m.wages;
    wsSummary.getCell(catRow, 5).value = share;

    for (let col = 1; col <= 5; col++) {
      const cell = wsSummary.getCell(catRow, col);
      cell.border = amberThinBorder;
      cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
      if (col === 2) cell.numFmt = '#,##0';
      if (col === 3) cell.numFmt = '#,##0.00';
      if (col === 4) cell.numFmt = '₹#,##0';
      if (col === 5) cell.numFmt = '0.0%';
      cell.alignment = (col === 1) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'right', vertical: 'middle' };
    }
    wsSummary.getRow(catRow).height = 20;
    catRow++;
  });

  // Summary Total Row
  wsSummary.getCell(catRow, 1).value = 'PLANT WIDE TOTAL';
  wsSummary.getCell(catRow, 2).value = otMetrics.totalEmployees;
  wsSummary.getCell(catRow, 3).value = otMetrics.totalHours;
  wsSummary.getCell(catRow, 4).value = otMetrics.totalWages;
  wsSummary.getCell(catRow, 5).value = 1.0;

  for (let col = 1; col <= 5; col++) {
    const cell = wsSummary.getCell(catRow, col);
    cell.border = amberDoubleBottomBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cAmberTotal } };
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    if (col === 2) cell.numFmt = '#,##0';
    if (col === 3) cell.numFmt = '#,##0.00';
    if (col === 4) cell.numFmt = '₹#,##0';
    if (col === 5) cell.numFmt = '0.0%';
    cell.alignment = (col === 1) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'right', vertical: 'middle' };
  }
  wsSummary.getRow(catRow).height = 24;

  const summaryCols = { 1: 26, 2: 18, 3: 18, 4: 26, 5: 16 };
  Object.entries(summaryCols).forEach(([c, w]) => { wsSummary.getColumn(Number(c)).width = w; });

  // Helper for Category Detail Sheets
  function buildOtDetail(sheetName, list) {
    const ws = wb.addWorksheet(sheetName);
    ws.views = [{ showGridLines: true }];

    const headers = ['S.No', 'Emp Code', 'Employee Name', 'Department', 'Days Present', 'OT Hours', 'Daily OT Rate', 'OT Wages', 'Total Wages'];
    headers.forEach((h, i) => {
      const cell = ws.getCell(1, i + 1);
      cell.value = h;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cAmberHeader } };
      cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = amberThinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ws.getRow(1).height = 24;

    let totHours = 0;
    let totOtWages = 0;
    let totAllWages = 0;

    list.forEach((emp, i) => {
      const r = i + 2;
      totHours += (emp.otHours || 0);
      totOtWages += (emp.otWages || 0);
      totAllWages += (emp.totalWages || 0);

      ws.getCell(r, 1).value = i + 1;
      ws.getCell(r, 2).value = emp.code;
      ws.getCell(r, 3).value = emp.name;
      ws.getCell(r, 4).value = emp.dept;
      ws.getCell(r, 5).value = emp.days || 1;
      ws.getCell(r, 6).value = Math.round((emp.otHours || 0) * 100) / 100;
      ws.getCell(r, 7).value = Math.round((emp.dailyRate || 0) * 100) / 100;
      ws.getCell(r, 8).value = Math.round((emp.otWages || 0) * 100) / 100;
      ws.getCell(r, 9).value = Math.round((emp.totalWages || 0) * 100) / 100;

      const banded = i % 2 === 1;
      for (let c = 1; c <= 9; c++) {
        const cell = ws.getCell(r, c);
        cell.border = amberThinBorder;
        cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF111827' } };
        if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cAmberRowEven } };
        if (c === 5) cell.numFmt = '#,##0';
        if (c === 6) cell.numFmt = '#,##0.00';
        if (c === 7 || c === 8 || c === 9) cell.numFmt = '#,##0.00';
        cell.alignment = (c === 3 || c === 4) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
      }
      ws.getRow(r).height = 20;
    });

    // Total Row
    const lastR = list.length + 2;
    ws.getCell(lastR, 1).value = '';
    ws.getCell(lastR, 2).value = '';
    ws.getCell(lastR, 3).value = 'TOTAL';
    ws.getCell(lastR, 4).value = `${list.length} Employees`;
    ws.getCell(lastR, 5).value = '';
    ws.getCell(lastR, 6).value = Math.round(totHours * 100) / 100;
    ws.getCell(lastR, 7).value = '';
    ws.getCell(lastR, 8).value = Math.round(totOtWages * 100) / 100;
    ws.getCell(lastR, 9).value = Math.round(totAllWages * 100) / 100;

    for (let c = 1; c <= 9; c++) {
      const cell = ws.getCell(lastR, c);
      cell.border = amberDoubleBottomBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cAmberTotal } };
      cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      if (c === 6) cell.numFmt = '#,##0.00';
      if (c === 8 || c === 9) cell.numFmt = '#,##0.00';
      cell.alignment = (c === 3 || c === 4) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
    }
    ws.getRow(lastR).height = 24;

    const wCols = { 1: 7, 2: 14, 3: 28, 4: 22, 5: 15, 6: 15, 7: 16, 8: 18, 9: 18 };
    Object.entries(wCols).forEach(([c, w]) => { ws.getColumn(Number(c)).width = w; });
  }

  buildOtDetail('Plant Operators (OT)', otMetrics.op.list);
  buildOtDetail('Contract Labour (OT)', otMetrics.cl.list);
  buildOtDetail('NAPS Apprentices (OT)', otMetrics.naps.list);

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

