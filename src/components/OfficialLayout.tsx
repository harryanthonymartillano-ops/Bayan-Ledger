import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LayoutDashboard, LogOut, Users } from 'lucide-react';

export const OfficialLayout = () => {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Unauthorized Access</h2>
          <p className="text-slate-500 mb-4">Please log in to access the official portal.</p>
          <Link to="/login" className="text-blue-600 hover:underline">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <Shield className="h-6 w-6 text-blue-400 mr-2" />
          <span className="font-bold text-lg tracking-tight">Sta. Cruz <span className="text-blue-400">Chain</span></span>
        </div>
        <div className="p-4 flex-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Menu</div>
          <nav className="space-y-1">
            <Link 
              to="/official/dashboard" 
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname.includes('/dashboard') ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
            >
              <LayoutDashboard className="h-4 w-4 mr-3" />
              Dashboard
            </Link>
            {user.role === 'Admin / HR' && (
              <Link 
                to="/official/users" 
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname.includes('/users') ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
              >
                <Users className="h-4 w-4 mr-3" />
                User Management
              </Link>
            )}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold mr-3 text-white">
              {user.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{user.name}</div>
              <div className="text-xs text-slate-400 truncate">{user.role}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="flex w-full items-center px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-slate-900">Official Portal</h1>
            <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Demo Mode:</span>
              <select 
                className="text-sm bg-transparent border-none text-amber-900 font-medium focus:ring-0 cursor-pointer outline-none"
                value={user.role}
                onChange={(e) => {
                  const newRole = e.target.value as any;
                  login(newRole);
                }}
              >
                <option value="MPDC (Planning)">MPDC (Planning)</option>
                <option value="Budget Officer">Budget Officer</option>
                <option value="Treasurer">Treasurer</option>
                <option value="Admin / HR">Admin / HR</option>
              </select>
            </div>
          </div>
          <Link to="/" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
            View Public Site
          </Link>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
