import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';

export const PublicLayout = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <img src="https://upload.wikimedia.org/wikipedia/commons/8/88/Santa_Cruz_Laguna_Seal.png" alt="Santa Cruz Logo" className="h-10 w-10 object-contain" referrerPolicy="no-referrer" />
                <span className="font-bold text-xl tracking-tight text-slate-900">Sta. Cruz <span className="text-blue-600">Chain</span></span>
              </Link>
            </div>
            <nav className="flex items-center gap-6">
              <Link to="/projects" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Projects Portal
              </Link>
              <Link to="/proposals" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Citizen Proposals
              </Link>
              {user ? (
                <Link to="/official/dashboard">
                  <Button variant="default" size="sm">Go to Dashboard</Button>
                </Link>
              ) : (
                <Link to="/login">
                  <Button variant="outline" size="sm">Official Login</Button>
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <p>&copy; 2026 Sta. Cruz Municipality. All rights reserved.</p>
          <p className="mt-2">Immutable, Transparent, Accountable.</p>
        </div>
      </footer>
    </div>
  );
};
