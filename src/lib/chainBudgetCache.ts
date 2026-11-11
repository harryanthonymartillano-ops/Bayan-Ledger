const CHAIN_BUDGETS_STORAGE_KEY = 'bayanledger-chain-budgets-cache';
const CHAIN_DATA_STORAGE_KEY = 'bayanledger-chain-project-data-cache';

export interface ChainProjectData {
  totalBudget: number;
  allocatedFunds?: number;
  disbursedFunds?: number;
  updatedAt?: number;
}

export type ChainBudgetsCache = Record<string, number>;
export type ChainDataCache = Record<string, ChainProjectData>;

const isBrowser = typeof window !== 'undefined';

/**
 * Read the full chain data cache (totalBudget, allocatedFunds, disbursedFunds).
 * Automatically migrates or merges older numeric-only cache entries.
 */
export const readStoredChainData = (): ChainDataCache => {
  if (!isBrowser) return {};

  const result: ChainDataCache = {};

  // First, load older numeric budgets if present
  try {
    const rawBudgets = window.localStorage.getItem(CHAIN_BUDGETS_STORAGE_KEY);
    if (rawBudgets) {
      const parsed = JSON.parse(rawBudgets) as Record<string, unknown>;
      for (const [id, value] of Object.entries(parsed)) {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
          result[id] = { totalBudget: value };
        } else if (value && typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          const tb = Number(obj.totalBudget);
          if (Number.isFinite(tb) && tb >= 0) {
            result[id] = {
              totalBudget: tb,
              allocatedFunds: Number.isFinite(Number(obj.allocatedFunds)) ? Number(obj.allocatedFunds) : undefined,
              disbursedFunds: Number.isFinite(Number(obj.disbursedFunds)) ? Number(obj.disbursedFunds) : undefined,
            };
          }
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Next, overlay full chain data cache
  try {
    const rawData = window.localStorage.getItem(CHAIN_DATA_STORAGE_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData) as Record<string, unknown>;
      for (const [id, value] of Object.entries(parsed)) {
        if (value && typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          const tb = Number(obj.totalBudget);
          if (Number.isFinite(tb) && tb >= 0) {
            result[id] = {
              totalBudget: tb,
              allocatedFunds: Number.isFinite(Number(obj.allocatedFunds)) ? Number(obj.allocatedFunds) : result[id]?.allocatedFunds,
              disbursedFunds: Number.isFinite(Number(obj.disbursedFunds)) ? Number(obj.disbursedFunds) : result[id]?.disbursedFunds,
              updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : undefined,
            };
          }
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  return result;
};

export const writeStoredChainData = (data: ChainDataCache) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(CHAIN_DATA_STORAGE_KEY, JSON.stringify(data));
    // Also keep legacy numeric budgets in sync
    const simpleBudgets: ChainBudgetsCache = {};
    for (const [id, item] of Object.entries(data)) {
      if (typeof item.totalBudget === 'number' && Number.isFinite(item.totalBudget)) {
        simpleBudgets[id] = item.totalBudget;
      }
    }
    window.localStorage.setItem(CHAIN_BUDGETS_STORAGE_KEY, JSON.stringify(simpleBudgets));
  } catch {
    // Ignore storage quota errors
  }
};

export const readStoredChainBudgets = (): ChainBudgetsCache => {
  const fullData = readStoredChainData();
  const budgets: ChainBudgetsCache = {};
  for (const [id, item] of Object.entries(fullData)) {
    budgets[id] = item.totalBudget;
  }
  return budgets;
};

export const writeStoredChainBudgets = (budgets: ChainBudgetsCache) => {
  if (!isBrowser) return;
  try {
    const currentData = readStoredChainData();
    for (const [id, budget] of Object.entries(budgets)) {
      if (Number.isFinite(budget) && budget >= 0) {
        currentData[id] = {
          ...(currentData[id] || {}),
          totalBudget: budget,
          updatedAt: Date.now(),
        };
      }
    }
    writeStoredChainData(currentData);
  } catch {
    // Ignore quota errors
  }
};

export const getStoredChainData = (projectId: string): ChainProjectData | null => {
  if (!projectId) return null;
  const data = readStoredChainData();
  return data[projectId] || null;
};

export const getStoredChainBudget = (projectId: string): number | null => {
  if (!projectId) return null;
  const projectData = getStoredChainData(projectId);
  return typeof projectData?.totalBudget === 'number' ? projectData.totalBudget : null;
};

export const getStoredChainAllocated = (projectId: string): number | null => {
  if (!projectId) return null;
  const projectData = getStoredChainData(projectId);
  return typeof projectData?.allocatedFunds === 'number' ? projectData.allocatedFunds : null;
};

export const updateStoredChainProject = (
  projectId: string,
  update: Partial<ChainProjectData>
): ChainDataCache => {
  if (!projectId) return readStoredChainData();

  const current = readStoredChainData();
  const prev = current[projectId] || { totalBudget: 0 };

  const totalBudget = Number.isFinite(Number(update.totalBudget))
    ? Number(update.totalBudget)
    : prev.totalBudget;

  const allocatedFunds = Number.isFinite(Number(update.allocatedFunds))
    ? Number(update.allocatedFunds)
    : prev.allocatedFunds;

  const disbursedFunds = Number.isFinite(Number(update.disbursedFunds))
    ? Number(update.disbursedFunds)
    : prev.disbursedFunds;

  const next: ChainDataCache = {
    ...current,
    [projectId]: {
      totalBudget,
      allocatedFunds,
      disbursedFunds,
      updatedAt: Date.now(),
    },
  };

  writeStoredChainData(next);
  return next;
};

export const updateStoredChainBudget = (
  projectId: string,
  blockchainBudget: number
): ChainBudgetsCache => {
  updateStoredChainProject(projectId, { totalBudget: blockchainBudget });
  return readStoredChainBudgets();
};

export const mergeStoredChainBudgets = (newBudgets: ChainBudgetsCache): ChainBudgetsCache => {
  const current = readStoredChainData();
  for (const [id, budget] of Object.entries(newBudgets)) {
    if (Number.isFinite(budget) && budget >= 0) {
      current[id] = {
        ...(current[id] || {}),
        totalBudget: budget,
        updatedAt: Date.now(),
      };
    }
  }
  writeStoredChainData(current);
  return readStoredChainBudgets();
};

export const clearStoredChainBudgets = () => {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(CHAIN_BUDGETS_STORAGE_KEY);
    window.localStorage.removeItem(CHAIN_DATA_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
};
