import * as XLSX from 'xlsx';

const MONTH_MAP = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  SEPT: 8, SEPTEMBER: 8, AUGUST: 7, OCTO: 9, NOVE: 10, DECE: 11
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
  // 1. Check rows in sheet
  if (Array.isArray(rows)) {
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const r = rows[i];
      if (!r) continue;
      for (let c = 0; c < Math.min(r.length, 8); c++) {
        const val = r[c];
        if (!val) continue;

        // Check if already a JS Date object from XLSX
        if (val instanceof Date && !isNaN(val.getTime())) {
          const yr = val.getUTCFullYear();
          if (yr >= 2020 && yr <= 2035) {
            const rStr = r.map(x => String(x || '')).join(' ').toUpperCase();
            if (!rStr.includes('PRINTED ON') && !rStr.includes('PRINTED AT')) {
              return new Date(Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate()));
            }
          }
        }

        const cellStr = String(val).trim();
        if (cellStr.toUpperCase().includes('PRINTED ON') || cellStr.toUpperCase().includes('PRINTED AT')) {
          continue;
        }

        // 'as of 01st Sep 2026' or 'as of 1 Sep 2026' or 'as of 01-Sep-2026'
        const mAsOf = cellStr.match(/as of\s+(\d{1,2})\w{0,2}\s+([A-Za-z]{3,})\s+(\d{2,4})/i);
        if (mAsOf) {
          const day = parseInt(mAsOf[1], 10);
          const monStr = mAsOf[2].slice(0, 3).toUpperCase();
          const yr = mAsOf[3].length === 2 ? 2000 + parseInt(mAsOf[3], 10) : parseInt(mAsOf[3], 10);
          if (MONTH_MAP[monStr] !== undefined && day >= 1 && day <= 31) {
            return new Date(Date.UTC(yr, MONTH_MAP[monStr], day));
          }
        }

        const mText = cellStr.match(/(\d{1,2})\w{0,2}[-\s/.]+([A-Za-z]{3,})[-\s/.]+(\d{2,4})/);
        if (mText) {
          const day = parseInt(mText[1], 10);
          const monStr = mText[2].slice(0, 3).toUpperCase();
          const yr = mText[3].length === 2 ? 2000 + parseInt(mText[3], 10) : parseInt(mText[3], 10);
          if (MONTH_MAP[monStr] !== undefined && day >= 1 && day <= 31) {
            return new Date(Date.UTC(yr, MONTH_MAP[monStr], day));
          }
        }

        const mNum = cellStr.match(/(\d{1,2})[-\s/.](\d{1,2})[-\s/.](\d{2,4})/);
        if (mNum) {
          const day = parseInt(mNum[1], 10);
          const mon = parseInt(mNum[2], 10) - 1;
          const yr = mNum[3].length === 2 ? 2000 + parseInt(mNum[3], 10) : parseInt(mNum[3], 10);
          if (mon >= 0 && mon <= 11 && day >= 1 && day <= 31) {
            return new Date(Date.UTC(yr, mon, day));
          }
        }
      }
    }
  }

  // 2. Check filename (strip folder path e.g. 'September/01-09-2026 CL.xlsx')
  const fn = String(filename || '');
  const base = fn.split(/[/\\]/).pop();

  // Text month: 01-Sep-2026, 01-Sept-2026, 01 September 2026, 01_Sep_26
  const mTextFn = base.match(/(\d{1,2})\s*[-_/\.\s]\s*([A-Za-z]{3,})\s*[-_/\.\s]?\s*(\d{2,4})?/i);
  if (mTextFn) {
    const day = parseInt(mTextFn[1], 10);
    const monStr = mTextFn[2].slice(0, 3).toUpperCase();
    const yr = mTextFn[3] ? (mTextFn[3].length === 2 ? 2000 + parseInt(mTextFn[3], 10) : parseInt(mTextFn[3], 10)) : 2026;
    if (MONTH_MAP[monStr] !== undefined && day >= 1 && day <= 31) {
      return new Date(Date.UTC(yr, MONTH_MAP[monStr], day));
    }
  }

  // Month first: Sep-01-2026, September 01
  const mMonFirst = base.match(/([A-Za-z]{3,})\s*[-_/\.\s]\s*(\d{1,2})\s*[-_/\.\s]?\s*(\d{2,4})?/i);
  if (mMonFirst) {
    const monStr = mMonFirst[1].slice(0, 3).toUpperCase();
    const day = parseInt(mMonFirst[2], 10);
    const yr = mMonFirst[3] ? (mMonFirst[3].length === 2 ? 2000 + parseInt(mMonFirst[3], 10) : parseInt(mMonFirst[3], 10)) : 2026;
    if (MONTH_MAP[monStr] !== undefined && day >= 1 && day <= 31) {
      return new Date(Date.UTC(yr, MONTH_MAP[monStr], day));
    }
  }

  // Numeric: 01-09-2026, 01.09.2026, 01_09_2026, 01-09-26
  const mNumFn = base.match(/(\d{1,2})\s*[-_/\.]\s*(\d{1,2})\s*[-_/\.]\s*(\d{2,4})/);
  if (mNumFn) {
    const day = parseInt(mNumFn[1], 10);
    const mon = parseInt(mNumFn[2], 10) - 1;
    const yr = mNumFn[3].length === 2 ? 2000 + parseInt(mNumFn[3], 10) : parseInt(mNumFn[3], 10);
    if (mon >= 0 && mon <= 11 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(yr, mon, day));
    }
  }

  // ISO: 2026-09-01
  const mIso = base.match(/(\d{4})[-\s/.](\d{1,2})[-\s/.](\d{1,2})/);
  if (mIso) {
    return new Date(Date.UTC(parseInt(mIso[1], 10), parseInt(mIso[2], 10) - 1, parseInt(mIso[3], 10)));
  }

  // Date 01 / Date 1
  const mDateOnly = base.match(/Date\s*[-_]?\s*(\d{1,2})/i);
  if (mDateOnly) {
    const upperFull = fn.toUpperCase();
    for (const [k, v] of Object.entries(MONTH_MAP)) {
      if (upperFull.includes(k)) {
        return new Date(Date.UTC(2026, v, parseInt(mDateOnly[1], 10)));
      }
    }
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), parseInt(mDateOnly[1], 10)));
  }

  return null;
}

export function detectCategory(arg1, arg2, arg3) {
  let filename = '';
  let rows = [];
  let hIdx = -1;

  if (typeof arg1 === 'string') {
    filename = arg1;
    if (Array.isArray(arg2)) rows = arg2;
    if (typeof arg3 === 'number') hIdx = arg3;
  } else if (Array.isArray(arg1)) {
    rows = arg1;
    if (typeof arg2 === 'number') hIdx = arg2;
    if (typeof arg3 === 'string') filename = arg3;
    else if (typeof arg2 === 'string') filename = arg2;
  } else if (typeof arg3 === 'string') {
    filename = arg3;
  }

  const fn = String(filename || '').toUpperCase();

  // 1. Precise Filename Checks
  if (fn.includes('OPERATOR') || fn.includes(' OP ') || fn.startsWith('OP ') || fn.includes('_OP_') || fn.includes('-OP-') || fn.includes('OP PRESENT') || fn.endsWith('OP.XLSX')) {
    return 'OP';
  }
  if (fn.includes('NAPS') || fn.includes('APPRENTICE')) {
    return 'NAPS';
  }
  if (fn.includes('CONTRACT') || fn.includes('CL ') || fn.startsWith('CL') || fn.includes('_CL_') || fn.includes('-CL-') || fn.includes('CL PRESENT') || fn.endsWith('CL.XLSX')) {
    return 'CL';
  }

  // 2. Check header rows in file
  if (Array.isArray(rows)) {
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const row = rows[i];
      if (!row) continue;
      for (let c = 0; c < Math.min(row.length, 8); c++) {
        const cell = String(row[c] || '').toUpperCase();
        if (cell.includes('CATEGORY :') || cell.includes('CATEGORY:')) {
          if (cell.includes('OPERATOR')) return 'OP';
          if (cell.includes('NAPS') || cell.includes('APPRENTICE')) return 'NAPS';
          if (cell.includes('CONTRACT') || cell.includes('CL')) return 'CL';
        }
      }
    }

    // 3. Check employee code patterns
    const headerRow = (hIdx >= 0 && rows[hIdx]) ? rows[hIdx] : (rows.find(r => Array.isArray(r) && r.some(c => String(c).trim().toUpperCase() === 'CODE')) || []);
    const cIdx = headerRow.findIndex(h => String(h || '').trim().toUpperCase() === 'CODE');
    if (cIdx !== -1) {
      const startR = hIdx >= 0 ? hIdx + 1 : 1;
      for (let r = startR; r < Math.min(rows.length, startR + 15); r++) {
        if (rows[r] && rows[r][cIdx]) {
          const sample = String(rows[r][cIdx]).trim().toUpperCase();
          if (sample.startsWith('9')) return 'OP';
          if (sample.startsWith('LN')) return 'NAPS';
          if (sample.length >= 4) return 'CL';
        }
      }
    }
  }

  // 4. Fallback checks
  if (fn.includes('OP')) return 'OP';
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
