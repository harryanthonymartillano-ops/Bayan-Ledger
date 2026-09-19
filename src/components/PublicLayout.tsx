import React, { useState } from 'react';
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import {
  Menu,
  ShieldCheck,
  X,
  ExternalLink,
} from 'lucide-react';

export const PublicLayout = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isProjectRoute = location.pathname === '/projects' || location.pathname.startsWith('/project/');
  const isTransactionRoute = location.pathname === '/transactions';

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col font-sans text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Pristine White Header (Exactly like Naga City People's Budget Portal) */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Brand Logo & Municipal Identity */}
            <Link to="/" className="group flex items-center gap-3 transition-opacity hover:opacity-90">
              <img
                src="/logo-bayanledger.png"
                alt="Municipality of Santa Cruz Official Seal"
                className="h-10 w-10 object-contain"
              />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                  MUNICIPALITY OF SANTA CRUZ
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">
                    BayanLedger
                  </span>
                  <span className="text-xs font-medium text-slate-500 leading-tight hidden sm:inline">
                    &bull; People's Budget Portal
                  </span>
                </div>
              </div>
            </Link>

            {/* Desktop Clean Text Navigation Links (Naga Style with blue underline) */}
            <nav className="hidden md:flex items-center gap-8">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  [
                    'text-sm transition-colors pb-0.5 border-b-2',
                    isActive
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 font-medium',
                  ].join(' ')
                }
              >
                Home
              </NavLink>

              <NavLink
                to="/projects"
                className={() =>
                  [
                    'text-sm transition-colors pb-0.5 border-b-2',
                    isProjectRoute
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 font-medium',
                  ].join(' ')
                }
              >
                Projects
              </NavLink>

              <NavLink
                to="/transactions"
                className={() =>
                  [
                    'text-sm transition-colors pb-0.5 border-b-2',
                    isTransactionRoute
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 font-medium',
                  ].join(' ')
                }
              >
                Transaction Receipts
              </NavLink>
            </nav>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="inline-flex items-center justify-center rounded-lg p-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="border-b border-slate-200 bg-white px-4 py-3 md:hidden shadow-md animate-in slide-in-from-top-1 duration-150">
            <div className="space-y-1">
              <Link
                to="/"
                onClick={closeMobileMenu}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  location.pathname === '/' ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Home
              </Link>
              <Link
                to="/projects"
                onClick={closeMobileMenu}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  isProjectRoute ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Projects
              </Link>
              <Link
                to="/transactions"
                onClick={closeMobileMenu}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  isTransactionRoute ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Transaction Receipts
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1">
        <div key={location.pathname + location.search} className="page-transition">
          <Outlet />
        </div>
      </main>

      {/* Clean Civic Footer */}
      <footer className="border-t border-slate-200 bg-white text-slate-600">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Column 1: Municipal Identity */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <img src="/logo-bayanledger.png" alt="Municipality of Santa Cruz" className="h-8 w-8 object-contain" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Municipality of Santa Cruz</p>
                  <p className="text-[11px] font-medium text-slate-500">People's Budget Portal &bull; BayanLedger</p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Official public transparency portal for the Annual Investment Program (AIP),
                milestone verifications, and multi-sig treasury disbursements.
              </p>
              <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Sepolia On-Chain Ledger</span>
              </div>
            </div>

            {/* Column 2: Public Navigation */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-900">The Portal</p>
              <ul className="mt-3 space-y-2 text-xs">
                <li>
                  <Link to="/" className="text-slate-600 hover:text-slate-900 transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/projects" className="text-slate-600 hover:text-slate-900 transition-colors">
                    Projects Registry
                  </Link>
                </li>
                <li>
                  <Link to="/transactions" className="text-slate-600 hover:text-slate-900 transition-colors">
                    Transaction Receipts (Officer Ledger)
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Standards & Governance */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Governance & Standards</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-600">
                <li>
                  <a
                    href="https://www.dbm.gov.ph"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    DBM Budget Operations Manual
                    <ExternalLink className="h-3 w-3 text-slate-400" />
                  </a>
                </li>
                <li>
                  <span className="text-slate-600">Local Government Code (RA 7160)</span>
                </li>
                <li>
                  <span className="text-slate-600">COA Full Disclosure Policy (FDP)</span>
                </li>
                <li>
                  <span className="text-slate-600">3-Officer Separation of Duties</span>
                </li>
              </ul>
            </div>

            {/* Column 4: Contact & Office */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Contact & Support</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Santa Cruz Municipal Hall<br />
                Pedro Guevara Avenue, Poblacion<br />
                Santa Cruz, Laguna 4009
              </p>
              <p className="text-xs text-slate-500 pt-1">
                Office Hours: Monday – Friday<br />
                8:00 AM – 5:00 PM PST
              </p>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} Municipality of Santa Cruz, Laguna. Open Budget & Civic Ledger.</p>
            <p className="font-semibold text-slate-600">Buwis natin. Proyekto natin. Ledger natin.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
