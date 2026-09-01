export function emptyBucket() {
  return { headcount: 0, ctc: 0, ot: 0 };
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
  const empDayMap = new Map(); // code -> { workHrs, daysPresent, wopCount, otHrs, wages }

  function processCategory(list, map, dKey, iKey, label) {
    if (!list || !map) return;
    list.forEach(rec => {
      // Both P and WOP are considered present at work
      if (rec.status !== 'P' && rec.status !== 'WOP') return;

      const info = map[rec.code];
      if (!info) {
        unmatched.push({
          code: rec.code,
          name: rec.name || '',
          category: label,
          status: rec.status,
          date
        });
        return;
      }

      const b = info.direct ? buckets[dKey] : buckets[iKey];
      const otRate = info.dailyOT || 0;
      const dayOtAmt = (rec.otHours || 0) * otRate;
      b.headcount += 1;
      b.ctc += info.dailyCTC;
      b.ot += dayOtAmt;

      if (!empDayMap.has(rec.code)) {
        empDayMap.set(rec.code, {
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
      st.wages += info.dailyCTC + dayOtAmt;
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
  const dTot = dCTC + dOT;

  const iTotOp = buckets.indirectOperator.ctc + buckets.indirectOperator.ot;
  const iTotCL = buckets.indirectCL.ctc + buckets.indirectCL.ot;
  const iTotNaps = buckets.indirectNAPS.ctc + buckets.indirectNAPS.ot;
  const iHC = buckets.indirectOperator.headcount + buckets.indirectCL.headcount + buckets.indirectNAPS.headcount;
  const iCTC = buckets.indirectOperator.ctc + buckets.indirectCL.ctc + buckets.indirectNAPS.ctc;
  const iOT = buckets.indirectOperator.ot + buckets.indirectCL.ot + buckets.indirectNAPS.ot;
  const iTot = iCTC + iOT;

  const gHC = dHC + iHC;
  const gCTC = dCTC + iCTC;
  const gOT = dOT + iOT;
  const gTot = dTot + iTot;

  return {
    date,
    buckets,
    dHC, dCTC, dOT, dTot,
    iHC, iCTC, iOT, iTot,
    gHC, gCTC, gOT, gTot,
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
      r.empDayMap.forEach((st, code) => {
        let cat = 'CL';
        if (master.operator && master.operator[code]) cat = 'OP';
        else if (master.naps && master.naps[code]) cat = 'NAPS';

        const map = empStats[cat];
        if (map) {
          if (!map.has(code)) {
            map.set(code, { workHrs: 0, daysPresent: 0, wopCount: 0, otHrs: 0, otAmount: 0, wages: 0 });
          }
          const emp = map.get(code);
          emp.workHrs += st.workHrs;
          emp.daysPresent += st.daysPresent;
          emp.wopCount += st.wopCount;
          emp.otHrs += st.otHrs;
          emp.otAmount = (emp.otAmount || 0) + (st.otAmount || 0);
          emp.wages += st.wages;
        }
      });
    }
  });

  return empStats;
}
