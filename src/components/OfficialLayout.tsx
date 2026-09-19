import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBlockchain } from '../context/BlockchainContext';
import { useNotifications } from '../context/NotificationContext';
import { Shield, LayoutDashboard, LogOut, Users, List, Map, FileText, CreditCard, Activity, AlertTriangle, Archive, Bell, Scroll, CheckCircle2, BarChart3 } from 'lucide-react';
import { WalletOptionMenu } from './WalletOptionMenu';

type HeaderNotification = {
  id: string;
  title: string;
  message: string;
  link: string;
  createdAt: string;
  isRead: boolean;
  isServerNotification: boolean;
  resourceType?: string;
  resourceId?: string;
};

const NOTIFICATION_STATE_STORAGE_PREFIX = 'bayanledger-official-notifications';

const readStoredIdSet = (key: string) => {
  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return new Set<string>();

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? new Set<string>(parsedValue.filter((item) => typeof item === 'string')) : new Set<string>();
  } catch {
    return new Set<string>();
  }
};

const writeStoredIdSet = (key: string, value: Set<string>) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(value)));
  } catch {
    // Notification state is a convenience only; ignore storage failures.
  }
};

const roleFallbackLink = (role: string) => {
  switch (role) {
    case 'MPDC (Planning)':
      return '/official/milestones';
    case 'Budget Officer':
      return '/official/saro';
    case 'Treasurer':
      return '/official/disbursement-pipeline';
    case 'Admin':
      return '/official/alerts';
    default:
      return '/official/dashboard';
  }
};

const projectDetailLink = (projectId: string) => `/official/dashboard?projectId=${encodeURIComponent(projectId)}`;

const resolveNotificationLink = (
  link: string | undefined,
  role: string,
  resourceType?: string,
  resourceId?: string
) => {
  if (resourceType === 'project' && resourceId) {
    return projectDetailLink(resourceId);
  }

  if (!link) return roleFallbackLink(role);

  const normalizedLink = link.startsWith('official/') ? `/${link}` : link;

  if (normalizedLink.startsWith('/official/')) {
    const queryStart = normalizedLink.indexOf('?');
    if (queryStart >= 0) {
      const params = new URLSearchParams(normalizedLink.slice(queryStart + 1));
      const projectId = params.get('projectId');

      if (projectId) {
        return projectDetailLink(projectId);
      }
    }

    return normalizedLink;
  }

  return roleFallbackLink(role);
};

const formatNotificationTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const OfficialLayout = () => {
  const { user, logout } = useAuth();
  const { projects, alerts, isWeb3Connected, walletAddress, tamperedProjects } = useBlockchain();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [acknowledgedNotificationIds, setAcknowledgedNotificationIds] = useState<Set<string>>(() => new Set());
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set());
  const [loadedNotificationStateKey, setLoadedNotificationStateKey] = useState<string | null>(null);

  const notificationStateKey = user ? `${NOTIFICATION_STATE_STORAGE_PREFIX}:${user.id}` : null;
  const acknowledgedStorageKey = notificationStateKey ? `${notificationStateKey}:acknowledged` : null;
  const readStorageKey = notificationStateKey ? `${notificationStateKey}:read` : null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    if (!acknowledgedStorageKey || !readStorageKey || !notificationStateKey) {
      setAcknowledgedNotificationIds(new Set());
      setReadNotificationIds(new Set());
      setLoadedNotificationStateKey(null);
      return;
    }

    setAcknowledgedNotificationIds(readStoredIdSet(acknowledgedStorageKey));
    setReadNotificationIds(readStoredIdSet(readStorageKey));
    setLoadedNotificationStateKey(notificationStateKey);
  }, [acknowledgedStorageKey, notificationStateKey, readStorageKey]);

  useEffect(() => {
    if (!acknowledgedStorageKey || loadedNotificationStateKey !== notificationStateKey) return;
    writeStoredIdSet(acknowledgedStorageKey, acknowledgedNotificationIds);
  }, [acknowledgedNotificationIds, acknowledgedStorageKey, loadedNotificationStateKey, notificationStateKey]);

  useEffect(() => {
    if (!readStorageKey || loadedNotificationStateKey !== notificationStateKey) return;
    writeStoredIdSet(readStorageKey, readNotificationIds);
  }, [loadedNotificationStateKey, notificationStateKey, readNotificationIds, readStorageKey]);

  const roleTaskNotifications = useMemo<HeaderNotification[]>(() => {
    if (!user) return [];

    switch (user.role) {
      case 'MPDC (Planning)':
        return projects.flatMap((project) =>
          project.allocatedFunds > 0
            ? project.milestones
              .filter((milestone) => milestone.status === 'Pending')
              .map((milestone) => ({
                id: `task-mpdc-${project.id}-${milestone.id}`,
                title: 'Milestone Verification Pending',
                message: `${project.name}: ${milestone.title} needs MPDC verification.`,
                link: projectDetailLink(project.id),
                createdAt: milestone.dueDate || project.createdAt,
                isRead: readNotificationIds.has(`task-mpdc-${project.id}-${milestone.id}`),
                isServerNotification: false,
                resourceType: 'project',
                resourceId: project.id,
              }))
            : []
        );
      case 'Budget Officer': {
        const pendingAllocations = projects
          .filter((project) => project.status === 'MPDC Approved' || project.allocatedFunds === 0)
          .map((project) => ({
            id: `task-budget-allocation-${project.id}`,
            title: 'SARO Allocation Pending',
            message: `${project.name} is ready for budget allocation review.`,
            link: projectDetailLink(project.id),
            createdAt: project.createdAt,
            isRead: readNotificationIds.has(`task-budget-allocation-${project.id}`),
            isServerNotification: false,
            resourceType: 'project',
            resourceId: project.id,
          }));

        const pendingDisbursementSignatures = projects.flatMap((project) =>
          project.transactions
            .filter((transaction) => transaction.type === 'Disbursement (NCA)' && transaction.status === 'Pending Transaction')
            .map((transaction) => ({
              id: `task-budget-sign-${transaction.id}`,
              title: 'Disbursement Signature Pending',
              message: `${project.name}: a disbursement request needs Budget Officer sign-off.`,
              link: projectDetailLink(project.id),
              createdAt: transaction.date,
              isRead: readNotificationIds.has(`task-budget-sign-${transaction.id}`),
              isServerNotification: false,
              resourceType: 'project',
              resourceId: project.id,
            }))
        );

        return [...pendingDisbursementSignatures, ...pendingAllocations];
      }
      case 'Treasurer': {
        const pendingSaroApprovals = projects
          .filter((project) => project.status === 'SARO Approved - Pending Treasurer')
          .map((project) => ({
            id: `task-treasury-saro-${project.id}`,
            title: 'Treasury Activation Pending',
            message: `${project.name} needs Treasurer approval before implementation can begin.`,
            link: projectDetailLink(project.id),
            createdAt: project.budgetOfficerSignedAt || project.createdAt,
            isRead: readNotificationIds.has(`task-treasury-saro-${project.id}`),
            isServerNotification: false,
            resourceType: 'project',
            resourceId: project.id,
          }));

        const pendingExecutions = projects.flatMap((project) =>
          project.transactions
            .filter((transaction) => transaction.type === 'Disbursement (NCA)' && transaction.status === '1/2 Signed')
            .map((transaction) => ({
              id: `task-treasury-execute-${transaction.id}`,
              title: 'Payment Execution Pending',
              message: `${project.name}: a signed disbursement is ready for treasury execution.`,
              link: projectDetailLink(project.id),
              createdAt: transaction.budgetSignedAt || transaction.date,
              isRead: readNotificationIds.has(`task-treasury-execute-${transaction.id}`),
              isServerNotification: false,
              resourceType: 'project',
              resourceId: project.id,
            }))
        );

        return [...pendingExecutions, ...pendingSaroApprovals];
      }
      case 'Admin': {
        const breachNotifications: HeaderNotification[] = (tamperedProjects || []).map(({ id: pId }) => {
          const project = projects.find((p) => p.id === pId);
          const projectName = project?.name || `Project ${pId}`;
          const notifId = `task-admin-breach-${pId}`;
          return {
            id: notifId,
            title: '🚨 Critical Breach: Tampering Detected',
            message: `${projectName}: Database budget does not match immutable smart contract state on Sepolia. Immediate action required.`,
            link: '/official/alerts',
            createdAt: project?.createdAt || new Date().toISOString(),
            isRead: readNotificationIds.has(notifId),
            isServerNotification: false,
            resourceType: 'project',
            resourceId: pId,
          };
        });

        const alertNotifications: HeaderNotification[] = alerts
          .filter((alert) => alert.status === 'Unresolved')
          .map((alert) => {
            const project = projects.find((p) => p.id === alert.projectId);
            const projectName = project ? `${project.name}: ` : '';
            const notifId = `task-admin-alert-${alert.id}`;
            const isCritical = alert.severity === 'CRITICAL' || String(alert.alertType || '').toLowerCase().includes('breach') || String(alert.alertType || '').toLowerCase().includes('tamper');
            return {
              id: notifId,
              title: isCritical ? '🚨 Critical Security Alert' : `⚠️ System Alert: ${alert.alertType || 'Anomaly'}`,
              message: `${projectName}${alert.message}`,
              link: '/official/alerts',
              createdAt: alert.date,
              isRead: readNotificationIds.has(notifId),
              isServerNotification: false,
              resourceType: 'project',
              resourceId: alert.projectId,
            };
          });

        return [...breachNotifications, ...alertNotifications];
      }
      default:
        return [];
    }
  }, [alerts, projects, readNotificationIds, tamperedProjects, user]);

  const serverNotifications = useMemo<HeaderNotification[]>(() => {
    if (!user) return [];

    return notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      link: resolveNotificationLink(notification.link, user.role, notification.resource_type, notification.resource_id),
      createdAt: notification.created_at,
      isRead: notification.is_read || readNotificationIds.has(notification.id),
      isServerNotification: true,
      resourceType: notification.resource_type,
      resourceId: notification.resource_id,
    }));
  }, [notifications, readNotificationIds, user]);

  const allHeaderNotifications = useMemo(() => {
    return [...roleTaskNotifications, ...serverNotifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [roleTaskNotifications, serverNotifications]);

  const headerNotifications = useMemo(() => allHeaderNotifications.slice(0, 8), [allHeaderNotifications]);

  const notificationBadgeCount = allHeaderNotifications.filter(
    (notification) => !notification.isRead && !acknowledgedNotificationIds.has(notification.id)
  ).length;

  const hasUnreadNotifications = headerNotifications.some((notification) => !notification.isRead);

  const acknowledgeVisibleNotifications = () => {
    if (allHeaderNotifications.length === 0) return;

    setAcknowledgedNotificationIds((previous) => {
      const next = new Set(previous);
      allHeaderNotifications.forEach((notification) => next.add(notification.id));
      return next;
    });
  };

  const handleNotificationToggle = () => {
    setShowNotifications((current) => {
      const willOpen = !current;
      if (willOpen) {
        acknowledgeVisibleNotifications();
      }

      return willOpen;
    });
  };

  const handleMarkAllRead = async () => {
    acknowledgeVisibleNotifications();
    setReadNotificationIds((previous) => {
      const next = new Set(previous);
      allHeaderNotifications.forEach((notification) => next.add(notification.id));
      return next;
    });
    await markAllAsRead();
  };

  const handleNotificationClick = async (notification: HeaderNotification) => {
    setAcknowledgedNotificationIds((previous) => {
      const next = new Set(previous);
      next.add(notification.id);
      return next;
    });
    setReadNotificationIds((previous) => {
      const next = new Set(previous);
      next.add(notification.id);
      return next;
    });

    if (notification.isServerNotification && !notification.isRead) {
      await markAsRead(notification.id);
    }

    setShowNotifications(false);
    navigate(notification.link);
  };

  // User is guaranteed to be authenticated here (ProtectedRoute handles that)
  if (!user) {
    return null; // This should never happen, but just in case
  }

  const displayName = user.name || `${user.firstName} ${user.lastName}`.trim() || user.email || 'User';
  const displayInitial = displayName.charAt(0).toUpperCase();

  const NavItem = ({ to, icon: Icon, label, badge }: { to: string, icon: any, label: string, badge?: string | number }) => {
    const isActive = location.pathname === `/official/${to}`;
    return (
      <Link
        to={`/official/${to}`}
        className={[
          'group flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/30',
          isActive
            ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-950 dark:shadow-md font-semibold'
            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100',
        ].join(' ')}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon
            className={`h-4 w-4 shrink-0 transition-colors ${isActive
                ? 'text-white dark:text-slate-950'
                : 'text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
              }`}
          />
          <span className="truncate">{label}</span>
        </div>
        {badge !== undefined && (
          <span
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full transition-colors ${isActive
                ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-800'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const NavGroup = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="mb-4">
      <div className="mb-1.5 px-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        {title}
      </div>
      <nav className="space-y-1">
        {children}
      </nav>
    </div>
  );

  const renderSharedTransparencyLinks = () => (
    <>
      <NavGroup title="Transparency">
        <NavItem to="audit" icon={Activity} label="Digital Audit Trail" />
      </NavGroup>
      <NavGroup title="Storage">
        <NavItem to="archive" icon={Archive} label="Archive/Documents" />
      </NavGroup>
    </>
  );

  const renderSidebarLinks = () => {
    switch (user.role) {
      case 'MPDC (Planning)':
        return (
          <>
            <NavGroup title="Overview">
              <NavItem to="dashboard" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="pipeline" icon={List} label="Project Pipeline" />
              <NavItem to="reports" icon={BarChart3} label="Reports & Analytics" />
            </NavGroup>
            <NavGroup title="Project Management">
              <NavItem to="milestones" icon={Map} label="Milestone Manager" />
            </NavGroup>
            {renderSharedTransparencyLinks()}
          </>
        );
      case 'Budget Officer':
        return (
          <>
            <NavGroup title="Overview">
              <NavItem to="dashboard" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="pipeline" icon={List} label="Project Pipeline" />
              <NavItem to="reports" icon={BarChart3} label="Reports & Analytics" />
            </NavGroup>
            <NavGroup title="Budget & Finance">
              <NavItem to="saro" icon={FileText} label="Allotment Registry (SARO)" />
            </NavGroup>
            {renderSharedTransparencyLinks()}
          </>
        );
      case 'Treasurer':
        return (
          <>
            <NavGroup title="Overview">
              <NavItem to="dashboard" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="pipeline" icon={List} label="Project Pipeline" />
              <NavItem to="reports" icon={BarChart3} label="Reports & Analytics" />
            </NavGroup>
            <NavGroup title="Disbursement">
              <NavItem to="nca" icon={CreditCard} label="Disbursement Ledger (NCA)" />
              <NavItem to="payment-hashes" icon={FileText} label="Payment Hashes" />
              <NavItem to="disbursement-pipeline" icon={Activity} label="Disbursement Pipeline" />
            </NavGroup>
            {renderSharedTransparencyLinks()}
          </>
        );
      case 'Admin':
        return (
          <>
            <NavGroup title="Overview">
              <NavItem to="dashboard" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="pipeline" icon={List} label="Project Pipeline" />
              <NavItem to="reports" icon={BarChart3} label="Reports & Analytics" />
            </NavGroup>
            <NavGroup title="Admin & Security">
              <NavItem to="users" icon={Users} label="User Management" />
              <NavItem to="rbac" icon={Shield} label="RBAC Permissions" />
              <NavItem to="audit" icon={Activity} label="Digital Audit Trail" />
              <NavItem to="audit-logs" icon={Scroll} label="System Audit Logs" />
              <NavItem to="alerts" icon={AlertTriangle} label="Anomaly Alerts" />
              <NavItem to="integrity-check" icon={Shield} label="Blockchain Integrity" />
            </NavGroup>
            <NavGroup title="Storage">
              <NavItem to="archive" icon={Archive} label="Archive/Documents" />
            </NavGroup>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="official-portal flex h-screen bg-slate-50 dark:bg-[#0c0e14] text-slate-900 dark:text-slate-100 overflow-hidden">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200 dark:border-[#1a1e2b] bg-white dark:bg-[#0c0e14] text-slate-900 dark:text-white transition-colors duration-200">
        <div className="border-b border-slate-100 dark:border-[#1a1e2b] px-5 py-4 flex items-center justify-between">
          <Link to="/official/dashboard" className="flex items-center gap-3 group">
            <img src="/bayan-ledger-logo.jpg" alt="BayanLedger Logo" className="h-9 w-9 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-800 shadow-2xs group-hover:scale-105 transition-transform" />
            <div className="min-w-0">
              <div className="text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-white">BayanLedger</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Official Portal</span>
              </div>
            </div>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {renderSidebarLinks()}
        </div>
        <div className="p-3 border-t border-slate-100 dark:border-[#1a1e2b] bg-white/50 dark:bg-[#0c0e14]/50">
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-[#121520] border border-slate-200/80 dark:border-[#1e2334] transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-2xs">
                {displayInitial}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-900 dark:text-white">{displayName}</div>
                <div className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">{user.role}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white/90 dark:bg-[#0c0e14]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#1a1e2b] flex items-center px-6 sm:px-8 justify-between flex-shrink-0 z-20 transition-colors shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {location.pathname.includes('/milestones') ? 'Project Management' :
                    location.pathname.includes('/saro') ? 'Budget & Finance' :
                      location.pathname.includes('/nca') || location.pathname.includes('/payment-hashes') || location.pathname.includes('/disbursement-pipeline') ? 'Disbursement' :
                        location.pathname.includes('/users') || location.pathname.includes('/rbac') || location.pathname.includes('/alerts') || location.pathname.includes('/audit-logs') || location.pathname.includes('/integrity-check') ? 'Admin & Security' :
                          location.pathname.includes('/archive') ? 'Storage' :
                            location.pathname.includes('/audit') ? 'Transparency' :
                              'Overview'}
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${user.role === 'MPDC (Planning)' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800' :
                    user.role === 'Budget Officer' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800' :
                      user.role === 'Treasurer' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800' :
                        'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
                  }`}>
                  {user.role}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none mt-1">
                {location.pathname.includes('/milestones') ? 'Milestone Manager' :
                  location.pathname.includes('/saro') ? 'Allotment Registry (SARO)' :
                    location.pathname.includes('/nca') ? 'Disbursement Ledger (NCA)' :
                      location.pathname.includes('/payment-hashes') ? 'Payment Hashes' :
                        location.pathname.includes('/disbursement-pipeline') ? 'Disbursement Pipeline' :
                          location.pathname.includes('/pipeline') ? 'Project Pipeline' :
                            location.pathname.includes('/dashboard') ? 'Executive Dashboard' :
                              location.pathname.includes('/users') ? 'User Management' :
                                location.pathname.includes('/rbac') ? 'RBAC Permissions' :
                                  location.pathname.includes('/alerts') ? 'Anomaly Alerts' :
                                    location.pathname.includes('/audit-logs') ? 'System Audit Logs' :
                                      location.pathname.includes('/archive') ? 'Archive & Documents' :
                                        location.pathname.includes('/audit') ? 'Digital Audit Trail' :
                                          location.pathname.includes('/integrity-check') ? 'Blockchain Integrity Check' :
                                            location.pathname.includes('/reports') || location.pathname.includes('/analytics') ? 'Reports & Data Analytics' :
                                              'Official Portal'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="relative">
              <button
                onClick={handleNotificationToggle}
                className="relative h-9 w-9 rounded-xl border border-slate-200 dark:border-[#212638] bg-white dark:bg-[#141722] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1b1f2e] flex items-center justify-center transition-all duration-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                aria-label="Open notifications"
              >
                <Bell className="h-4 w-4" />
                {notificationBadgeCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border-2 border-white dark:border-[#0c0e14] bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                    {notificationBadgeCount > 9 ? '9+' : notificationBadgeCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-2xl border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-xl">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1e2334] bg-slate-50 dark:bg-[#151926] p-3.5">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user.role}</p>
                    </div>
                    {hasUnreadNotifications && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto p-2">
                    {isLoading && headerNotifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        Loading notifications...
                      </div>
                    ) : headerNotifications.length > 0 ? (
                      <div className="space-y-2">
                        {headerNotifications.map((notification) => {
                          const isAlertOrBreach = notification.title.includes('Breach') || notification.title.includes('Alert') || notification.title.includes('🚨');
                          return (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => handleNotificationClick(notification)}
                              className={[
                                'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                                notification.isRead
                                  ? 'border-slate-100 dark:border-[#1e2334] bg-white dark:bg-[#121520] hover:bg-slate-50 dark:hover:bg-[#181c2b]'
                                  : isAlertOrBreach
                                    ? 'border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/30 hover:bg-red-100/70 dark:hover:bg-red-950/50'
                                    : 'border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100/70 dark:hover:bg-blue-950/50',
                              ].join(' ')}
                            >
                              <span className={[
                                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                                notification.isRead
                                  ? 'bg-slate-100 dark:bg-[#181c2b] text-slate-500 dark:text-slate-400'
                                  : isAlertOrBreach
                                    ? 'bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300'
                                    : 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300',
                              ].join(' ')}>
                                {isAlertOrBreach ? (
                                  <AlertTriangle className="h-4 w-4" />
                                ) : notification.isServerNotification ? (
                                  <Bell className="h-4 w-4" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-start justify-between gap-3">
                                  <span className={`text-sm font-semibold ${!notification.isRead && isAlertOrBreach ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                                    {notification.title}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">{formatNotificationTime(notification.createdAt)}</span>
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">{notification.message}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        No notifications for {user.role}.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Connected Wallet Status (if connected) */}
            {isWeb3Connected && (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-mono text-emerald-800 dark:text-emerald-300 font-semibold">
                  {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                </span>
              </div>
            )}

            {/* Option Button Icon & Dropdown Menu */}
            <WalletOptionMenu />
          </div>
        </header>
        <div data-scroll-root className="flex-1 overflow-y-auto px-6 py-4 sm:px-8 sm:py-5 bg-slate-50 dark:bg-[#0c0e14] text-slate-900 dark:text-slate-100">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};
