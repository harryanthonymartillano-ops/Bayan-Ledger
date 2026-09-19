import CryptoJS from 'crypto-js';

export const generateSHA256Hash = (data: string): string => {
  return CryptoJS.SHA256(data).toString();
};

export const generateTransactionHash = (
  projectId: string,
  amount: number,
  type: string,
  timestamp: string,
  recordedBy: string
): string => {
  const payload = `${projectId}|${amount}|${type}|${timestamp}|${recordedBy}`;
  return generateSHA256Hash(payload);
};

export const formatHashForDisplay = (hash: string, length: number = 16): string => {
  if (!hash) return 'N/A';
  return `${hash.substring(0, length)}...${hash.substring(hash.length - 8)}`;
};

export const getHashColor = (hash: string): string => {
  const charCode = hash.charCodeAt(0);
  const colors = ['bg-blue-100', 'bg-purple-100', 'bg-green-100', 'bg-yellow-100', 'bg-pink-100'];
  return colors[charCode % colors.length];
};
