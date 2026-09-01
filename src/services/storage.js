import { get, set, del, keys } from 'idb-keyval';

const STORAGE_KEYS = {
  MASTER_DATA: 'atc_master_data',
  MASTER_META: 'atc_master_meta',
  ATTENDANCE_FILES: 'atc_attendance_files',
  BATCH_RESULTS: 'atc_batch_results',
  APP_STATE: 'atc_app_state'
};

export const StorageService = {
  // Save Master Roster to IndexedDB
  async saveMaster(masterData, fileName) {
    try {
      await set(STORAGE_KEYS.MASTER_DATA, masterData);
      await set(STORAGE_KEYS.MASTER_META, {
        fileName,
        savedAt: new Date().toISOString(),
        operatorCount: masterData.operator ? Object.keys(masterData.operator).length : 0,
        contractCount: masterData.contract ? Object.keys(masterData.contract).length : 0,
        napsCount: masterData.naps ? Object.keys(masterData.naps).length : 0
      });
      return true;
    } catch (e) {
      console.warn('IndexedDB saveMaster error:', e);
      return false;
    }
  },

  // Load Master Roster
  async loadMaster() {
    try {
      const data = await get(STORAGE_KEYS.MASTER_DATA);
      const meta = await get(STORAGE_KEYS.MASTER_META);
      return { data, meta };
    } catch (e) {
      console.warn('IndexedDB loadMaster error:', e);
      return { data: null, meta: null };
    }
  },

  // Save Attendance Files
  async saveAttendanceFiles(filesMap) {
    try {
      await set(STORAGE_KEYS.ATTENDANCE_FILES, filesMap);
      return true;
    } catch (e) {
      console.warn('IndexedDB saveAttendance error:', e);
      return false;
    }
  },

  // Load Attendance Files
  async loadAttendanceFiles() {
    try {
      return (await get(STORAGE_KEYS.ATTENDANCE_FILES)) || null;
    } catch (e) {
      console.warn('IndexedDB loadAttendance error:', e);
      return null;
    }
  },

  // Save Batch Results
  async saveBatchResults(results) {
    try {
      await set(STORAGE_KEYS.BATCH_RESULTS, results);
      return true;
    } catch (e) {
      return false;
    }
  },

  // Load Batch Results
  async loadBatchResults() {
    try {
      const data = await get(STORAGE_KEYS.BATCH_RESULTS);
      if (!data) return null;
      if (data.empStats) {
        ['OP', 'CL', 'NAPS'].forEach(cat => {
          if (data.empStats[cat] && !(data.empStats[cat] instanceof Map)) {
            data.empStats[cat] = new Map(Object.entries(data.empStats[cat]));
          }
        });
      }
      if (Array.isArray(data.results)) {
        data.results.forEach(r => {
          if (r.empDayMap && !(r.empDayMap instanceof Map)) {
            r.empDayMap = new Map(Object.entries(r.empDayMap));
          }
        });
      }
      return data;
    } catch (e) {
      console.warn('IndexedDB loadBatchResults error:', e);
      return null;
    }
  },

  // Clear all storage
  async clearAll() {
    try {
      await del(STORAGE_KEYS.MASTER_DATA);
      await del(STORAGE_KEYS.MASTER_META);
      await del(STORAGE_KEYS.ATTENDANCE_FILES);
      await del(STORAGE_KEYS.BATCH_RESULTS);
      return true;
    } catch (e) {
      return false;
    }
  },

  // Export entire workspace to a portable JSON backup file for 1-click sharing across laptops & mobile
  exportWorkspaceBackup(state) {
    const safePayload = {
      master: state.master || null,
      masterMeta: state.masterMeta || null,
      batchDates: state.batchDates || {},
      batchResults: (state.batchResults || []).map(r => ({
        date: r.date,
        buckets: r.buckets,
        dHC: r.dHC, dCTC: r.dCTC, dOT: r.dOT, dTot: r.dTot,
        iHC: r.iHC, iCTC: r.iCTC, iOT: r.iOT, iTot: r.iTot,
        gHC: r.gHC, gCTC: r.gCTC, gOT: r.gOT, gTot: r.gTot,
        empDayMap: r.empDayMap instanceof Map ? Object.fromEntries(r.empDayMap) : (r.empDayMap || {})
      })),
      empStats: state.empStats ? {
        OP: state.empStats.OP instanceof Map ? Object.fromEntries(state.empStats.OP) : (state.empStats.OP || {}),
        CL: state.empStats.CL instanceof Map ? Object.fromEntries(state.empStats.CL) : (state.empStats.CL || {}),
        NAPS: state.empStats.NAPS instanceof Map ? Object.fromEntries(state.empStats.NAPS) : (state.empStats.NAPS || {})
      } : null,
      exportedAt: new Date().toISOString(),
      app: 'Yokohama ATC CTC Hub',
      version: '2.0.0'
    };

    const blob = new Blob([JSON.stringify(safePayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Yokohama_ATC_Workspace_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Parse imported JSON backup
  async parseWorkspaceBackup(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return parsed;
  }
};
