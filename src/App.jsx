import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Stepper } from './components/Stepper';
import { MasterUpload } from './components/MasterUpload';
import { AttendanceUpload } from './components/AttendanceUpload';
import { ReconciliationMatrix } from './components/ReconciliationMatrix';
import { ExportPanel } from './components/ExportPanel';
import { FileManagerModal } from './components/FileManagerModal';
import { AuthModal } from './components/AuthModal';
import { StorageService } from './services/storage';
import { SupabaseService, getSupabaseClient } from './services/supabase';
import { AuthService } from './services/auth';
import { ArrowRight, Sparkles, Sun, CheckCircle, FolderUp, Lock, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [stepsStatus, setStepsStatus] = useState({
    1: 'pending',
    2: 'pending',
    3: 'pending',
    4: 'pending'
  });

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
        setMaster(cloudState.master);
        setMasterMeta(cloudState.masterMeta);
        setBatchDates(cloudState.batchDates || {});
        setBatchResults(cloudState.batchResults || []);
        setEmpStats(cloudState.empStats || null);

        // Also cache locally to IndexedDB
        await StorageService.saveMaster(cloudState.master, cloudState.masterMeta?.fileName || 'Master');
        if (cloudState.batchDates) await StorageService.saveAttendanceFiles(cloudState.batchDates);
        if (cloudState.batchResults) await StorageService.saveBatchResults({ results: cloudState.batchResults, empStats: cloudState.empStats });

        const isReconciled = cloudState.batchResults && cloudState.batchResults.length > 0;
        const hasAttendance = cloudState.batchDates && Object.keys(cloudState.batchDates).length > 0;

        setStepsStatus({
          1: 'done',
          2: hasAttendance ? 'done' : 'pending',
          3: isReconciled ? 'done' : 'pending',
          4: isReconciled ? 'done' : 'pending'
        });

        if (isReconciled) {
          setCurrentStep(3);
        } else if (hasAttendance) {
          setCurrentStep(2);
        } else {
          setCurrentStep(2);
        }

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
        setStepsStatus(prev => ({ ...prev, 1: 'done' }));
      }

      const savedAttendance = await StorageService.loadAttendanceFiles();
      if (savedAttendance && Object.keys(savedAttendance).length > 0) {
        setBatchDates(savedAttendance);
        setStepsStatus(prev => ({ ...prev, 2: 'done' }));
      }

      const savedBatch = await StorageService.loadBatchResults();
      if (savedBatch && savedBatch.results && savedBatch.results.length > 0) {
        setBatchResults(savedBatch.results);
        setEmpStats(savedBatch.empStats);
        setStepsStatus(prev => ({ ...prev, 3: 'done', 4: 'done' }));
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
    setStepsStatus(prev => ({ ...prev, 1: 'done' }));

    // Sync to Supabase Cloud so Sir's and other laptops see it immediately
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
    setStepsStatus(prev => ({ ...prev, 2: 'done', 3: 'done', 4: 'done' }));

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
    setCurrentStep(1);
    setStepsStatus({ 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending' });
  };

  // Delete a single date's attendance data
  const handleDeleteDate = async (dateKey) => {
    // Remove from batchDates
    const newBatchDates = { ...batchDates };
    delete newBatchDates[dateKey];

    // Remove from batchResults (match by r.date === dateKey)
    const newBatchResults = batchResults.filter(r => r.date !== dateKey);

    setBatchDates(newBatchDates);
    setBatchResults(newBatchResults);

    // Persist locally
    await StorageService.saveAttendanceFiles(newBatchDates);
    await StorageService.saveBatchResults({ results: newBatchResults, empStats });

    // Sync to cloud
    await SupabaseService.saveCloudSharedState({
      master,
      masterMeta,
      batchDates: newBatchDates,
      batchResults: newBatchResults,
      empStats
    });

    // Update step statuses
    const stillHasAttendance = Object.keys(newBatchDates).length > 0;
    const stillHasResults    = newBatchResults.length > 0;
    setStepsStatus(prev => ({
      ...prev,
      2: stillHasAttendance ? 'done' : 'pending',
      3: stillHasResults    ? 'done' : 'pending',
      4: stillHasResults    ? 'done' : 'pending',
    }));
  };


  const handleOpenStoredFiles = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
    } else {
      setIsFileManagerOpen(true);
    }
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

  const storedFilesCount = (master ? 1 : 0) + Object.keys(batchDates).length;

  return (
    <div className="min-h-screen bg-warm-canvas text-slate-900 font-sans antialiased selection:bg-amber-400 selection:text-slate-950 flex flex-col">
      {/* Top Navigation */}
      <Header
        masterMeta={masterMeta}
        storedFilesCount={storedFilesCount}
        onOpenFileManager={handleOpenStoredFiles}
        onClearStorage={handleClearStorage}
        onRefreshCloudSync={fetchLatestState}
        isSyncing={isSyncing}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Modern Friendly Stepper */}
      <Stepper
        currentStep={currentStep}
        onStepClick={(id) => setCurrentStep(id)}
        stepsStatus={stepsStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Unauthenticated Stored Data Protected Banner */}
        {!currentUser && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-3xl bg-amber-50 border-2 border-amber-300 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
          >
            <div className="flex items-center space-x-3 text-left">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black flex-shrink-0 shadow-md">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-slate-900">
                  Protected Stored Roster & Rates Data
                </div>
                <div className="text-xs text-slate-600 font-medium mt-0.5">
                  Sign in with Executive Passcode (<strong className="text-slate-900">atc2026</strong>) to view active employee rosters and downloaded files.
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="btn-yellow px-6 py-2.5 text-xs flex items-center space-x-1.5 cursor-pointer shadow-md flex-shrink-0"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Unlock Stored Data</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {/* Active Stage View */}
        {currentStep === 1 && (
          <MasterUpload
            master={master}
            masterMeta={masterMeta}
            onMasterLoaded={handleMasterLoaded}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <AttendanceUpload
            master={master}
            batchDates={batchDates}
            setBatchDates={handleAttendanceUpdated}
            onReconciled={handleReconciled}
            onNext={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 3 && (
          <ReconciliationMatrix
            batchResults={batchResults}
            master={master}
            onNext={() => setCurrentStep(4)}
          />
        )}

        {currentStep === 4 && (
          <ExportPanel
            batchResults={batchResults}
            master={master}
            empStats={empStats}
          />
        )}

        {/* PROMINENT SKY BLUE BANNER */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-maya-blue text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8"
          style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
        >
          {/* Left Decorative Paper Tag */}
          <div className="flex items-center space-x-6 w-full lg:w-auto">
            <div className="relative transform -rotate-3 hover:rotate-0 transition duration-300 hidden sm:block flex-shrink-0">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-amber-400 rounded-sm shadow-xs z-10 -rotate-2" style={{ backgroundColor: '#f59e0b' }} />
              <div className="bg-white p-5 rounded-2xl shadow-xl w-48 text-center border border-slate-100" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                <div className="font-handwriting text-2xl font-black text-slate-900 leading-tight" style={{ color: '#0f172a' }}>
                  Let's reconcile something amazing! ☀️
                </div>
                <div className="mt-2 flex justify-center space-x-1 text-amber-500">
                  <span>💛</span>
                  <span>✨</span>
                </div>
              </div>
            </div>

            {/* Main Content with Solid Crisp Text */}
            <div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-700 text-blue-100 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Need Instant Reconciliation?</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight" style={{ color: '#ffffff' }}>
                Have monthly attendance files ready?
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-2 font-medium max-w-xl leading-relaxed" style={{ color: '#dbeafe' }}>
                Drop all daily files at once to generate unified master summary, direct/indirect breakdown, and plant analytics.
              </p>
            </div>
          </div>

          {/* Right Action Button */}
          <div className="flex-shrink-0 w-full sm:w-auto flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setCurrentStep(2)}
              className="btn-yellow px-8 py-4 text-sm font-black flex items-center justify-center space-x-2 cursor-pointer shadow-2xl w-full sm:w-auto"
            >
              <FolderUp className="w-5 h-5" />
              <span>Upload Attendance Files Now</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </motion.div>
      </main>

      {/* Stored Files Modal (Only accessible when logged in) */}
      <FileManagerModal
        isOpen={isFileManagerOpen && !!currentUser}
        onClose={() => setIsFileManagerOpen(false)}
        masterMeta={masterMeta}
        batchDates={batchDates}
        batchResults={batchResults}
        master={master}
        empStats={empStats}
        onClearStorage={handleClearStorage}
        onDeleteDate={handleDeleteDate}
        onRerunReconciliation={() => setCurrentStep(3)}
      />


      {/* Auth Modal (Login / Passcode) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Dark Navy Executive Footer */}
      <footer className="bg-navy-dark text-slate-400 py-12 px-6 mt-12" style={{ backgroundColor: '#0b132b', color: '#94a3b8' }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-4 gap-8 pb-8 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2 text-white font-black text-xl" style={{ color: '#ffffff' }}>
              <span className="h-8 w-8 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-black text-base" style={{ backgroundColor: '#f59e0b', color: '#0f172a' }}>
                ATC
              </span>
              <span>Attendance Hub</span>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium leading-relaxed">
              Automated CTC Cost Mapping & Overtime Analytics for ATC Tires.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 mb-3" style={{ color: '#e2e8f0' }}>
              Workflow Stages
            </h4>
            <ul className="text-xs space-y-2 text-slate-400 font-medium">
              <li>01. Rate Master Configuration</li>
              <li>02. Daily Attendance Upload</li>
              <li>03. Cost Reconciliation Matrix</li>
              <li>04. Monthly Excel Export</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 mb-3" style={{ color: '#e2e8f0' }}>
              Output Specs
            </h4>
            <ul className="text-xs space-y-2 text-slate-400 font-medium">
              <li>Minimalist Yellow Headers (#FFE699)</li>
              <li>Total WOP Shift Tracking</li>
              <li>0 Merged Rows Structure</li>
              <li>IndexedDB & Supabase Cloud Storage</li>
            </ul>
          </div>

          <div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center" style={{ backgroundColor: '#0f172a' }}>
              <div className="text-xs font-black text-amber-400 flex items-center justify-center space-x-1.5" style={{ color: '#fbbf24' }}>
                <Sun className="w-4 h-4" />
                <span>Reconciled with Precision</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Built to streamline plant contractor billing and payroll audits.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium gap-4">
          <p>© 2026 ATC Tires Executive Hub. All rights reserved.</p>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-500 font-bold flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Cloud Sync & Security Active</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
