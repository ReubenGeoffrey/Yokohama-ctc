import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  FolderUp,
  TableProperties,
  Download,
  Calendar,
  Cloud,
  Lock,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Menu,
  X,
  Sparkles
} from 'lucide-react';
import { YokohamaLogo } from './YokohamaLogo';

export function Sidebar({
  activeView,
  onSelectView,
  isOpen,
  onToggle,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenVault,
  masterMeta,
  batchDatesCount = 0,
  isSyncing = false
}) {
  const homeNav = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'wop',
      label: 'WOP Statistics',
      subtitle: 'Operator, CL & NAPS',
      icon: Sparkles,
      badge: null
    }
  ];

  const moduleNav = [
    {
      id: 'master',
      label: 'Employee Rate Master',
      subtitle: 'Wage & Rate Master',
      icon: FileSpreadsheet,
      badge: masterMeta ? 'Loaded' : null,
      badgeColor: 'bg-emerald-100 text-emerald-800'
    },
    {
      id: 'attendance',
      label: 'Daily Attendance',
      subtitle: 'Plant Attendance Sheets',
      icon: FolderUp,
      badge: batchDatesCount > 0 ? `${batchDatesCount} Dates` : null,
      badgeColor: 'bg-blue-100 text-blue-800'
    },
    {
      id: 'reconciliation',
      label: 'Cost Summary',
      subtitle: 'Daily Wages & Headcount',
      icon: TableProperties,
      badge: null
    },
    {
      id: 'export',
      label: 'Report Center',
      subtitle: 'Monthly Excel & ZIP',
      icon: Download,
      badge: null
    },
    {
      id: 'vault',
      label: 'Attendance Vault',
      subtitle: 'Month & Year Records',
      icon: Calendar,
      badge: null,
      action: onOpenVault
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <YokohamaLogo className="w-8 h-8 rounded-xl" />
            <div>
              <div className="text-sm font-black tracking-tight text-slate-950 flex items-center space-x-1">
                <span>YOKOHAMA</span>
                <span className="text-amber-600">CTC</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Plant Operations
              </p>
            </div>
          </div>

          <button
            onClick={onToggle}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 lg:hidden cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {/* HOME Section */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              HOME
            </div>
            <div className="space-y-1">
              {homeNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectView(item.id);
                      if (window.innerWidth < 1024) onToggle();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-black shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon
                        className={`w-4 h-4 ${
                          isActive ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MODULES Section */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              OPERATIONS &amp; MODULES
            </div>
            <div className="space-y-1">
              {moduleNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.action) {
                        item.action();
                      } else {
                        onSelectView(item.id);
                      }
                      if (window.innerWidth < 1024) onToggle();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition cursor-pointer text-left ${
                      isActive
                        ? 'bg-amber-50/80 text-amber-950 font-black shadow-2xs border border-amber-200/60'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-amber-600' : 'text-slate-400'
                        }`}
                      />
                      <div className="truncate">
                        <div className="font-bold text-xs truncate">{item.label}</div>
                      </div>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ml-1.5 ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* User Profile & Auth Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60">
          {currentUser ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 text-xs font-black">
                  ATC
                </div>
                <div className="truncate">
                  <div className="text-xs font-black text-slate-900 truncate">
                    {currentUser.username || 'Administrator'}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold flex items-center space-x-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>PIN Verified</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-black transition flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Executive Sign In</span>
            </button>
          )}

          {/* Cloud Sync indicator */}
          <div className="mt-2 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[10px] text-slate-400 font-medium px-1">
            <span className="flex items-center space-x-1">
              <Cloud className={`w-3 h-3 ${isSyncing ? 'text-blue-500 animate-spin' : 'text-emerald-500'}`} />
              <span>{isSyncing ? 'Syncing...' : 'Multi-Laptop Cloud Sync'}</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
