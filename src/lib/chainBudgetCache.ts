const CHAIN_BUDGETS_STORAGE_KEY = 'bayanledger-chain-budgets-cache';

export type ChainBudgetsCache = Record<string, number>;

const isBrowser = typeof window !== 'undefined';

export const readStoredChainBudgets = (): ChainBudgetsCache => {
  if (!isBrowser) return {};

  try {
    const raw = window.localStorage.getItem(CHAIN_BUDGETS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).reduce<ChainBudgetsCache>((acc, [projectId, value]) => {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) {
        acc[projectId] = numeric;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const writeStoredChainBudgets = (budgets: ChainBudgetsCache) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(CHAIN_BUDGETS_STORAGE_KEY, JSON.stringify(budgets));
  } catch {
    // Convenience cache only; ignore storage quota errors
  }
};

export const getStoredChainBudget = (projectId: string): number | null => {
  if (!projectId) return null;
  const budgets = readStoredChainBudgets();
  return typeof budgets[projectId] === 'number' ? budgets[projectId] : null;
};

export const updateStoredChainBudget = (projectId: string, blockchainBudget: number): ChainBudgetsCache => {
  if (!projectId || !Number.isFinite(blockchainBudget) || blockchainBudget < 0) {
    return readStoredChainBudgets();
  }

  const current = readStoredChainBudgets();
  const next = {
    ...current,
    [projectId]: blockchainBudget,
  };

  writeStoredChainBudgets(next);
  return next;
};

export const mergeStoredChainBudgets = (newBudgets: ChainBudgetsCache): ChainBudgetsCache => {
  const current = readStoredChainBudgets();
  let changed = false;
  const next = { ...current };

  for (const [id, budget] of Object.entries(newBudgets)) {
    if (Number.isFinite(budget) && budget >= 0 && next[id] !== budget) {
      next[id] = budget;
      changed = true;
    }
  }

  if (changed) {
    writeStoredChainBudgets(next);
  }

  return next;
};

export const clearStoredChainBudgets = () => {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(CHAIN_BUDGETS_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
};
