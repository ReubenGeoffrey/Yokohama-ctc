import * as XLSX from 'xlsx';

const MONTH_MAP = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
};

export function timeStrToHours(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v * 24;
  const str = String(v).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  return 0;
}

export function formatDateDisplay(dateObj) {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}-${monthNames[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

export function formatDateToInput(dateObj) {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sheetToRows(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
}

export function findHeaderRowIdx(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i];
    if (!r) continue;
    const r0 = String(r[0] || '').trim().toUpperCase();
    if (r0 === 'SR.NO' || r0 === 'SRNO' || r0 === 'SNO' || r0 === 'S.NO' || r0 === 'SL NO') {
      return i;
    }
  }
  return -1;
}

export function extractDateFromAnywhere(rows, filename) {
  // 1. Check first 10 rows for printed header dates
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i];
    if (!r) continue;
    for (let c = 0; c < Math.min(r.length, 8); c++) {
      const cellStr = String(r[c] || '').trim();
      if (cellStr.toUpperCase().includes('PRINTED ON') || cellStr.toUpperCase().includes('PRINTED AT')) {
        continue;
      }
      const match = cellStr.match(/as of\s+(\d{1,2})\w{0,2}\s+([A-Za-z]{3,})\s+(\d{4})/i);
      if (match) {
        const day = parseInt(match[1], 10);
        const monStr = match[2].slice(0, 3).toUpperCase();
        const yr = parseInt(match[3], 10);
        if (MONTH_MAP[monStr] !== undefined) {
          return new Date(Date.UTC(yr, MONTH_MAP[monStr], day));
        }
      }
      const m2 = cellStr.match(/(\d{1,2})[-\s/]([A-Za-z]{3,})[-\s/](\d{4})/);
      if (m2) {
        const day = parseInt(m2[1], 10);
        const monStr = m2[2].slice(0, 3).toUpperCase();
        const yr = parseInt(m2[3], 10);
        if (MONTH_MAP[monStr] !== undefined) {
          return new Date(Date.UTC(yr, MONTH_MAP[monStr], day));
        }
      }
    }
  }

  // 2. Check filename
  const fn = String(filename || '');
  const m_dmy = fn.match(/(\d{1,2})\s*[-_/\.]\s*(\d{1,2})\s*[-_/\.]\s*(\d{4})/);
  if (m_dmy) {
    return new Date(Date.UTC(parseInt(m_dmy[3], 10), parseInt(m_dmy[2], 10) - 1, parseInt(m_dmy[1], 10)));
  }
  const m_iso = fn.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m_iso) {
    return new Date(Date.UTC(parseInt(m_iso[1], 10), parseInt(m_iso[2], 10) - 1, parseInt(m_iso[3], 10)));
  }
  const m_fn = fn.match(/Date\s*(\d{1,2})/i) || fn.match(/(\d{1,2})[-_]Aug/i);
  if (m_fn) {
    return new Date(Date.UTC(2026, 7, parseInt(m_fn[1], 10)));
  }
  return null;
}

export function detectCategory(rows, hIdx, filename) {
  // Check header area
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row) continue;
    for (let c = 0; c < Math.min(row.length, 8); c++) {
      const cell = String(row[c] || '').toUpperCase();
      if (cell.includes('CATEGORY :') || cell.includes('CATEGORY:')) {
        if (cell.includes('OPERATOR')) return 'OP';
        if (cell.includes('NAPS')) return 'NAPS';
        if (cell.includes('CONTRACT') || cell.includes('CL')) return 'CL';
      }
    }
  }

  // Check employee code patterns
  if (hIdx !== -1 && rows[hIdx]) {
    const header = rows[hIdx].map(h => String(h || '').trim().toUpperCase());
    const cIdx = header.indexOf('CODE');
    if (cIdx !== -1) {
      for (let r = hIdx + 1; r < Math.min(rows.length, hIdx + 10); r++) {
        if (rows[r] && rows[r][cIdx]) {
          const sample = String(rows[r][cIdx]).trim().toUpperCase();
          if (sample.startsWith('9')) return 'OP';
          if (sample.startsWith('LN')) return 'NAPS';
          if (sample.length >= 4) return 'CL';
        }
      }
    }
  }

  // Check filename
  const fn = (filename || '').toUpperCase();
  if (fn.includes('OPERATOR') || fn.includes('OP')) return 'OP';
  if (fn.includes('NAPS')) return 'NAPS';
  return 'CL';
}

export function parsePresentRecords(rows, hIdx) {
  if (hIdx === -1) return [];
  const header = rows[hIdx].map(h => String(h || '').trim().toUpperCase());
  const idxCode = header.indexOf('CODE');
  const idxName = header.indexOf('NAME');
  const idxStatus = header.indexOf('STATUS');
  const idxOT = header.indexOf('OT');
  let idxWorkHrs = header.indexOf('WORKHRS');
  if (idxWorkHrs === -1) idxWorkHrs = header.indexOf('WORK HRS');

  const out = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || idxCode === -1 || !r[idxCode]) continue;
    const codeStr = String(r[idxCode]).trim().toUpperCase();
    if (codeStr === 'GRANDTOTAL' || codeStr.startsWith('TOTAL')) continue;
    const stStr = idxStatus !== -1 ? String(r[idxStatus] || '').trim().toUpperCase() : 'P';
    out.push({
      code: codeStr,
      name: idxName !== -1 ? String(r[idxName] || '').trim() : '',
      status: stStr,
      isWop: stStr === 'WOP',
      otHours: idxOT !== -1 ? timeStrToHours(r[idxOT]) : 0,
      workHours: idxWorkHrs !== -1 ? timeStrToHours(r[idxWorkHrs]) : 0
    });
  }
  return out;
}

export function parseMasterWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });

  // 1. Contract
  const wsCL = wb.Sheets['Contract'] || wb.Sheets['CONTRACT'];
  if (!wsCL) throw new Error('Sheet "Contract" not found in CTC Master file.');
  const rowsCL = sheetToRows(wsCL);
  const hCL = rowsCL[1].map(h => String(h || '').trim().toUpperCase());
  const idxEmp = hCL.indexOf('EMP NO');
  const idxNameC = hCL.indexOf('NAME');
  const idxCatC = hCL.indexOf('CATEGORY');
  const idxDeptC = hCL.indexOf('DEPT');
  const idxCTCC = hCL.indexOf('DAILY CTC');
  const idxOTC = hCL.indexOf('DAILY OT');

  const contract = {};
  for (let i = 2; i < rowsCL.length; i++) {
    const r = rowsCL[i];
    if (!r || !r[idxEmp]) continue;
    const code = String(r[idxEmp]).trim().toUpperCase();
    contract[code] = {
      name: String(r[idxNameC] || '').trim(),
      dept: String(r[idxDeptC] || '').trim(),
      direct: String(r[idxCatC] || '').trim().toUpperCase() === 'DIRECT',
      dailyCTC: Number(r[idxCTCC]) || 0,
      dailyOT: Number(r[idxOTC]) || 0
    };
  }

  // 2. NAPS
  const wsNAPS = wb.Sheets['NAPS'];
  if (!wsNAPS) throw new Error('Sheet "NAPS" not found in CTC Master file.');
  const rowsNAPS = sheetToRows(wsNAPS);
  const hNAPS = rowsNAPS[0].map(h => String(h || '').trim().toUpperCase());
  const idxCodeN = hNAPS.indexOf('CODE');
  const idxNameN = hNAPS.indexOf('NAME');
  const idxDeptN = hNAPS.indexOf('DEPT');
  const idxDIN = hNAPS.indexOf('DIRECT/INDIRECT');
  const idxCTCN = hNAPS.indexOf('DAILY CTC');

  const naps = {};
  for (let i = 1; i < rowsNAPS.length; i++) {
    const r = rowsNAPS[i];
    if (!r || !r[idxCodeN]) continue;
    const code = String(r[idxCodeN]).trim().toUpperCase();
    naps[code] = {
      name: String(r[idxNameN] || '').trim(),
      dept: String(r[idxDeptN] || '').trim(),
      direct: String(r[idxDIN] || '').trim().toUpperCase() === 'DIRECT',
      dailyCTC: Number(r[idxCTCN]) || 0,
      dailyOT: 0
    };
  }

  // 3. Operator
  const wsOp = wb.Sheets['OPERATOR'] || wb.Sheets['Operator'];
  if (!wsOp) throw new Error('Sheet "OPERATOR" not found in CTC Master file.');
  const rowsOp = sheetToRows(wsOp);
  const hOp = rowsOp[0].map(h => String(h || '').trim().toUpperCase());
  const idxCodeO = hOp.indexOf('EMP CODE');
  const idxNameO = hOp.indexOf('EMP NAME');
  const idxDeptO = hOp.indexOf('DEPARTMENT');
  const idxCTCO = hOp.indexOf('DAILY CTC');
  const idxOTO = hOp.indexOf('OT') !== -1 ? hOp.indexOf('OT') : hOp.indexOf('DAILY OT');

  const operator = {};
  for (let i = 1; i < rowsOp.length; i++) {
    const r = rowsOp[i];
    if (!r || !r[idxCodeO]) continue;
    const code = String(r[idxCodeO]).trim().toUpperCase();
    operator[code] = {
      name: String(r[idxNameO] || '').trim(),
      dept: String(r[idxDeptO] || '').trim(),
      direct: String(r[idxDeptO] || '').trim().toUpperCase() === 'PRODUCTION',
      dailyCTC: Number(r[idxCTCO]) || 0,
      dailyOT: Number(r[idxOTO]) || 0
    };
  }

  return { contract, naps, operator };
}
