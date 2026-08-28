import React from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Calendar, Table2, Download, CheckCircle2 } from 'lucide-react';

export function Stepper({ currentStep, onStepClick, stepsStatus }) {
  const steps = [
    { id: 1, label: 'CTC Master', icon: FileSpreadsheet, tag: '01. Setup' },
    { id: 2, label: 'Attendance', icon: Calendar, tag: '02. Upload' },
    { id: 3, label: 'Reconciliation', icon: Table2, tag: '03. Review' },
    { id: 4, label: 'Export Excel', icon: Download, tag: '04. Download' }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 w-full">
      <div className="bg-white rounded-3xl p-3 shadow-sm border border-slate-200/80 flex items-center justify-between">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isDone = stepsStatus[s.id] === 'done';
          const isActive = currentStep === s.id;
          const isPending = !isDone && !isActive;

          return (
            <React.Fragment key={s.id}>
              <motion.button
                whileHover={{ scale: isPending ? 1 : 1.02 }}
                whileTap={{ scale: isPending ? 1 : 0.98 }}
                onClick={() => onStepClick(s.id)}
                disabled={isPending && s.id > 2}
                className={`flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${
                  isActive
                    ? 'bg-amber-400 text-slate-900 shadow-md shadow-amber-400/25 font-black'
                    : isDone
                    ? 'hover:bg-slate-50 text-slate-800 cursor-pointer font-bold'
                    : 'opacity-40 cursor-not-allowed text-slate-400 font-medium'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                    isActive
                      ? 'bg-slate-900 text-amber-400'
                      : isDone
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                </div>

                <div className="text-left hidden sm:block">
                  <div className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                    {s.tag}
                  </div>
                  <div className={`text-xs font-black ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                    {s.label}
                  </div>
                </div>
              </motion.button>

              {idx < steps.length - 1 && (
                <div className="w-4 sm:w-8 h-0.5 bg-slate-200 rounded-full mx-1 hidden md:block" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
