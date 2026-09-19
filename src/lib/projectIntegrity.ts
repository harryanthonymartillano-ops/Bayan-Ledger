export const formatPhpCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount);

export const isProjectTampered = (databasePrice: number, blockchainPrice: number) => {
  if (!Number.isFinite(databasePrice) || !Number.isFinite(blockchainPrice)) return false;
  // If database price has decimals and blockchain stores the integer amount (rounded),
  // allow sub-peso fractional centavo difference (< 1.00) if rounded values match.
  if (Math.abs(databasePrice - blockchainPrice) < 1 && Math.round(databasePrice) === Math.round(blockchainPrice)) {
    return false;
  }
  return databasePrice !== blockchainPrice;
};

export const normalizeTransactionHash = (transactionHash?: string | null) => {
  const trimmed = String(transactionHash || '').trim();
  return /^0x[a-fA-F0-9]{64}$/.test(trimmed) ? trimmed : '';
};

export const buildSepoliaEtherscanUrl = (transactionHash?: string | null) => {
  const safeHash = normalizeTransactionHash(transactionHash);
  return safeHash ? `https://sepolia.etherscan.io/tx/${safeHash}` : '';
};
