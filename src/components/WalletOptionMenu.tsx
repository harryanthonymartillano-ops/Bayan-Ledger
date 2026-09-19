import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MoreVertical,
  Wallet,
  Copy,
  Check,
  ExternalLink,
  LogOut,
  ShieldCheck,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useBlockchain } from '../context/BlockchainContext';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export const WalletOptionMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isWeb3Connected, walletAddress, disconnectWallet, connectToWeb3 } = useBlockchain();
  const { isDark } = useTheme();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Option Button Icon */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-center h-8 w-8 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isOpen
            ? 'border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-400'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
          }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Options and settings"
        title="Options & Theme"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {/* Options Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5 transition-all dark:border-slate-800 dark:bg-slate-900 dark:ring-white/10">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Options & Preferences
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Display & Wallet
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              Official
            </span>
          </div>

          {/* Theme Section */}
          <div className="py-3">
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Appearance
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                  {isDark ? 'Dark Mode Active' : 'Light Mode Active'}
                </div>
              </div>
            </div>
            <ThemeToggle variant="cards" />
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          {/* Wallet Section */}
          <div className="py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Web3 Wallet
                </span>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${isWeb3Connected
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isWeb3Connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                />
                {isWeb3Connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {isWeb3Connected && walletAddress ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      Active Address
                    </div>
                    <div className="truncate font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {walletAddress}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                    title={copied ? 'Copied!' : 'Copy full address'}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    disconnectWallet();
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/60"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect Wallet
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Connect your MetaMask or Web3 provider to verify milestone approvals and digital signatures.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    connectToWeb3();
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Connect Wallet
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          {/* Quick Links */}
          <div className="pt-2 space-y-1">
            <Link
              to="/official/wallet-link"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                Manage Wallet Link
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </Link>

            <Link
              to="/official/integrity-check"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Blockchain Integrity
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
