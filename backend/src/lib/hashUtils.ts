import crypto from 'crypto';

/**
 * Generate a SHA256 hash from the provided data
 */
export const generateSHA256Hash = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Generate a transaction hash for blockchain recording
 * Uses the same format as the frontend for consistency
 */
export const generateTransactionHash = (
  projectId: string,
  amount: number | string,
  type: string,
  timestamp: string,
  recordedBy: string
): string => {
  const payload = `${projectId}|${amount}|${type}|${timestamp}|${recordedBy}`;
  return generateSHA256Hash(payload);
};

/**
 * Generate a SARO allocation hash
 */
export const generateSAROHash = (
  projectId: string,
  saroRef: string,
  amount: number | string,
  budgetOfficerId: string,
  timestamp: string
): string => {
  const payload = `SARO|${projectId}|${saroRef}|${amount}|${budgetOfficerId}|${timestamp}`;
  return generateSHA256Hash(payload);
};

/**
 * Generate a milestone verification hash
 */
export const generateMilestoneVerificationHash = (
  milestoneId: string,
  projectId: string,
  verifierId: string,
  timestamp: string,
  evidenceHash?: string
): string => {
  const payload = `MILESTONE|${milestoneId}|${projectId}|${verifierId}|${timestamp}|${evidenceHash || ''}`;
  return generateSHA256Hash(payload);
};

/**
 * Generate a digital seal hash for treasurer approval
 */
export const generateDigitalSealHash = (
  transactionId: string,
  treasurerId: string,
  timestamp: string,
  amount: number | string
): string => {
  const payload = `SEAL|${transactionId}|${treasurerId}|${timestamp}|${amount}`;
  return generateSHA256Hash(payload);
};

/**
 * Generate a signature hash for budget officer sign-off
 */
export const generateSignatureHash = (
  transactionId: string,
  budgetOfficerId: string,
  timestamp: string,
  supportingHash?: string
): string => {
  const payload = `SIGNATURE|${transactionId}|${budgetOfficerId}|${timestamp}|${supportingHash || ''}`;
  return generateSHA256Hash(payload);
};

/**
 * Shorten hash for display purposes (similar to frontend)
 */
export const formatHashForDisplay = (hash: string, length: number = 16): string => {
  if (!hash) return 'N/A';
  return `${hash.substring(0, length)}...${hash.substring(hash.length - 8)}`;
};
