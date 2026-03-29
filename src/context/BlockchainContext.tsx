import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Role } from './AuthContext';
import { connectWallet, getContract, getWeb3Provider } from '../lib/web3';
import { ethers } from 'ethers';

export interface Milestone {
  id: string;
  title: string;
  description: string;
  percentage: number;
  status: 'Pending' | 'Verified' | 'Paid';
  dateVerified?: string;
  verifiedBy?: string; // MPDC user ID
  geoTag?: { lat: number; lng: number };
  photoUrl?: string;
}

export interface Document {
  id: string;
  title: string;
  type: 'Procurement' | 'Contract' | 'Personnel' | 'Other';
  url: string;
  uploadedBy: string; // Admin user ID
  dateUploaded: string;
}

export interface Transaction {
  id: string;
  projectId: string;
  amount: number;
  type: 'Allocation (SARO)' | 'Disbursement (NCA)';
  date: string;
  recordedBy: string;
  recordedByRole: Role;
  description: string;
  hash: string;
}

export interface SystemAlert {
  id: string;
  projectId: string;
  message: string;
  date: string;
  status: 'Unresolved' | 'Resolved';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userRole: string;
  details: string;
  hash: string;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  author: string;
  votes: number;
  status: 'Pending' | 'Under Review' | 'Approved for Planning' | 'Rejected';
  createdAt: string;
}

export type ProjectStatus = 'Pending' | 'Allocated' | 'In Progress' | 'Milestone Verified' | 'Completed' | 'On Hold';

export interface Project {
  id: string;
  name: string;
  description: string;
  location: string;
  category: string;
  totalBudget: number;
  allocatedFunds: number;
  disbursedFunds: number;
  status: ProjectStatus;
  milestones: Milestone[];
  documents: Document[];
  transactions: Transaction[];
  saro?: string;
  createdAt: string;
}

interface BlockchainContextType {
  projects: Project[];
  alerts: SystemAlert[];
  auditLogs: AuditLog[];
  proposals: Proposal[];
  isWeb3Connected: boolean;
  walletAddress: string | null;
  connectToWeb3: () => Promise<void>;
  addProject: (project: Omit<Project, 'id' | 'allocatedFunds' | 'disbursedFunds' | 'documents' | 'transactions' | 'status' | 'createdAt' | 'milestones'>) => Promise<void>;
  addMilestone: (projectId: string, milestone: Omit<Milestone, 'id'>) => void;
  verifyMilestone: (projectId: string, milestoneId: string, verifiedBy: string, photoUrl: string) => Promise<void>;
  addDocument: (projectId: string, document: Omit<Document, 'id'>) => void;
  addTransaction: (projectId: string, transaction: Omit<Transaction, 'id' | 'hash' | 'projectId'>, saro?: string, milestoneId?: string) => Promise<void>;
  resolveAlert: (alertId: string) => void;
  addPublicReport: (projectId: string, message: string) => void;
  addProposal: (proposal: Omit<Proposal, 'id' | 'votes' | 'status' | 'createdAt'>) => void;
  upvoteProposal: (proposalId: string) => void;
  updateProposalStatus: (proposalId: string, status: Proposal['status']) => void;
}

const mockProjects: Project[] = [
  {
    id: 'proj-001',
    name: 'Pagsawitan Drainage Repair',
    description: 'Complete repair and upgrade of the main drainage system to prevent flooding.',
    location: 'Pagsawitan',
    category: 'Infrastructure',
    totalBudget: 500000,
    allocatedFunds: 500000,
    disbursedFunds: 150000,
    status: 'In Progress',
    createdAt: '2026-01-15T08:00:00Z',
    saro: 'SARO-2026-001',
    milestones: [
      {
        id: 'm-1',
        title: 'Phase 1: Excavation',
        description: 'Initial excavation and clearing.',
        percentage: 30,
        status: 'Paid',
        dateVerified: '2026-02-15T10:00:00Z',
        verifiedBy: 'user-mpdc',
        geoTag: { lat: 14.2810, lng: 121.4111 },
        photoUrl: 'https://picsum.photos/seed/drainage1/400/300'
      },
      {
        id: 'm-2',
        title: 'Phase 2: Pipe Laying',
        description: 'Laying of new concrete pipes.',
        percentage: 60,
        status: 'Pending'
      },
      {
        id: 'm-3',
        title: 'Phase 3: Completion',
        description: 'Surface restoration and final inspection.',
        percentage: 100,
        status: 'Pending'
      }
    ],
    documents: [
      {
        id: 'doc-1',
        title: 'Initial Procurement Plan',
        type: 'Procurement',
        url: '#',
        uploadedBy: 'user-admin',
        dateUploaded: '2026-01-10T09:00:00Z'
      }
    ],
    transactions: [
      {
        id: 'tx-1',
        projectId: 'proj-001',
        amount: 500000,
        type: 'Allocation (SARO)',
        date: '2026-01-20T14:30:00Z',
        recordedBy: 'user-budget-officer',
        recordedByRole: 'Budget Officer',
        description: 'Full allocation for drainage repair',
        hash: '0x8f2a...3b9c'
      },
      {
        id: 'tx-2',
        projectId: 'proj-001',
        amount: 150000,
        type: 'Disbursement (NCA)',
        date: '2026-02-20T11:15:00Z',
        recordedBy: 'user-treasurer',
        recordedByRole: 'Treasurer',
        description: 'First tranche payment (30%)',
        hash: '0x4c1d...9e2f'
      }
    ]
  }
];

const BlockchainContext = createContext<BlockchainContextType | undefined>(undefined);

export const BlockchainProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [alerts, setAlerts] = useState<SystemAlert[]>([
    {
      id: 'alert-mock-1',
      projectId: 'proj-001',
      message: 'Public Report: The drainage repair seems to be stalled for the past week despite the app showing ongoing progress.',
      date: new Date(Date.now() - 86400000).toISOString(),
      status: 'Unresolved'
    }
  ]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: 'log-4',
      timestamp: '2026-03-29T09:04:50Z',
      action: 'Proposal Updated',
      userRole: 'MPDC (Planning)',
      details: 'Updated proposal PROP-002 to Under Review',
      hash: '0xe2f7b5863fc678dcd9b51541707ff8b0eb3444a41229e066bdccd7ee47090663'
    },
    {
      id: 'log-3',
      timestamp: '2026-03-29T09:04:29Z',
      action: 'Proposal Updated',
      userRole: 'MPDC (Planning)',
      details: 'Updated proposal PROP-001 to Approved for Planning',
      hash: '0xe61667ce77db96586e7ea70128cf21738a5f71eaacfff2fb0b44d96fdeebaf4f'
    },
    {
      id: 'log-2',
      timestamp: '2026-02-10T09:00:00Z',
      action: 'Funds Allocated',
      userRole: 'Budget Officer',
      details: 'Allocated ₱500,000 to proj-001 (SARO-2026-001)',
      hash: '0x8f7e...6d5c'
    },
    {
      id: 'log-1',
      timestamp: '2026-01-15T08:00:00Z',
      action: 'Project Created',
      userRole: 'MPDC (Planning)',
      details: 'Created project Pagsawitan Drainage Repair',
      hash: '0x1a2b...3c4d'
    }
  ]);
  const [proposals, setProposals] = useState<Proposal[]>([
    { id: 'PROP-001', title: 'Solar Street Lights in Brgy. San Jose', description: 'Install 50 solar street lights along the main road.', author: 'Maria Santos', votes: 145, status: 'Under Review', createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
    { id: 'PROP-002', title: 'Repair of Basketball Court Roof', description: 'The roof of the covered court in Brgy. Poblacion is leaking.', author: 'Juan Dela Cruz', votes: 89, status: 'Pending', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'PROP-003', title: 'New Drainage System for Purok 4', description: 'Frequent flooding in Purok 4 requires a new drainage canal.', author: 'Elena Reyes', votes: 210, status: 'Approved for Planning', createdAt: new Date(Date.now() - 86400000 * 10).toISOString() },
  ]);

  const [isWeb3Connected, setIsWeb3Connected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  useEffect(() => {
    // Check if already connected
    const checkConnection = async () => {
      const provider = getWeb3Provider();
      if (provider) {
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          const signer = await provider.getSigner();
          setWalletAddress(accounts[0].address);
          setIsWeb3Connected(true);
          const contractInstance = await getContract(signer);
          setContract(contractInstance);
        }
      }
    };
    checkConnection();
  }, []);

  const connectToWeb3 = async () => {
    try {
      const signer = await connectWallet();
      const address = await signer.getAddress();
      setWalletAddress(address);
      setIsWeb3Connected(true);
      const contractInstance = await getContract(signer);
      setContract(contractInstance);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      alert("Failed to connect wallet. Please ensure MetaMask is installed and unlocked.");
    }
  };

  const generateHash = () => {
    return '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
  };

  const logAction = (action: string, userRole: string, details: string, hash: string) => {
    setAuditLogs(prev => [{
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action,
      userRole,
      details,
      hash
    }, ...prev]);
  };

  const addProposal = (proposalData: Omit<Proposal, 'id' | 'votes' | 'status' | 'createdAt'>) => {
    const newProposal: Proposal = {
      ...proposalData,
      id: `PROP-${Date.now()}`,
      votes: 1,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    setProposals([...proposals, newProposal]);
  };

  const upvoteProposal = (proposalId: string) => {
    setProposals(proposals.map(p => p.id === proposalId ? { ...p, votes: p.votes + 1 } : p));
  };

  const updateProposalStatus = (proposalId: string, status: Proposal['status']) => {
    setProposals(proposals.map(p => p.id === proposalId ? { ...p, status } : p));
    logAction('Proposal Updated', 'MPDC (Planning)', `Updated proposal ${proposalId} to ${status}`, generateHash());
  };

  const resolveAlert = (alertId: string) => {
    setAlerts(alerts.map(a => a.id === alertId ? { ...a, status: 'Resolved' } : a));
    logAction('Alert Resolved', 'Admin / HR', `Resolved alert ${alertId}`, generateHash());
  };

  const addPublicReport = (projectId: string, message: string) => {
    setAlerts([...alerts, {
      id: `alert-${Date.now()}`,
      projectId,
      message: `Public Report: ${message}`,
      date: new Date().toISOString(),
      status: 'Unresolved'
    }]);
  };

  const addProject = async (projectData: Omit<Project, 'id' | 'allocatedFunds' | 'disbursedFunds' | 'documents' | 'transactions' | 'status' | 'createdAt' | 'milestones'>) => {
    const projectId = `proj-${Date.now()}`;
    
    let txHash = generateHash();
    if (isWeb3Connected && contract) {
      try {
        // Mocking the call since we don't have a real deployed contract
        const tx = await contract.createProject(projectId, projectData.name, projectData.totalBudget);
        await tx.wait();
        txHash = tx.hash;
        console.log("Called smart contract: createProject", projectId, projectData.name, projectData.totalBudget);
      } catch (error: any) {
        console.error("Smart contract call failed:", error);
        throw new Error(error.message || "Smart contract call failed");
      }
    }

    const newProject: Project = {
      ...projectData,
      id: projectId,
      status: 'Pending',
      allocatedFunds: 0,
      disbursedFunds: 0,
      documents: [],
      transactions: [],
      createdAt: new Date().toISOString(),
      milestones: [
        {
          id: `m-${Date.now()}-1`,
          title: 'Phase 1: Initial Progress',
          description: '30% completion of the project.',
          percentage: 30,
          status: 'Pending'
        },
        {
          id: `m-${Date.now()}-2`,
          title: 'Phase 2: Major Progress',
          description: '60% completion of the project.',
          percentage: 60,
          status: 'Pending'
        },
        {
          id: `m-${Date.now()}-3`,
          title: 'Phase 3: Completion',
          description: '100% completion and final turnover.',
          percentage: 100,
          status: 'Pending'
        }
      ]
    };
    setProjects([...projects, newProject]);
    logAction('Project Created', 'MPDC (Planning)', `Created project ${projectData.name}`, txHash);
  };

  const addMilestone = (projectId: string, milestoneData: Omit<Milestone, 'id'>) => {
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          milestones: [...p.milestones, { ...milestoneData, id: `m-${Date.now()}` }]
        };
      }
      return p;
    }));
  };

  const verifyMilestone = async (projectId: string, milestoneId: string, verifiedBy: string, photoUrl: string) => {
    let txHash = generateHash();
    if (isWeb3Connected && contract) {
      try {
        // Mocking the call
        const tx = await contract.verifyMilestone(projectId, milestoneId, 100, photoUrl || "ipfsHashPlaceholder");
        await tx.wait();
        txHash = tx.hash;
        console.log("Called smart contract: verifyMilestone", projectId, milestoneId);
      } catch (error: any) {
        console.error("Smart contract call failed:", error);
        throw new Error(error.message || "Smart contract call failed");
      }
    }

    setProjects(projects.map(p => {
      if (p.id === projectId) {
        const updatedMilestones = p.milestones.map(m => {
          if (m.id === milestoneId) {
            return {
              ...m,
              status: 'Verified' as const,
              dateVerified: new Date().toISOString(),
              verifiedBy,
              photoUrl
            };
          }
          return m;
        });
        return {
          ...p,
          status: 'Milestone Verified',
          milestones: updatedMilestones
        };
      }
      return p;
    }));
    logAction('Milestone Verified', 'MPDC (Planning)', `Verified milestone ${milestoneId} on project ${projectId}`, txHash);
  };

  const addDocument = (projectId: string, documentData: Omit<Document, 'id'>) => {
    const docId = `doc-${Date.now()}`;
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          documents: [...p.documents, { ...documentData, id: docId }]
        };
      }
      return p;
    }));
    logAction('Document Uploaded', 'Admin / HR', `Uploaded ${documentData.title} to project ${projectId}`, generateHash());
  };

  const addTransaction = async (projectId: string, txData: Omit<Transaction, 'id' | 'hash' | 'projectId'>, saro?: string, milestoneId?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    if (txData.type === 'Disbursement (NCA)' && project.disbursedFunds + txData.amount > project.allocatedFunds) {
      setAlerts([...alerts, {
        id: `alert-${Date.now()}`,
        projectId,
        message: `SYSTEM ALERT: Treasurer attempted to over-disburse funds. Requested: ${txData.amount}. Available: ${project.allocatedFunds - project.disbursedFunds}.`,
        date: new Date().toISOString(),
        status: 'Unresolved'
      }]);
      logAction('Transaction Frozen', txData.recordedByRole, `Over-disbursement attempt on project ${projectId}`, generateHash());
      throw new Error('Transaction frozen: Disbursement exceeds allocated budget.');
    }

    let txHash = generateHash();
    if (isWeb3Connected && contract) {
      try {
        if (txData.type === 'Allocation (SARO)') {
          const tx = await contract.allocateFunds(projectId, txData.amount, saro || "");
          await tx.wait();
          txHash = tx.hash;
          console.log("Called smart contract: allocateFunds", projectId, txData.amount, saro);
        } else if (txData.type === 'Disbursement (NCA)') {
          const tx = await contract.disburseFunds(projectId, milestoneId || "", txData.amount);
          await tx.wait();
          txHash = tx.hash;
          console.log("Called smart contract: disburseFunds", projectId, milestoneId, txData.amount);
        }
      } catch (error: any) {
        console.error("Smart contract call failed:", error);
        throw new Error(error.message || "Smart contract call failed");
      }
    }

    const newTx: Transaction = {
      ...txData,
      id: `tx-${Date.now()}`,
      projectId,
      hash: txHash
    };

    setProjects(projects.map(p => {
      if (p.id === projectId) {
        let newAllocated = p.allocatedFunds;
        let newDisbursed = p.disbursedFunds;
        let newStatus = p.status;

        if (txData.type === 'Allocation (SARO)') {
          newAllocated += txData.amount;
          newStatus = 'Allocated';
        } else if (txData.type === 'Disbursement (NCA)') {
          newDisbursed += txData.amount;
          newStatus = newDisbursed >= p.totalBudget ? 'Completed' : 'In Progress';
        }

        const updatedMilestones = p.milestones.map(m => {
          if (txData.type === 'Disbursement (NCA)' && m.status === 'Verified' && m.id === milestoneId) {
            return { ...m, status: 'Paid' as const };
          }
          return m;
        });

        return {
          ...p,
          allocatedFunds: newAllocated,
          disbursedFunds: newDisbursed,
          status: newStatus,
          saro: saro || p.saro,
          milestones: updatedMilestones,
          transactions: [...p.transactions, newTx]
        };
      }
      return p;
    }));
    
    logAction(txData.type, txData.recordedByRole, `Amount: ₱${txData.amount} on project ${projectId}`, newTx.hash);
  };

  return (
    <BlockchainContext.Provider value={{ 
      projects, alerts, auditLogs, proposals, 
      isWeb3Connected, walletAddress, connectToWeb3,
      addProject, addMilestone, verifyMilestone, addDocument, addTransaction, resolveAlert, addPublicReport, addProposal, upvoteProposal, updateProposalStatus 
    }}>
      {children}
    </BlockchainContext.Provider>
  );
};

export const useBlockchain = () => {
  const context = useContext(BlockchainContext);
  if (context === undefined) {
    throw new Error('useBlockchain must be used within a BlockchainProvider');
  }
  return context;
};
