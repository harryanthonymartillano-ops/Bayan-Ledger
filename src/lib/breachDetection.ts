const BREACH_RESOLUTION_STORAGE_KEY = 'bayanledger-breach-resolution-overrides';

export type BreachResolutionOverrides = Record<string, number>;

const isBrowser = typeof window !== 'undefined';

export const readBreachResolutionOverrides = (): BreachResolutionOverrides => {
  if (!isBrowser) return {};

  try {
    const raw = window.localStorage.getItem(BREACH_RESOLUTION_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).reduce<BreachResolutionOverrides>((acc, [projectId, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        acc[projectId] = value;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const writeBreachResolutionOverrides = (overrides: BreachResolutionOverrides) => {
  if (!isBrowser) return;
  window.localStorage.setItem(BREACH_RESOLUTION_STORAGE_KEY, JSON.stringify(overrides));
};

export const setResolvedProjectBudgetOverride = (projectId: string, blockchainBudget: number) => {
  const next = {
    ...readBreachResolutionOverrides(),
    [projectId]: blockchainBudget,
  };

  writeBreachResolutionOverrides(next);
  return next;
};

export const clearResolvedProjectBudgetOverride = (projectId: string) => {
  const next = { ...readBreachResolutionOverrides() };
  delete next[projectId];
  writeBreachResolutionOverrides(next);
  return next;
};
