export const formatPhpCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount);

export const isProjectTampered = (databasePrice: number, blockchainPrice: number) => {
  if (!Number.isFinite(databasePrice) || !Number.isFinite(blockchainPrice)) return false;
  // If database price has decimals and blockchain stores the integer amount (rounded or truncated),
  // allow sub-peso fractional centavo difference (< 1.00)
  if (Math.abs(databasePrice - blockchainPrice) < 1) {
    return false;
  }
  return databasePrice !== blockchainPrice;
};

export interface ProjectTamperCheck {
  isTampered: boolean;
  budgetTampered: boolean;
  allocatedTampered: boolean;
  disbursedTampered: boolean;
  dbBudget: number;
  chainBudget?: number;
  dbAllocated: number;
  chainAllocated?: number;
  dbDisbursed: number;
  chainDisbursed?: number;
  tamperSummary: string;
}

export const checkProjectTampering = (
  project: { totalBudget?: number; allocatedFunds?: number; disbursedFunds?: number },
  chainData?: { totalBudget?: number; allocatedFunds?: number; disbursedFunds?: number } | null
): ProjectTamperCheck => {
  const dbBudget = Number(project?.totalBudget || 0);
  const dbAllocated = Number(project?.allocatedFunds || 0);
  const dbDisbursed = Number(project?.disbursedFunds || 0);

  const chainBudget =
    chainData && typeof chainData.totalBudget === 'number' && Number.isFinite(chainData.totalBudget)
      ? chainData.totalBudget
      : undefined;

  const chainAllocated =
    chainData && typeof chainData.allocatedFunds === 'number' && Number.isFinite(chainData.allocatedFunds)
      ? chainData.allocatedFunds
      : undefined;

  const chainDisbursed =
    chainData && typeof chainData.disbursedFunds === 'number' && Number.isFinite(chainData.disbursedFunds)
      ? chainData.disbursedFunds
      : undefined;

  const budgetTampered = chainBudget !== undefined && isProjectTampered(dbBudget, chainBudget);
  const allocatedTampered = chainAllocated !== undefined && isProjectTampered(dbAllocated, chainAllocated);
  const disbursedTampered = chainDisbursed !== undefined && isProjectTampered(dbDisbursed, chainDisbursed);

  const isTampered = budgetTampered || allocatedTampered || disbursedTampered;

  const reasons: string[] = [];
  if (budgetTampered) reasons.push('Total Budget Mismatch');
  if (allocatedTampered) reasons.push('Allocated Funds (SARO) Mismatch');
  if (disbursedTampered) reasons.push('Disbursed Funds (NCA) Mismatch');

  return {
    isTampered,
    budgetTampered,
    allocatedTampered,
    disbursedTampered,
    dbBudget,
    chainBudget,
    dbAllocated,
    chainAllocated,
    dbDisbursed,
    chainDisbursed,
    tamperSummary: reasons.join(' & '),
  };
};

export const normalizeTransactionHash = (transactionHash?: string | null) => {
  const trimmed = String(transactionHash || '').trim();
  return /^0x[a-fA-F0-9]{64}$/.test(trimmed) ? trimmed : '';
};

export const buildSepoliaEtherscanUrl = (transactionHash?: string | null) => {
  const safeHash = normalizeTransactionHash(transactionHash);
  return safeHash ? `https://sepolia.etherscan.io/tx/${safeHash}` : '';
};
