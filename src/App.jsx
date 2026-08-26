import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Stepper } from './components/Stepper';
import { MasterUpload } from './components/MasterUpload';
import { AttendanceUpload } from './components/AttendanceUpload';
import { ReconciliationMatrix } from './components/ReconciliationMatrix';
import { ExportPanel } from './components/ExportPanel';
import { FileManagerModal } from './components/FileManagerModal';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { YearArchiveModal } from './components/YearArchiveModal';
import { StorageService } from './services/storage';
import { SupabaseService, getSupabaseClient } from './services/supabase';

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

  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isYearArchiveOpen, setIsYearArchiveOpen] = useState(false);
  const [, setForceUpdate] = useState(0);

  // Auto-restore stored data from IndexedDB on startup
  useEffect(() => {
    async function restoreFromStorage() {
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
      }
    }
    restoreFromStorage();
  }, []);

  const handleMasterLoaded = (masterData, meta) => {
    setMaster(masterData);
    setMasterMeta(meta);
    setStepsStatus(prev => ({ ...prev, 1: 'done' }));
  };

  const handleReconciled = async (results, stats) => {
    setBatchResults(results);
    setEmpStats(stats);
    setStepsStatus(prev => ({ ...prev, 2: 'done', 3: 'done', 4: 'done' }));

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
    setMaster(null);
    setMasterMeta(null);
    setBatchDates({});
    setBatchResults([]);
    setEmpStats(null);
    setCurrentStep(1);
    setStepsStatus({ 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending' });
  };

  const storedFilesCount = (master ? 1 : 0) + Object.keys(batchDates).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-400 selection:text-slate-950 flex flex-col">
      {/* Top Navigation */}
      <Header
        masterMeta={masterMeta}
        storedFilesCount={storedFilesCount}
        onOpenFileManager={() => setIsFileManagerOpen(true)}
        onOpenSupabaseConfig={() => setIsSupabaseModalOpen(true)}
        onOpenYearArchive={() => setIsYearArchiveOpen(true)}
        onClearStorage={handleClearStorage}
      />

      {/* Modern Stepper */}
      <Stepper
        currentStep={currentStep}
        onStepClick={(id) => setCurrentStep(id)}
        stepsStatus={stepsStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            setBatchDates={setBatchDates}
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
      </main>

      {/* Stored Files Modal */}
      <FileManagerModal
        isOpen={isFileManagerOpen}
        onClose={() => setIsFileManagerOpen(false)}
        masterMeta={masterMeta}
        batchDates={batchDates}
        onClearStorage={handleClearStorage}
      />

      {/* Supabase Free Cloud DB Modal */}
      <SupabaseConfigModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigSaved={() => setForceUpdate(n => n + 1)}
      />

      {/* Year-by-Year Cloud Archive Modal */}
      <YearArchiveModal
        isOpen={isYearArchiveOpen}
        onClose={() => setIsYearArchiveOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>ATC Tires Executive CTC Attendance Reconciliation Engine • Supabase Cloud & IndexedDB Storage</p>
      </footer>
    </div>
  );
}

export default App;
