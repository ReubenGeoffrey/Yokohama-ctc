export function emptyBucket() {
  return { headcount: 0, ctc: 0, ot: 0, otHours: 0 };
}

export function reconcileDay(date, dayRecords, master) {
  const buckets = {
    directOperator: emptyBucket(),
    directCL: emptyBucket(),
    directNAPS: emptyBucket(),
    indirectOperator: emptyBucket(),
    indirectCL: emptyBucket(),
    indirectNAPS: emptyBucket()
  };

  const unmatched = [];
  const empDayMap = new Map(); // code -> { workHrs, daysPresent, wopCount, otHrs, otAmount, wages }

  function processCategory(list, map, dKey, iKey, label) {
    if (!list) return;
    list.forEach(rec => {
      const hasOT = (rec.otHours || 0) > 0;
      const isPresent = rec.status === 'P' || rec.status === 'WOP';

      // Keep record if present (P or WOP) OR if employee worked Overtime
      if (!isPresent && !hasOT) return;

      let info = map ? map[rec.code] : null;
      if (!info) {
        // Fallback: Contractor / Category Rate Auto-Inheritance
        const isNAPS = label === 'NAPS' || rec.code.startsWith('LN');
        let defaultCTC = 783.59;
        let defaultOT = 162.61;
        let isDirect = false;
        let dept = rec.dept || 'Production';

        if (isNAPS) {
          // Executive Rule: NAPS new joiners without master sheet get 483 / day
          defaultCTC = 483;
          defaultOT = 0;
          isDirect = true;
          dept = rec.dept || 'Apprentice';
        } else {
          // Contract Labour prefix lookup
          const prefix = rec.code.replace(/[0-9]/g, '').toUpperCase();
          let sample = null;
          if (map) {
            for (const existingCode in map) {
              if (existingCode.startsWith(prefix)) {
                sample = map[existingCode];
                break;
              }
            }
          }
          defaultCTC = sample ? sample.dailyCTC : 783.59;
          defaultOT = sample ? sample.dailyOT : 162.61;
          isDirect = sample ? sample.direct : (label === 'Operator');
          dept = rec.dept || (sample ? sample.dept : 'Production');
        }

        info = {
          name: rec.name || 'New Employee',
          dept,
          direct: isDirect,
          dailyCTC: defaultCTC,
          dailyOT: defaultOT,
          isAutoMapped: true
        };

        unmatched.push({
          code: rec.code,
          name: rec.name || '',
          category: label,
          status: rec.status,
          date,
          autoMappedRate: defaultCTC
        });
      }

      const b = info.direct ? buckets[dKey] : buckets[iKey];
      const otRate = info.dailyOT || 0;
      const dayOtAmt = (rec.otHours || 0) * otRate;

      if (isPresent) {
        b.headcount += 1;
        b.ctc += info.dailyCTC;
      }
      b.ot += dayOtAmt;
      b.otHours = (b.otHours || 0) + (rec.otHours || 0);

      if (!empDayMap.has(rec.code)) {
        empDayMap.set(rec.code, {
          name: info.name || rec.name || rec.code,
          dept: info.dept || 'Production',
          category: label,
          direct: info.direct,
          dailyCTC: info.dailyCTC,
          dailyOT: info.dailyOT,
          workHrs: 0,
          daysPresent: 0,
          wopCount: 0,
          otHrs: 0,
          otAmount: 0,
          wages: 0
        });
      }
      const st = empDayMap.get(rec.code);
      if (rec.status === 'P') {
        st.daysPresent += 1;
      } else if (rec.status === 'WOP' || rec.isWop) {
        st.wopCount += 1;
      }
      st.workHrs += (rec.workHours || 0);
      st.otHrs += (rec.otHours || 0);
      st.otAmount = (st.otAmount || 0) + dayOtAmt;
      const basePay = isPresent ? info.dailyCTC : 0;
      st.wages += basePay + dayOtAmt;
    });
  }

  processCategory(dayRecords.CL, master.contract, 'directCL', 'indirectCL', 'Contract Labour');
  processCategory(dayRecords.OP, master.operator, 'directOperator', 'indirectOperator', 'Operator');
  processCategory(dayRecords.NAPS, master.naps, 'directNAPS', 'indirectNAPS', 'NAPS');

  const dTotOp = buckets.directOperator.ctc + buckets.directOperator.ot;
  const dTotCL = buckets.directCL.ctc + buckets.directCL.ot;
  const dTotNaps = buckets.directNAPS.ctc + buckets.directNAPS.ot;
  const dHC = buckets.directOperator.headcount + buckets.directCL.headcount + buckets.directNAPS.headcount;
  const dCTC = buckets.directOperator.ctc + buckets.directCL.ctc + buckets.directNAPS.ctc;
  const dOT = buckets.directOperator.ot + buckets.directCL.ot + buckets.directNAPS.ot;
  const dOtHrs = (buckets.directOperator.otHours || 0) + (buckets.directCL.otHours || 0) + (buckets.directNAPS.otHours || 0);
  const dTot = dCTC + dOT;

  const iTotOp = buckets.indirectOperator.ctc + buckets.indirectOperator.ot;
  const iTotCL = buckets.indirectCL.ctc + buckets.indirectCL.ot;
  const iTotNaps = buckets.indirectNAPS.ctc + buckets.indirectNAPS.ot;
  const iHC = buckets.indirectOperator.headcount + buckets.indirectCL.headcount + buckets.indirectNAPS.headcount;
  const iCTC = buckets.indirectOperator.ctc + buckets.indirectCL.ctc + buckets.indirectNAPS.ctc;
  const iOT = buckets.indirectOperator.ot + buckets.indirectCL.ot + buckets.indirectNAPS.ot;
  const iOtHrs = (buckets.indirectOperator.otHours || 0) + (buckets.indirectCL.otHours || 0) + (buckets.indirectNAPS.otHours || 0);
  const iTot = iCTC + iOT;

  const gHC = dHC + iHC;
  const gCTC = dCTC + iCTC;
  const gOT = dOT + iOT;
  const gOtHrs = dOtHrs + iOtHrs;
  const gTot = dTot + iTot;

  return {
    date,
    buckets,
    dHC, dCTC, dOT, dOtHrs, dTot,
    iHC, iCTC, iOT, iOtHrs, iTot,
    gHC, gCTC, gOT, gOtHrs, gTot,
    unmatched,
    empDayMap
  };
}

export function aggregateMonthlyStats(batchResults, master) {
  const empStats = {
    OP: new Map(),
    CL: new Map(),
    NAPS: new Map()
  };

  // Initialize for all master employees
  if (master.operator) {
    Object.keys(master.operator).forEach(code => {
      empStats.OP.set(code, { workHrs: 0, daysPresent: 0, wopCount: 0, otHrs: 0, otAmount: 0, wages: 0 });
    });
  }
  if (master.contract) {
    Object.keys(master.contract).forEach(code => {
      empStats.CL.set(code, { workHrs: 0, daysPresent: 0, wopCount: 0, otHrs: 0, otAmount: 0, wages: 0 });
    });
  }
  if (master.naps) {
    Object.keys(master.naps).forEach(code => {
      empStats.NAPS.set(code, { workHrs: 0, daysPresent: 0, wopCount: 0, otHrs: 0, otAmount: 0, wages: 0 });
    });
  }

  // Aggregate across all dates
  batchResults.forEach(r => {
    if (r.empDayMap) {
      const entries = r.empDayMap instanceof Map
        ? Array.from(r.empDayMap.entries())
        : Object.entries(r.empDayMap);

      entries.forEach(([code, st]) => {
        let cat = 'CL';
        if (master?.operator && master.operator[code]) cat = 'OP';
        else if (master?.naps && master.naps[code]) cat = 'NAPS';
        else if (code.startsWith('LN') || st.category === 'NAPS') cat = 'NAPS';
        else if (code.startsWith('9') || st.category === 'Operator' || st.category === 'OP') cat = 'OP';

        const map = empStats[cat];
        if (map) {
          if (!map.has(code)) {
            map.set(code, {
              name: st.name || code,
              dept: st.dept || 'Production',
              dailyCTC: st.dailyCTC || (cat === 'NAPS' ? 483 : 783.59),
              dailyOT: st.dailyOT || (cat === 'NAPS' ? 0 : 162.61),
              workHrs: 0,
              daysPresent: 0,
              wopCount: 0,
              otHrs: 0,
              otAmount: 0,
              wages: 0
            });
          }
          const emp = map.get(code);
          if (st.name && (!emp.name || emp.name === code)) emp.name = st.name;
          if (st.dept && (!emp.dept || emp.dept === 'Production')) emp.dept = st.dept;
          emp.workHrs += (st.workHrs || 0);
          emp.daysPresent += (st.daysPresent || 0);
          emp.wopCount += (st.wopCount || 0);
          emp.otHrs += (st.otHrs || 0);
          emp.otAmount = (emp.otAmount || 0) + (st.otAmount || 0);
          emp.wages += (st.wages || 0);
        }
      });
    }
  });

  return empStats;
}
