import React from 'react';
import { FileSpreadsheet, Calendar, Table2, Download, CheckCircle2 } from 'lucide-react';

export function Stepper({ currentStep, onStepClick, stepsStatus }) {
  const steps = [
    { id: 1, label: 'CTC Master Roster', icon: FileSpreadsheet, sub: 'Load Master Rates' },
    { id: 2, label: 'Attendance Upload', icon: Calendar, sub: 'Daily / Batch Files' },
    { id: 3, label: 'Reconciliation Matrix', icon: Table2, sub: 'Direct vs Indirect' },
    { id: 4, label: 'Executive Export', icon: Download, sub: 'Yellow Excel & ZIP' }
  ];

  return (
    <div className="bg-slate-900/60 border-b border-slate-800/80 backdrop-blur py-4 px-4 sm:px-8 shadow-sm">
      <div className="max-w-5xl mx-auto flex items-center justify-between relative">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isDone = stepsStatus[s.id] === 'done';
          const isActive = currentStep === s.id;
          const isPending = !isDone && !isActive;

          return (
            <React.Fragment key={s.id}>
              {/* Step Node */}
              <button
                onClick={() => onStepClick(s.id)}
                disabled={isPending && s.id > 2}
                className={`flex items-center space-x-3 text-left transition-all ${
                  isActive
                    ? 'scale-105 opacity-100'
                    : isDone
                    ? 'opacity-90 hover:opacity-100 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-md transition-all ${
                    isDone
                      ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                      : isActive
                      ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 ring-4 ring-amber-500/20 shadow-amber-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                </div>
                <div className="hidden md:block">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Step {s.id}
                  </div>
                  <div className={`text-sm font-extrabold ${isActive ? 'text-amber-400' : 'text-slate-200'}`}>
                    {s.label}
                  </div>
                </div>
              </button>

              {/* Connecting Line */}
              {idx < steps.length - 1 && (
                <div className="flex-1 mx-4 h-0.5 bg-slate-800 relative hidden sm:block">
                  <div
                    className={`h-full transition-all duration-500 ${
                      stepsStatus[s.id] === 'done' ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
