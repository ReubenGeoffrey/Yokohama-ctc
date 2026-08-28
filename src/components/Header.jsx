import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Vault, RefreshCw, LogOut, UserCheck,
  ShieldCheck, Zap, Sun, ChevronDown
} from 'lucide-react';

export function Header({
  masterMeta,
  storedFilesCount,
  onOpenFileManager,
  onClearStorage,
  onRefreshCloudSync,
  isSyncing,
  currentUser,
  onOpenAuthModal,
  onLogout
}) {
  return (
    <header className="header-root sticky top-0 z-40">
      {/* ── Announcement ticker bar ───────────────────────── */}
      <div className="ticker-bar">
        <div className="ticker-inner">
          <span className="ticker-dot" />
          <span>Automated CTC Cost Mapping &amp; Overtime Analytics</span>
          <span className="ticker-divider">·</span>
          <span>August 2026 Batch</span>
          <span className="ticker-divider">·</span>

          <button
            onClick={onRefreshCloudSync}
            disabled={isSyncing}
            className="sync-pill cursor-pointer"
            title="Fetch latest from other laptops"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing…' : '⚡ Live Cloud Sync'}</span>
          </button>
        </div>
      </div>

      {/* ── Main Navbar ──────────────────────────────────── */}
      <nav className="navbar-root">
        <div className="navbar-inner">

          {/* ── Brand ─────────────────────────── */}
          <div className="brand">
            <div className="brand-logo">
              <span className="brand-letters">ATC</span>
              <Sun className="brand-sun" />
            </div>
            <div className="brand-text">
              <h1 className="brand-name">
                Attendance <span className="brand-accent">Hub</span>
              </h1>
              <p className="brand-sub">Daily CTC Reconciliation &amp; Master Excel Generator</p>
            </div>
          </div>

          {/* ── Nav Actions ───────────────────── */}
          <div className="nav-actions">

            {/* Refresh Cloud */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onRefreshCloudSync}
              disabled={isSyncing}
              className="nav-btn-ghost cursor-pointer"
              title="Sync latest from Sir's laptop"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing…' : 'Refresh'}</span>
            </motion.button>

            {/* ── VAULT / STORED FILES ───────── */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onOpenFileManager}
              className={`vault-btn cursor-pointer ${currentUser ? 'vault-btn--open' : 'vault-btn--locked'}`}
            >
              <div className="vault-icon-wrap">
                <Vault className="w-4 h-4" />
              </div>
              <div className="vault-label">
                <span className="vault-title">
                  {currentUser ? 'Stored Files' : 'Stored Files'}
                </span>
                <span className="vault-sub">
                  {currentUser
                    ? (storedFilesCount > 0 ? `${storedFilesCount} item${storedFilesCount > 1 ? 's' : ''} saved` : 'Vault open')
                    : 'Login to view'}
                </span>
              </div>
              {storedFilesCount > 0 && currentUser && (
                <span className="vault-badge">{storedFilesCount}</span>
              )}
              {!currentUser && (
                <span className="vault-lock-badge">🔒</span>
              )}
            </motion.button>

            {/* ── SIGN IN / USER PROFILE ────── */}
            {currentUser ? (
              /* Logged-in profile chip */
              <div className="profile-chip">
                <div className="profile-avatar">
                  <UserCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="profile-info hidden md:block">
                  <span className="profile-name">{currentUser.name || 'Executive'}</span>
                  <span className="profile-role">{currentUser.role || 'ATC Admin'}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="profile-logout cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* Sign-in CTA */
              <motion.button
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={onOpenAuthModal}
                className="signin-btn cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In</span>
              </motion.button>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
