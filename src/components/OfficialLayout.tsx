import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBlockchain } from '../context/BlockchainContext';
import { Shield, LayoutDashboard, LogOut, Users, CheckSquare, List, Map, FileText, CreditCard, Activity, AlertTriangle, Archive, ChevronDown, Search, Bell } from 'lucide-react';

export const OfficialLayout = () => {
  const { user, logout, login } = useAuth();
  const { projects } = useBlockchain();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

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

  // Calculate pending signatures
  let pendingSignaturesCount = 0;
  if (user.role === 'MPDC (Planning)') {
    pendingSignaturesCount = projects.flatMap(p => p.milestones).filter(m => m.status === 'Pending').length;
  } else if (user.role === 'Budget Officer') {
    pendingSignaturesCount = projects.filter(p => p.allocatedFunds === 0).length;
  } else if (user.role === 'Treasurer') {
    pendingSignaturesCount = projects.filter(p => p.milestones.some(m => m.status === 'Verified') && p.disbursedFunds < p.allocatedFunds).length;
  }

  const [showNotifications, setShowNotifications] = useState(false);

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const isActive = location.pathname.includes(to);
    return (
      <Link 
        to={`/official/${to}`} 
        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
      >
        <Icon className="h-4 w-4 mr-3" />
        {label}
      </Link>
    );
  };

  const NavGroup = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="mb-6">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">{title}</div>
      <nav className="space-y-1 px-2">
        {children}
      </nav>
    </div>
  );

  const renderSidebarLinks = () => {
    switch (user.role) {
      case 'MPDC (Planning)':
        return (
          <>
            <NavGroup title="Overview">
              <NavItem to="dashboard" icon={LayoutDashboard} label="Overview Dashboard" />
            </NavGroup>
            <NavGroup title="Project Management">
              <NavItem to="pipeline" icon={List} label="Project Pipeline" />
              <NavItem to="milestones" icon={Map} label="Milestone Manager" />
              <NavItem to="citizen-proposals" icon={Users} label="Citizen Proposals" />
            </NavGroup>
          </>
        );
      case 'Budget Officer':
        return (
          <>
            <NavGroup title="Overview">
              <NavItem to="dashboard" icon={LayoutDashboard} label="Overview Dashboard" />
            </NavGroup>
            <NavGroup title="Budget & Finance">
              <NavItem to="saro" icon={FileText} label="Allotment Registry (SARO)" />
            </NavGroup>
          </>
        );
      case 'Treasurer':
        return (
          <>
            <NavGroup title="Overview">
              <NavItem to="dashboard" icon={LayoutDashboard} label="Overview Dashboard" />
            </NavGroup>
            <NavGroup title="Disbursement">
              <NavItem to="nca" icon={CreditCard} label="Disbursement Ledger (NCA)" />
              <NavItem to="verified-payments" icon={CheckSquare} label="Smart Contract Auto-Release" />
              <NavItem to="payment-hashes" icon={FileText} label="Payment Hashes" />
            </NavGroup>
          </>
        );
      case 'Admin / HR':
        return (
          <>
            <NavGroup title="Overview">
              <NavItem to="dashboard" icon={LayoutDashboard} label="Overview Dashboard" />
            </NavGroup>
            <NavGroup title="Admin & Security">
              <NavItem to="users" icon={Users} label="User Management" />
              <NavItem to="rbac" icon={Shield} label="RBAC Permissions" />
              <NavItem to="audit" icon={Activity} label="Digital Audit Trail" />
              <NavItem to="alerts" icon={AlertTriangle} label="Anomaly Alerts" />
            </NavGroup>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 overflow-y-auto">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <img src="https://upload.wikimedia.org/wikipedia/commons/8/88/Santa_Cruz_Laguna_Seal.png" alt="Santa Cruz Logo" className="h-8 w-8 object-contain mr-2" referrerPolicy="no-referrer" />
          <span className="font-bold text-lg tracking-tight">Sta. Cruz <span className="text-blue-400">Chain</span></span>
        </div>
        
        <div className="px-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border-none rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="py-2 flex-1">
          {renderSidebarLinks()}
          <NavGroup title="Storage">
            <NavItem to="archive" icon={Archive} label="Archive/Documents" />
          </NavGroup>
        </div>
        <div className="p-4 border-t border-slate-800 sticky bottom-0 bg-slate-900 z-10">
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
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Bell className="h-5 w-5" />
                {pendingSignaturesCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border border-slate-200 z-50 overflow-hidden">
                  <div className="p-3 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2">
                    {pendingSignaturesCount > 0 ? (
                      <div className="p-3 bg-blue-50 rounded-md border border-blue-100 flex items-start gap-3">
                        <Bell className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-blue-900">Sign Pending</h4>
                          <p className="text-xs text-blue-700 mt-1">
                            You have {pendingSignaturesCount} project{pendingSignaturesCount !== 1 ? 's' : ''} requiring your cryptographic approval.
                          </p>
                          <Link 
                            to="/official/dashboard" 
                            className="text-xs font-medium text-blue-600 hover:underline mt-2 inline-block"
                            onClick={() => setShowNotifications(false)}
                          >
                            View Dashboard
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500">
                        No new notifications.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Link to="/" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
              View Public Site
            </Link>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
