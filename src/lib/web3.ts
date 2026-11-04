import { ethers } from 'ethers';

// Prefer environment-based address so redeploys do not require source edits.
export const CONTRACT_ADDRESS = (import.meta as any).env?.VITE_CONTRACT_ADDRESS || "0x4db67F3D46D212895484C24A54c5b10cA07b61F5";

export const CONTRACT_ABI = [
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
  "event ProjectCreated(string projectId, string name, uint256 totalBudget, address indexed createdBy)",
  "event ProjectMetadataRecorded(string indexed projectId, string metadataHash, address indexed recordedBy)",
  "event FundsAllocated(string projectId, uint256 amount, string saro, address indexed allocatedBy)",
  "event ProjectRejected(string indexed projectId, string status, string reason, address indexed rejectedBy)",
  "event ProjectActivated(string indexed projectId, string status, string treasurySealHash, address indexed treasurer)",
  "event DigitalSealOfTruth(string indexed projectId, uint256 amount, address indexed treasurer)",
  "event MilestoneVerified(string projectId, string milestoneId, string ipfsHash, address indexed verifiedBy)",
  "event MilestoneEvidenceRecorded(string indexed projectId, string indexed milestoneId, string evidenceHash, string reportHash, uint8 photoCount, uint8 reportCount, address recordedBy)",
  "event FundsDisbursed(string projectId, uint256 amount, address indexed disbursedBy)",
  "event DisbursementReferenceRecorded(string indexed projectId, string referenceHash, address indexed recordedBy)",
  "event PendingTransactionCreated(string indexed requestId, string indexed projectId, string indexed milestoneId, uint256 amount, address contractor, string metadataHash, address initiatedBy)",
  "event TransactionPartiallySigned(string indexed requestId, string indexed projectId, address indexed budgetOfficer, uint8 signatureCount, string supportingHash)",
  "event DisbursementDigitalSealOfTruth(string indexed requestId, string indexed projectId, string indexed milestoneId, address contractor, uint256 amount, string digitalSealHash, address treasurer)",
  "function grantRole(bytes32 role, address account) external",
  "function revokeRole(bytes32 role, address account) external",
  "function roles(bytes32, address) view returns (bool)",
  "function createProject(string memory _id, string memory _name, uint256 _totalBudget) external",
  "function createProjectWithMetadata(string memory _id, string memory _name, uint256 _totalBudget, string memory _metadataHash) external",
  "function allocateFunds(string memory _projectId, uint256 _amount, string memory _saro) external",
  "function rejectProjectByBudgetOfficer(string memory _projectId, string memory _reason) external",
  "function approveProjectActivation(string memory _projectId, string memory _treasurySealHash) external",
  "function rejectProjectByTreasurer(string memory _projectId, string memory _reason) external",
  "function verifyMilestone(string memory _projectId, string memory _milestoneId, uint8 _percentage, string memory _ipfsHash) external",
  "function verifyMilestoneWithEvidence(string memory _projectId, string memory _milestoneId, uint8 _percentage, string memory _ipfsHash, string memory _evidenceHash, string memory _reportHash, uint8 _photoCount, uint8 _reportCount) external",
  "function disburseFunds(string memory _projectId, uint256 _amount) external",
  "function disburseFundsWithReference(string memory _projectId, uint256 _amount, string memory _referenceHash) external",
  "function markMilestonePaid(string memory _projectId, string memory _milestoneId) external",
  "function createDisbursementRequest(string memory _requestId, string memory _projectId, string memory _milestoneId, address _contractor, uint256 _amount, string memory _metadataHash) external",
  "function signDisbursementRequestByBudgetOfficer(string memory _requestId, string memory _supportingHash) external",
  "function executeDisbursementRequest(string memory _requestId, string memory _digitalSealHash) external",
  "function disbursementRequests(string) view returns (string id, string projectId, string milestoneId, address contractor, uint256 amount, string metadataHash, string supportingHash, string digitalSealHash, uint256 createdAt, uint256 budgetSignedAt, uint256 treasurerSignedAt, address initiatedBy, address budgetSignedBy, address treasurerSignedBy, bool budgetSigned, bool executed, bool exists)",
  "function projects(string) view returns (string id, string name, uint256 totalBudget, uint256 allocatedFunds, uint256 disbursedFunds, string metadataHash, string latestSaroRef, string latestDisbursementRef, uint256 createdAt, address createdBy, string status, string rejectionReason, string treasurySealHash, uint256 activatedAt, bool exists)",
  "function projectMilestones(string, string) view returns (string id, uint8 percentage, bool isVerified, bool isPaid, string ipfsHash, string evidenceHash, string reportHash, uint8 photoCount, uint8 reportCount, uint256 verifiedAt, address verifiedBy)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function MPDC_ROLE() view returns (bytes32)",
  "function BUDGET_OFFICER_ROLE() view returns (bytes32)",
  "function TREASURER_ROLE() view returns (bytes32)"
];

export const getWeb3Provider = () => {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return new ethers.providers.Web3Provider((window as any).ethereum);
  }
  return null;
};

// --- Reliable Sepolia RPC endpoints (multiple fallbacks) ---
// Ordered by reliability: publicnode and drpc are the most stable free providers
const SEPOLIA_PUBLIC_RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.drpc.org",
  "https://rpc2.sepolia.org",
  "https://sepolia.gateway.tenderly.co",
  "https://1rpc.io/sepolia",
];

// These are the same RPCs MetaMask should use when adding the Sepolia network
export const SEPOLIA_METAMASK_RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.drpc.org",
  "https://rpc2.sepolia.org",
];

// Track which RPC index is currently active (rotates on failure)
let currentRpcIndex = 0;
let lastProviderCreatedAt = 0;

/**
 * Creates a read-only provider with automatic fallback across multiple RPCs.
 * If the current RPC fails, the next call will rotate to the next one.
 */
export const getReadOnlyWeb3Provider = (): ethers.providers.JsonRpcProvider => {
  const customRpc = (import.meta as any).env?.VITE_SEPOLIA_RPC_URL;
  const validCustom =
    customRpc && !customRpc.includes('94868e8cc29b45c39a4fb474e5fae485')
      ? customRpc
      : null;

  // If a custom RPC is set (e.g., Alchemy/Infura with valid key), prefer it
  if (validCustom) {
    return new ethers.providers.JsonRpcProvider({
      url: validCustom,
      timeout: 15000,
    });
  }

  const rpcUrl = SEPOLIA_PUBLIC_RPCS[currentRpcIndex % SEPOLIA_PUBLIC_RPCS.length];
  lastProviderCreatedAt = Date.now();
  return new ethers.providers.JsonRpcProvider({
    url: rpcUrl,
    timeout: 15000,
  });
};

/**
 * Rotate to the next RPC endpoint after a failure.
 */
export const rotateRpcEndpoint = (): void => {
  const previousIndex = currentRpcIndex;
  currentRpcIndex = (currentRpcIndex + 1) % SEPOLIA_PUBLIC_RPCS.length;
  console.warn(
    `[web3] RPC rotated: ${SEPOLIA_PUBLIC_RPCS[previousIndex]} → ${SEPOLIA_PUBLIC_RPCS[currentRpcIndex]}`
  );
};

/**
 * Execute a read-only call with automatic RPC fallback.
 * Tries each RPC endpoint in sequence until one succeeds.
 */
export const withRpcFallback = async <T>(
  fn: (provider: ethers.providers.JsonRpcProvider) => Promise<T>
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < SEPOLIA_PUBLIC_RPCS.length; attempt++) {
    const provider = getReadOnlyWeb3Provider();
    try {
      const result = await fn(provider);
      return result;
    } catch (error: any) {
      lastError = error;
      const msg = (error?.message || '').toLowerCase();

      // Don't rotate for contract-level reverts — those aren't RPC issues
      if (msg.includes('execution reverted') || msg.includes('call revert')) {
        throw error;
      }

      console.warn(
        `[web3] RPC call failed on ${SEPOLIA_PUBLIC_RPCS[currentRpcIndex % SEPOLIA_PUBLIC_RPCS.length]}: ${error?.message || error}`
      );
      rotateRpcEndpoint();
    }
  }

  throw lastError;
};

/**
 * Wait for a transaction with retry logic.
 * If tx.wait() fails due to a network hiccup, retries up to `maxRetries` times
 * with exponential backoff.
 */
export const waitForTransaction = async (
  tx: ethers.providers.TransactionResponse,
  confirmations = 1,
  maxRetries = 3
): Promise<ethers.providers.TransactionReceipt> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const receipt = await tx.wait(confirmations);
      return receipt;
    } catch (error: any) {
      const msg = (error?.message || '').toLowerCase();

      // Don't retry if the transaction itself was reverted on chain
      if (
        msg.includes('transaction failed') ||
        msg.includes('execution reverted') ||
        msg.includes('transaction was replaced') ||
        error?.code === 'TRANSACTION_REPLACED'
      ) {
        throw error;
      }

      // Network/timeout errors — worth retrying
      if (attempt < maxRetries) {
        const backoffMs = Math.min(2000 * Math.pow(2, attempt), 10000);
        console.warn(
          `[web3] tx.wait() attempt ${attempt + 1}/${maxRetries + 1} failed (${msg}), retrying in ${backoffMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      } else {
        throw error;
      }
    }
  }

  // TypeScript: should never reach here, but just in case
  throw new Error('Transaction confirmation failed after all retry attempts.');
};

export const getContract = async (signerOrProvider: ethers.Signer | ethers.providers.Provider) => {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
};

export const connectWallet = async () => {
  const provider = getWeb3Provider();
  if (!provider) {
    throw new Error("MetaMask or Web3 wallet is not installed.");
  }
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  return signer;
};
