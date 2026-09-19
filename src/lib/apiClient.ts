export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? (isFormData ? options.body as FormData : JSON.stringify(options.body)) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(payload.error || 'Request failed');
  }

  return response.json();
}

export const apiClient = {
  login: (email: string, password: string) => request('/auth/login', {
    method: 'POST',
    body: { email, password },
  }),
  getProfile: (token: string) => request('/auth/me', { token }),
  getUsers: (token: string) => request('/auth/users', { token }),
  registerUser: (token: string, body: {
    email: string;
    password: string;
    role: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    walletAddress: string;
    chainRoleGranted?: boolean;
    chainRoleGrantTxHash?: string;
  }) => request('/auth/register', { method: 'POST', token, body }),
  updateUserChainRole: (token: string, id: string, body: { chainRoleGranted: boolean; walletAddress?: string }) => request(`/auth/users/${id}/chain-role`, { method: 'PATCH', token, body }),
  updateUser: (token: string, id: string, body: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    walletAddress?: string;
    role?: string;
  }) => request(`/auth/users/${id}`, { method: 'PATCH', token, body }),
  resetUserPassword: (token: string, id: string, newPassword: string) => request(`/auth/users/${id}/reset-password`, {
    method: 'POST',
    token,
    body: { newPassword },
  }),
  updateUserStatus: (token: string, id: string, status: 'Active' | 'Inactive') => request(`/auth/users/${id}/status`, {
    method: 'PATCH',
    token,
    body: { status },
  }),
  deleteUser: (token: string, id: string) => request(`/auth/users/${id}`, { method: 'DELETE', token }),
  requestWalletLinkChallenge: (token: string) => request('/auth/wallet-link/challenge', { method: 'POST', token }),
  verifyWalletLink: (token: string, walletAddress: string, signature: string) => request('/auth/wallet-link/verify', {
    method: 'POST',
    token,
    body: { walletAddress, signature },
  }),


  getProjects: (token?: string, options?: { page?: number; limit?: number; status?: string; category?: string; location?: string }) => {
    const query = new URLSearchParams();
    if (options?.page) query.set('page', String(options.page));
    if (options?.limit) query.set('limit', String(options.limit || 20));
    if (options?.status) query.set('status', options.status);
    if (options?.category) query.set('category', options.category);
    if (options?.location) query.set('location', options.location);
    const queryStr = query.toString() ? `?${query.toString()}` : '?limit=20';
    return request(`/projects${queryStr}`, { token });
  },
  getProjectComments: (id: string) => request(`/projects/${id}/comments`),
  createProjectComment: (id: string, body: FormData) => request(`/projects/${id}/comments`, { method: 'POST', body }),
  getProjectTransparencySummary: (id: string) => request(`/projects/${id}/transparency-summary`),
  getProposals: (token: string) => request('/proposals?limit=1000', { token }),
  createProject: (token: string, body: unknown) => request('/projects', { method: 'POST', token, body }),
  resolveProjectBreach: (token: string, id: string, body: { blockchainBudget: number; tamperedBudget: number; notes?: string }) =>
    request(`/projects/${id}/resolve-breach`, { method: 'POST', token, body }),
  createProposal: (token: string, body: unknown) => request('/proposals', { method: 'POST', token, body }),
  updateProposal: (token: string, id: string, body: unknown) => request(`/proposals/${id}`, { method: 'PUT', token, body }),
  updateProposalStatus: (token: string, id: string, status: string, comments?: string, reviewerWallet?: string) => request(`/proposals/${id}/status`, {
    method: 'PATCH',
    token,
    body: { status, comments, reviewerWallet },
  }),
  createMilestone: (token: string, body: unknown) => request('/milestones', { method: 'POST', token, body }),
  uploadMilestonePhoto: (token: string, id: string, body: FormData) => request(`/milestones/${id}/photos`, { method: 'POST', token, body }),
  verifyMilestone: (token: string, id: string, body: unknown) => request(`/milestones/${id}/verify`, { method: 'POST', token, body }),
  createTransaction: (token: string, body: unknown) => request('/transactions', { method: 'POST', token, body }),
  budgetSignTransaction: (token: string, id: string, body: { supportingHash?: string; transactionHash?: string; requestId?: string }) => request(`/transactions/${id}/budget-sign`, { method: 'POST', token, body }),
  executeTransactionRequest: (token: string, id: string, body: { transactionHash?: string; digitalSealHash?: string; requestId?: string }) => request(`/transactions/${id}/treasurer-execute`, { method: 'POST', token, body }),
  rejectTreasurerTransaction: (token: string, id: string, body: { reason: string; transactionHash?: string }) => request(`/transactions/${id}/treasurer-reject`, { method: 'POST', token, body }),
  getAuditLogs: (token: string) => request('/audit-logs?limit=100', { token }),
  getProjectAuditTrail: (token: string, id: string) => request(`/audit-logs/project/${id}/trail`, { token }),
  getSystemAlerts: (token: string) => request('/system-alerts', { token }),
  createSystemAlert: (token: string, body: unknown) => request('/system-alerts', { method: 'POST', token, body }),
  updateSystemAlert: (token: string, id: string, body: unknown) => request(`/system-alerts/${id}`, { method: 'PATCH', token, body }),

  uploadDocument: (token: string, body: FormData) => request('/documents/upload', { method: 'POST', token, body }),

  getBlockchainEvents: (token: string) => request('/blockchain/events', { token }),
  queueBlockchainSync: (token: string, body: unknown) => request('/blockchain/sync-queue', { method: 'POST', token, body }),
  getNotifications: (token: string, params?: { is_read?: boolean; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.is_read !== undefined) query.set('is_read', String(params.is_read));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    return request(`/notifications${queryStr}`, { token });
  },
  markNotificationRead: (token: string, id: string) => request(`/notifications/${id}/read`, { method: 'PATCH', token }),
  markAllNotificationsRead: (token: string) => request('/notifications/read-all', { method: 'PATCH', token }),
  deleteNotification: (token: string, id: string) => request(`/notifications/${id}`, { method: 'DELETE', token }),
};

export const getProjectTransparencyExportUrl = (id: string) => `${API_BASE_URL}/projects/${id}/export.csv`;

export default apiClient;
