import { ethers } from 'ethers';

// This would be the address of the contract deployed on Polygon Sepolia
export const CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"; 

export const CONTRACT_ABI = [
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
  "event ProjectCreated(string projectId, string name, uint256 totalBudget, address indexed createdBy)",
  "event FundsAllocated(string projectId, uint256 amount, string saro, address indexed allocatedBy)",
  "event MilestoneVerified(string projectId, string milestoneId, string ipfsHash, address indexed verifiedBy)",
  "event FundsDisbursed(string projectId, uint256 amount, address indexed disbursedBy)",
  "function grantRole(bytes32 role, address account) external",
  "function revokeRole(bytes32 role, address account) external",
  "function createProject(string memory _id, string memory _name, uint256 _totalBudget) external",
  "function allocateFunds(string memory _projectId, uint256 _amount, string memory _saro) external",
  "function verifyMilestone(string memory _projectId, string memory _milestoneId, uint8 _percentage, string memory _ipfsHash) external",
  "function disburseFunds(string memory _projectId, uint256 _amount) external",
  "function projects(string) view returns (string id, string name, uint256 totalBudget, uint256 allocatedFunds, uint256 disbursedFunds, bool exists)",
  "function projectMilestones(string, string) view returns (string id, uint8 percentage, bool isVerified, string ipfsHash)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function MPDC_ROLE() view returns (bytes32)",
  "function BUDGET_OFFICER_ROLE() view returns (bytes32)",
  "function TREASURER_ROLE() view returns (bytes32)"
];

export const getWeb3Provider = () => {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return new ethers.BrowserProvider((window as any).ethereum);
  }
  return null;
};

export const getContract = async (signerOrProvider: ethers.Signer | ethers.Provider) => {
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
