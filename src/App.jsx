import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { MasterUpload } from './components/MasterUpload';
import { AttendanceUpload } from './components/AttendanceUpload';
import { ReconciliationMatrix } from './components/ReconciliationMatrix';
import { ExportPanel } from './components/ExportPanel';
import { FileManagerModal } from './components/FileManagerModal';
import { AuthModal } from './components/AuthModal';
import { StorageService } from './services/storage';
import { SupabaseService, getSupabaseClient } from './services/supabase';
import { AuthService } from './services/auth';
import { generateMonthlyWorkbook, downloadBlob } from './services/excelEngine';
import { reconcileDay, aggregateMonthlyStats } from './services/reconciliation';
import { YokohamaLogo } from './components/YokohamaLogo';
import {
  Menu,
  HardDrive,
  Calendar,
  Cloud,
  Lock,
  ShieldCheck,
  Building2,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function App() {
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'master' | 'attendance' | 'reconciliation' | 'export'
  const [dashboardTab, setDashboardTab] = useState('overview'); // 'overview' | 'wop'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Today's Date automatically updating daily (e.g. 31-Aug-2026)
  const todayDateStr = useMemo(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = today.toLocaleString('en-US', { month: 'short' });
    const year = today.getFullYear();
    return `${day}-${month}-${year}`;
  }, []);

  const [master, setMaster] = useState(null);
  const [masterMeta, setMasterMeta] = useState(null);
  const [batchDates, setBatchDates] = useState({});
  const [batchResults, setBatchResults] = useState([]);
  const [empStats, setEmpStats] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);

  // Initialize Auth
  useEffect(() => {
    const user = AuthService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  // Restore state: Check Cloud first (for multi-laptop sync), fallback to IndexedDB
  const fetchLatestState = async () => {
    setIsSyncing(true);
    try {
      // 1. Try fetching shared state from Supabase Cloud
      const cloudState = await SupabaseService.loadCloudSharedState();
      if (cloudState && cloudState.master) {
        const safeEmpStats = {
          OP: cloudState.empStats?.OP instanceof Map ? cloudState.empStats.OP : new Map(Object.entries(cloudState.empStats?.OP || {})),
          CL: cloudState.empStats?.CL instanceof Map ? cloudState.empStats.CL : new Map(Object.entries(cloudState.empStats?.CL || {})),
          NAPS: cloudState.empStats?.NAPS instanceof Map ? cloudState.empStats.NAPS : new Map(Object.entries(cloudState.empStats?.NAPS || {}))
        };

        let finalResults = (cloudState.batchResults || []).map(r => {
          if (r.empDayMap && !(r.empDayMap instanceof Map)) {
            return { ...r, empDayMap: new Map(Object.entries(r.empDayMap)) };
          }
          return r;
        });

        let finalStats = safeEmpStats;
        const bKeys = Object.keys(cloudState.batchDates || {});
        // If batchDates exist but calculations are empty or lost during JSON sync, auto re-reconcile!
        if (bKeys.length > 0 && (finalResults.length === 0 || (finalStats.CL.size === 0 && finalStats.OP.size === 0))) {
          finalResults = [];
          bKeys.sort().forEach(dKey => {
            const dObj = cloudState.batchDates[dKey];
            if (dObj) {
              const res = reconcileDay(dObj.date, dObj, cloudState.master);
              finalResults.push(res);
            }
          });
          finalStats = aggregateMonthlyStats(finalResults, cloudState.master);
        }

        setMaster(cloudState.master);
        setMasterMeta(cloudState.masterMeta);
        setBatchDates(cloudState.batchDates || {});
        setBatchResults(finalResults);
        setEmpStats(finalStats);

        // Also cache locally to IndexedDB
        await StorageService.saveMaster(cloudState.master, cloudState.masterMeta?.fileName || 'Master');
        if (cloudState.batchDates) await StorageService.saveAttendanceFiles(cloudState.batchDates);
        await StorageService.saveBatchResults({ results: finalResults, empStats: finalStats });

        setIsSyncing(false);
        return;
      }
    } catch (err) {
      console.warn('Could not restore from Supabase Cloud:', err);
    }

    // 2. Fallback to local IndexedDB
    try {
      const { data: savedMaster, meta: savedMeta } = await StorageService.loadMaster();
      if (savedMaster) {
        setMaster(savedMaster);
        setMasterMeta(savedMeta);
      }

      const savedAttendance = await StorageService.loadAttendanceFiles();
      if (savedAttendance && Object.keys(savedAttendance).length > 0) {
        setBatchDates(savedAttendance);
      }

      const savedBatch = await StorageService.loadBatchResults();
      if (savedBatch && savedBatch.results && savedBatch.results.length > 0) {
        setBatchResults(savedBatch.results);
        setEmpStats(savedBatch.empStats);
      } else if (savedMaster && savedAttendance && Object.keys(savedAttendance).length > 0) {
        // Auto re-reconcile if batchResults was empty in IndexedDB
        const autoResults = [];
        Object.keys(savedAttendance).sort().forEach(dKey => {
          const dObj = savedAttendance[dKey];
          if (dObj) {
            const res = reconcileDay(dObj.date, dObj, savedMaster);
            autoResults.push(res);
          }
        });
        const autoStats = aggregateMonthlyStats(autoResults, savedMaster);
        setBatchResults(autoResults);
        setEmpStats(autoStats);
        await StorageService.saveBatchResults({ results: autoResults, empStats: autoStats });
      }
    } catch (err) {
      console.warn('Could not restore from IndexedDB:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchLatestState();
  }, []);

  const handleMasterLoaded = async (masterData, meta) => {
    setMaster(masterData);
    setMasterMeta(meta);

    // Sync to Supabase Cloud
    await SupabaseService.saveCloudSharedState({
      master: masterData,
      masterMeta: meta,
      batchDates,
      batchResults,
      empStats
    });
  };

  const handleAttendanceUpdated = async (newBatchDates) => {
    setBatchDates(newBatchDates);
    // Sync to Supabase Cloud
    await SupabaseService.saveCloudSharedState({
      master,
      masterMeta,
      batchDates: newBatchDates,
      batchResults,
      empStats
    });
  };

  const handleReconciled = async (results, stats) => {
    setBatchResults(results);
    setEmpStats(stats);
    setActiveView('dashboard');

    // Sync to Supabase Cloud
    await SupabaseService.saveCloudSharedState({
      master,
      masterMeta,
      batchDates,
      batchResults: results,
      empStats: stats
    });

    // If Supabase is connected, save monthly summary to database
    if (getSupabaseClient() && results.length > 0) {
      const d = new Date(results[0].date);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const totHC = results.reduce((s, r) => s + r.gHC, 0);
      const totCTC = results.reduce((s, r) => s + r.gCTC, 0);
      const totOT = results.reduce((s, r) => s + r.gOT, 0);
      const grandTotal = totCTC + totOT;

      await SupabaseService.saveMonthlySummary({
        year,
        month,
        totalHeadcount: totHC,
        totalCTC: totCTC,
        totalOT: totOT,
        grandTotal,
        fileCount: Object.keys(batchDates).length
      });
    }
  };

  const handleClearStorage = async () => {
    await StorageService.clearAll();
    await SupabaseService.saveCloudSharedState({
      master: null,
      masterMeta: null,
      batchDates: {},
      batchResults: [],
      empStats: null
    });
    setMaster(null);
    setMasterMeta(null);
    setBatchDates({});
    setBatchResults([]);
    setEmpStats(null);
    setActiveView('dashboard');
  };

  // Helper to normalize any date string or Date object to YYYY-MM-DD
  const normalizeDateKey = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val).trim();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Delete a single date's attendance data
  const handleDeleteDate = async (targetDate) => {
    const targetIso = normalizeDateKey(targetDate);

    // 1. Remove from batchDates
    const newBatchDates = {};
    Object.keys(batchDates || {}).forEach(k => {
      const item = batchDates[k];
      const itemIso = normalizeDateKey(item?.date || k);
      if (itemIso !== targetIso && k !== targetDate) {
        newBatchDates[k] = item;
      }
    });

    // 2. Remove from batchResults
    const newBatchResults = (batchResults || []).filter(r => {
      const rIso = normalizeDateKey(r?.date);
      return rIso !== targetIso && r?.date !== targetDate;
    });

    setBatchDates(newBatchDates);
    setBatchResults(newBatchResults);

    // 3. Persist locally to IndexedDB
    await StorageService.saveAttendanceFiles(newBatchDates);
    await StorageService.saveBatchResults({ results: newBatchResults, empStats });

    // 4. Sync to Supabase Cloud
    await SupabaseService.saveCloudSharedState({
      master,
      masterMeta,
      batchDates: newBatchDates,
      batchResults: newBatchResults,
      empStats
    });
  };

  const handleOpenStoredFiles = () => {
    setIsFileManagerOpen(true);
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setIsFileManagerOpen(true);
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setCurrentUser(null);
    setIsFileManagerOpen(false);
  };

  // 1-Click Export entire workspace file (.json) for sharing across laptops & mobile
  const handleExportWorkspace = () => {
    StorageService.exportWorkspaceBackup({
      master,
      masterMeta,
      batchDates,
      batchResults,
      empStats
    });
  };

  // 1-Click Import workspace file (.json) on Sir's Laptop or Mobile
  const handleImportWorkspace = async (file) => {
    try {
      const data = await StorageService.parseWorkspaceBackup(file);
      if (!data) return;

      const newMaster = data.master || null;
      const newMasterMeta = data.masterMeta || null;
      const newBatchDates = data.batchDates || {};

      let newResults = [];
      let newStats = null;

      if (newMaster && Object.keys(newBatchDates).length > 0) {
        Object.keys(newBatchDates).sort().forEach(dKey => {
          const dObj = newBatchDates[dKey];
          if (dObj) {
            const res = reconcileDay(dObj.date, dObj, newMaster);
            newResults.push(res);
          }
        });
        newStats = aggregateMonthlyStats(newResults, newMaster);
      }

      setMaster(newMaster);
      setMasterMeta(newMasterMeta);
      setBatchDates(newBatchDates);
      setBatchResults(newResults);
      setEmpStats(newStats);

      // Save locally to IndexedDB
      if (newMaster) await StorageService.saveMaster(newMaster, newMasterMeta?.fileName || 'Imported Master');
      if (newBatchDates) await StorageService.saveAttendanceFiles(newBatchDates);
      if (newResults.length > 0) await StorageService.saveBatchResults({ results: newResults, empStats: newStats });

      // Also push to Supabase Cloud
      await SupabaseService.saveCloudSharedState({
        master: newMaster,
        masterMeta: newMasterMeta,
        batchDates: newBatchDates,
        batchResults: newResults,
        empStats: newStats
      });

      alert('Workspace imported successfully.');
    } catch (err) {
      console.error('Import error:', err);
      alert('Error importing workspace file: ' + err.message);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    const saveRes = await SupabaseService.saveCloudSharedState({
      master,
      masterMeta,
      batchDates,
      batchResults,
      empStats
    });

    if (saveRes && saveRes.success) {
      alert('Cloud Sync Successful');
    } else {
      alert('Cloud Sync: ' + (saveRes?.error || 'Unable to sync to cloud'));
    }
    setIsSyncing(false);
  };

  // Instant Monthly Consolidated Master Export
  const handleExportMonthlyConsolidated = async () => {
    if (!batchResults.length) {
      alert('Please upload daily attendance files and run reconciliation first.');
      return;
    }
    try {
      const d = new Date(batchResults[0].date);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const monthName = MONTH_NAMES[month] || 'Month';
      const buffer = await generateMonthlyWorkbook(batchResults, master, empStats, year, month);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `CTC_Consolidated_Master_${monthName}_${year}.xlsx`);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  const batchDatesCount = Object.keys(batchDates || {}).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased flex">
      {/* ── Left Sidebar Navigation (Reference UI) ── */}
      <Sidebar
        activeView={dashboardTab === 'wop' && activeView === 'dashboard' ? 'wop' : activeView}
        onSelectView={(v) => {
          if (v === 'wop') {
            setActiveView('dashboard');
            setDashboardTab('wop');
          } else if (v === 'dashboard' || v === 'overview') {
            setActiveView('dashboard');
            setDashboardTab('overview');
          } else {
            setActiveView(v);
          }
        }}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenVault={handleOpenStoredFiles}
        masterMeta={masterMeta}
        batchDatesCount={batchDatesCount}
        isSyncing={isSyncing}
      />

      {/* ── Main Content Area with Desktop Sidebar Offset ── */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Sticky Bar for Mobile Header & Global Actions */}
        <header className="h-16 px-4 sm:px-8 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl lg:hidden cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo in Tab Section */}
            <div className="flex items-center space-x-2.5">
              <YokohamaLogo className="h-5 w-auto hidden sm:inline-block" />
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-500 capitalize">
                  {activeView}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Today's Date / Vault Quick Button (Automatically changes daily) */}
            <button
              onClick={handleOpenStoredFiles}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              title="Today's Date • Click to open Attendance Vault"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-500 font-medium hidden sm:inline">Today:</span>
              <span className="font-black text-slate-900">{todayDateStr}</span>
            </button>

            {/* Cloud Sync Indicator */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-slate-50 border border-slate-200 transition cursor-pointer"
              title="Click to Sync with Cloud / Test Supabase Multi-Device Connection"
            >
              <Cloud className={`w-4 h-4 ${isSyncing ? 'text-blue-600 animate-spin' : 'text-emerald-500'}`} />
            </button>
          </div>
        </header>

        {/* View Content Body */}
        <main className="flex-1 p-4 sm:p-7 max-w-7xl w-full mx-auto">
          {/* Unauthenticated Security Warning Banner */}
          {!currentUser && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2.5">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-amber-950 font-medium">
                  Executive Protection: Stored master rates &amp; rosters are view-locked. Use PIN (<strong className="font-bold">atc2026</strong>) to edit.
                </span>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-lg transition shrink-0 cursor-pointer shadow-xs"
              >
                Enter PIN
              </button>
            </div>
          )}

          {/* Active View Routing */}
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <DashboardOverview
                  master={master}
                  masterMeta={masterMeta}
                  batchDates={batchDates}
                  batchResults={batchResults}
                  empStats={empStats}
                  onOpenVault={handleOpenStoredFiles}
                  onExportMonthly={handleExportMonthlyConsolidated}
                  onNavigateToModule={(v) => setActiveView(v)}
                  initialTab={dashboardTab}
                  onTabChange={setDashboardTab}
                />
              </motion.div>
            )}

            {activeView === 'master' && (
              <motion.div
                key="master"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Employee Rate Master</h2>
                    <p className="text-xs text-slate-500">Employee standard wage and CTC rate database.</p>
                  </div>
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className="px-3.5 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Back to Dashboard
                  </button>
                </div>
                <MasterUpload
                  master={master}
                  masterMeta={masterMeta}
                  onMasterLoaded={handleMasterLoaded}
                  onNext={() => setActiveView('attendance')}
                />
              </motion.div>
            )}

            {activeView === 'attendance' && (
              <motion.div
                key="attendance"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Daily Attendance Sheets</h2>
                    <p className="text-xs text-slate-500">Upload or import daily plant attendance files.</p>
                  </div>
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className="px-3.5 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Back to Dashboard
                  </button>
                </div>
                <AttendanceUpload
                  master={master}
                  batchDates={batchDates}
                  setBatchDates={handleAttendanceUpdated}
                  onReconciled={handleReconciled}
                  onNext={() => setActiveView('reconciliation')}
                />
              </motion.div>
            )}

            {activeView === 'reconciliation' && (
              <motion.div
                key="reconciliation"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Daily Cost Summary</h2>
                    <p className="text-xs text-slate-500">Worker man-days, standard working wages, and overtime compensation.</p>
                  </div>
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className="px-3.5 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Back to Dashboard
                  </button>
                </div>
                <ReconciliationMatrix
                  batchResults={batchResults}
                  master={master}
                  onNext={() => setActiveView('export')}
                />
              </motion.div>
            )}

            {activeView === 'export' && (
              <motion.div
                key="export"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Report Center</h2>
                    <p className="text-xs text-slate-500">Download Monthly Master Excel and Daily ZIP Archives.</p>
                  </div>
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className="px-3.5 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Back to Dashboard
                  </button>
                </div>
                <ExportPanel
                  batchResults={batchResults}
                  master={master}
                  empStats={empStats}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* ── MODALS ── */}
      <FileManagerModal
        isOpen={isFileManagerOpen}
        onClose={() => setIsFileManagerOpen(false)}
        masterMeta={masterMeta}
        batchDates={batchDates}
        batchResults={batchResults}
        master={master}
        empStats={empStats}
        onClearStorage={handleClearStorage}
        onRerunReconciliation={() => setActiveView('reconciliation')}
        onDeleteDate={handleDeleteDate}
        onExportWorkspace={handleExportWorkspace}
        onImportWorkspace={handleImportWorkspace}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

export default App;
