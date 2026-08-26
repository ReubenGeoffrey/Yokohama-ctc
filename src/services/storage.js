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
      return (await get(STORAGE_KEYS.BATCH_RESULTS)) || null;
    } catch (e) {
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
  }
};
