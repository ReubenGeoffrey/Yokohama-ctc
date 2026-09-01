import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'atc-attendance-storage';
const SUPABASE_CONFIG_KEY = 'atc_supabase_config';

// Retrieve config from localStorage or Vite environment variables
export function getSupabaseConfig() {
  const localConfig = localStorage.getItem(SUPABASE_CONFIG_KEY);
  if (localConfig) {
    try {
      const parsed = JSON.parse(localConfig);
      if (parsed.url && parsed.anonKey) return parsed;
    } catch (e) {}
  }
  return {
    url: import.meta.env.VITE_SUPABASE_URL || 'https://xtpxoccsfxcethstsxns.supabase.co',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0cHhvY2NzZnhjZXRoc3RzeG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3Mzg4MTksImV4cCI6MjEwMzMxNDgxOX0.EZWLmLDzR26qwAbpZxBxl2aUkdoDFvyONyfJXBAPKoE'
  };
}

export function saveSupabaseConfig(url, anonKey) {
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url, anonKey }));
}

export function getSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  try {
    return createClient(url, anonKey);
  } catch (e) {
    console.warn('Invalid Supabase configuration:', e);
    return null;
  }
}

export const SupabaseService = {
  // Test connection
  async testConnection(url, anonKey) {
    try {
      const client = createClient(url, anonKey);
      const { data, error } = await client.storage.listBuckets();
      if (error) throw error;
      return { success: true, buckets: data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Save entire shared workspace state across all laptops & mobile
  async saveCloudSharedState(state) {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase client not initialized' };

    try {
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
        lastSyncedAt: new Date().toISOString()
      };

      const payload = JSON.stringify(safePayload);
      const blob = new Blob([payload], { type: 'application/json' });
      const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .upload('shared_state/live_app_state.json', blob, { upsert: true });

      if (error) {
        console.warn('Supabase storage save error:', error);
        return { success: false, error: error.message || 'Storage error' };
      }
      return { success: true };
    } catch (err) {
      console.warn('Supabase saveCloudSharedState error:', err);
      return { success: false, error: err.message };
    }
  },

  // Load entire shared workspace state uploaded by Sir or another laptop
  async loadCloudSharedState() {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .download('shared_state/live_app_state.json');

      if (error) {
        console.warn('Supabase loadCloudSharedState storage error:', error);
        return null;
      }
      const text = await data.text();
      return JSON.parse(text);
    } catch (err) {
      console.warn('Supabase loadCloudSharedState error:', err);
      return null;
    }
  },

  // Upload Master Roster File to Cloud (Year/Month/master)
  async uploadMasterFile(file, year = 2026, month = 7) {
    const client = getSupabaseClient();
    if (!client) return null;

    const monthStr = String(month + 1).padStart(2, '0');
    const path = `${year}/${monthStr}/master/${file.name}`;

    try {
      const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .upload(path, file, { upsert: true });

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase uploadMasterFile error:', err);
      return null;
    }
  },

  // Upload Attendance File (Year/Month/attendance)
  async uploadAttendanceFile(file, year = 2026, month = 7) {
    const client = getSupabaseClient();
    if (!client) return null;

    const monthStr = String(month + 1).padStart(2, '0');
    const path = `${year}/${monthStr}/attendance/${file.name}`;

    try {
      const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .upload(path, file, { upsert: true });

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase uploadAttendanceFile error:', err);
      return null;
    }
  },

  // Upload Generated Output Workbook (Year/Month/output)
  async uploadOutputWorkbook(buffer, fileName, year = 2026, month = 7) {
    const client = getSupabaseClient();
    if (!client) return null;

    const monthStr = String(month + 1).padStart(2, '0');
    const path = `${year}/${monthStr}/output/${fileName}`;

    try {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .upload(path, blob, { upsert: true });

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase uploadOutputWorkbook error:', err);
      return null;
    }
  },

  // List all files for a specific Year and Month
  async listMonthlyFiles(year, month) {
    const client = getSupabaseClient();
    if (!client) return { master: [], attendance: [], output: [] };

    const monthStr = String(month + 1).padStart(2, '0');
    const basePath = `${year}/${monthStr}`;

    try {
      const { data: masterFiles } = await client.storage.from(BUCKET_NAME).list(`${basePath}/master`);
      const { data: attFiles } = await client.storage.from(BUCKET_NAME).list(`${basePath}/attendance`);
      const { data: outFiles } = await client.storage.from(BUCKET_NAME).list(`${basePath}/output`);

      return {
        master: masterFiles || [],
        attendance: attFiles || [],
        output: outFiles || []
      };
    } catch (err) {
      console.warn('Supabase listMonthlyFiles error:', err);
      return { master: [], attendance: [], output: [] };
    }
  },

  // Save Reconciliation Summary to Database Table
  async saveMonthlySummary(summaryData) {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('reconciliation_history')
        .upsert([
          {
            year: summaryData.year,
            month: summaryData.month,
            total_headcount: summaryData.totalHeadcount,
            daily_ctc: summaryData.totalCTC,
            ot_wages: summaryData.totalOT,
            grand_total: summaryData.grandTotal,
            file_count: summaryData.fileCount,
            updated_at: new Date().toISOString()
          }
        ], { onConflict: 'year,month' });

      if (error) console.warn('Supabase saveMonthlySummary error:', error);
      return data;
    } catch (err) {
      console.warn('Supabase saveMonthlySummary error:', err);
      return null;
    }
  },

  // Fetch Historical Reconciliation Summaries (All Years)
  async getHistoricalSummaries() {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('reconciliation_history')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Supabase getHistoricalSummaries error:', err);
      return [];
    }
  },

  // Download a stored file by path
  async downloadFile(path) {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client.storage.from(BUCKET_NAME).download(path);
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase downloadFile error:', err);
      return null;
    }
  }
};
