import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { Role, useAuth } from './AuthContext';
import { connectWallet, getContract, getWeb3Provider, getReadOnlyWeb3Provider } from '../lib/web3';
import { uploadToIPFS, generateVerificationHash } from '../lib/ipfs';
import { generateTransactionHash } from '../lib/hashUtils';
import apiClient from '../lib/apiClient';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS } from '../lib/web3';
import { readStoredChainBudgets, writeStoredChainBudgets, updateStoredChainBudget } from '../lib/chainBudgetCache';
import { readBreachResolutionOverrides } from '../lib/breachDetection';
import { isProjectTampered } from '../lib/projectIntegrity';
import { readStoredProjects, writeStoredProjects, hasStoredProjects } from '../lib/projectCache';

const deployedSelectorSupportCache = new Map<string, boolean>();

export interface Milestone {
  id: string;
  title: string;
  description: string;
  deliverables?: string[];
  percentage: number;
  dueDate?: string;
  status: 'Pending' | 'Verified' | 'Paid';
  dateVerified?: string;
  verifiedBy?: string; // MPDC user ID
  verifiedByRole?: Role;
  geoTag?: { lat: number; lng: number };
  photos?: MilestonePhoto[]; // Array of before/after photos
  photoUrl?: string;
  evidenceHash?: string;
  reportHash?: string;
  evidencePhotoCount?: number;
  evidenceReportCount?: number;
  onChainVerifiedAt?: string;
  onChainVerifiedBy?: string;
  onChainPaid?: boolean;
}

export interface MilestonePhoto {
  id: string;
  type: 'before' | 'after' | 'proof';
  url: string;
  photoHash: string;
  ipfsHash?: string;
  geoTag?: { lat: number; lng: number };
  timestamp: string;
  description?: string;
  uploadedBy: string;
}

export interface Document {
  id: string;
  milestoneId?: string;
  title: string;
  type: 'Procurement' | 'Contract' | 'Personnel' | 'Other' | 'Report' | 'Invoice';
  url: string;
  fileFormat?: 'PDF' | 'JPEG' | 'PNG' | 'DOCX' | 'OTHER';
  uploadedBy: string;
  dateUploaded: string;
  ipfsHash: string; // SHA-256 hash simulating IPFS
  size: number; // File size in bytes
  version: number;
  previousVersion?: string;
  verified: boolean;
  verifiedBy?: string;
  verifiedDate?: string;
  checksumHash: string;
}

export interface DepartmentBudget {
  department: string;
  allocatedBudget: number;
  spentBudget: number;
  projectCount: number;
}

export interface ComplianceScore {
  projectId: string;
  totalScore: number; // 0-100
  documentScore: number;
  milestoneScore: number;
  budgetScore: number;
  auditScore: number;
  lastUpdated: string;
}

export type TransactionStatus =
  | 'Pending Transaction'
  | '1/2 Signed'
  | 'Executed'
  | 'Completed'
  | 'Rejected - Budget Officer'
  | 'Rejected - Treasurer';

export interface Transaction {
  id: string;
  projectId: string;
  milestoneId?: string;
  amount: number;
  type: 'Allocation (SARO)' | 'Disbursement (NCA)';
  status: TransactionStatus;
  date: string;
  initiatedBy?: string;
  recordedBy: string;
  recordedByRole: Role;
  description: string;
  hash: string;
  contractorAddress?: string;
  requestMetadataHash?: string;
  supportingHash?: string;
  signatureCount?: number;
  budgetSignedAt?: string;
  treasurerSignedAt?: string;
  requestTxHash?: string;
  digitalSealHash?: string;
  rejectionReason?: string;
  rejectedByRole?: string;
}

export interface SystemAlert {
  id: string;
  projectId: string;
  message: string;
  date: string;
  status: 'Unresolved' | 'Resolved';
  alertType?: string;
  severity?: 'CRITICAL' | 'WARNING' | 'INFO';
  details?: Record<string, unknown>;
}

export interface ApprovalStage {
  id: string;
  stage: 'MPDC Project Approval' | 'Budget Allocation' | 'Treasury Activation' | 'MPDC Verification' | 'Treasurer Disbursement';
  status: 'Pending' | 'Verified' | 'Rejected';
  approvedBy: string; // User name
  approvedByRole: Role;
  timestamp: string;
  signature: string; // Digital signature/hash
  comments?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userRole: string;
  details: string;
  hash: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  actorName?: string;
  actorWallet?: string | null;
  rawDetails?: unknown;
}

export interface ProposalSupportingDocument {
  id?: string;
  name?: string;
  url?: string;
  cid?: string;
  size?: number;
  uploadedAt: string;
  docType?: string;
  ipfsHash?: string;
}

export interface ProposalMilestonePlan {
  title: string;
  description: string;
  deliverables?: string[];
  percentage: number;
  dueDate?: string;
}

export interface Proposal {
  id: string;
  projectName: string;
  description: string;
  location: string;
  category: string;
  budget: number;
  proposedBy: string; // department name
  status: 'Pending Review' | 'Under Review' | 'Approved' | 'Rejected' | 'Revision Requested' | 'Canceled';
  createdAt: string;
  submittedBy: string; // user ID
  revisionComments?: string;
  lastUpdatedAt?: string;
  metadataHash?: string;
  supportingHash?: string;
  supportingDocuments?: ProposalSupportingDocument[];
  supportingDocumentName?: string;
  supportingDocumentUrl?: string;
  draftMilestones?: ProposalMilestonePlan[];
  version?: number;
  submittingOfficialWallet?: string;
  lastTransactionHash?: string;
  onChainSubmittedAt?: string;
  onChainUpdatedAt?: string;
  isOnChain?: boolean;
}

type ProposalInput = Omit<Proposal, 'id' | 'status' | 'createdAt'>;
type ProjectInput = Omit<Project, 'id' | 'allocatedFunds' | 'disbursedFunds' | 'documents' | 'transactions' | 'status' | 'createdAt' | 'milestones' | 'approvalStages'> & {
  milestones: ProposalMilestonePlan[];
};

export type ProjectStatus =
  | 'MPDC Approved'
  | 'SARO Approved - Pending Treasurer'
  | 'ACTIVE'
  | 'In Progress'
  | 'Completed'
  | 'Rejected - Budget Officer'
  | 'Rejected - Treasurer'
  | 'On Hold';

export interface Project {
  id: string;
  name: string;
  description: string;
  location: string;
  category: string;
  budgetSource?: string;
  locationPhotos?: string[];
  startDate?: string;
  endDate?: string;
  stakeholders?: string[];
  totalBudget: number;
  allocatedFunds: number;
  disbursedFunds: number;
  status: ProjectStatus;
  milestones: Milestone[];
  documents: Document[];
  transactions: Transaction[];
  saro?: string;
  createdAt: string;
  metadataHash?: string;
  blockchainTxHash?: string;
  latestDisbursementRef?: string;
  createdByWallet?: string;
  onChainSyncedAt?: string;
  approvalStages?: ApprovalStage[];
  departmentBudget?: DepartmentBudget;
  complianceScore?: ComplianceScore;
  rejectionReason?: string;
  rejectedByRole?: string;
  budgetOfficerSignedAt?: string;
  budgetOfficerWallet?: string;
  treasurerSignedAt?: string;
  treasurerWallet?: string;
  treasurySealHash?: string;
  activatedAt?: string;
}

export interface BlockchainContextType {
  projects: Project[];
  alerts: SystemAlert[];
  auditLogs: AuditLog[];
  proposals: Proposal[];
  isLoading: boolean;
  isWeb3Connected: boolean;
  walletAddress: string | null;
  chainId: string | null;
  contract: ethers.Contract | null;
  connectToWeb3: () => Promise<void>;
  disconnectWallet: () => void;
  addProject: (project: ProjectInput) => Promise<void>;
  addMilestone: (projectId: string, milestone: Omit<Milestone, 'id'>) => Promise<void>;
  verifyMilestone: (
    projectId: string,
    milestoneId: string,
    verifiedBy: string,
    photoUrl: string,
    evidence?: { evidenceHash: string; reportHash: string; photoCount: number; reportCount: number }
  ) => Promise<void>;
  addDocument: (projectId: string, document: Omit<Document, 'id'>) => void;
  addTransaction: (projectId: string, transaction: Omit<Transaction, 'id' | 'hash' | 'projectId' | 'status'> & { status?: TransactionStatus }, saro?: string, milestoneId?: string) => Promise<void>;
  createDisbursementRequest: (projectId: string, milestoneId: string, contractorAddress: string) => Promise<void>;
  signDisbursementRequest: (projectId: string, transactionId: string, supportingHash?: string) => Promise<void>;
  processPayment: (projectId: string, milestoneId: string) => Promise<void>;
  activateProject: (projectId: string) => Promise<void>;
  rejectProjectBudget: (projectId: string, reason: string) => Promise<void>;
  rejectProjectTreasury: (projectId: string, transactionId: string, reason: string) => Promise<void>;
  grantRole: (role: string, walletAddress: string) => Promise<string>;
  revokeRole: (role: string, walletAddress: string) => Promise<string>;
  hasRole: (role: string, walletAddress: string) => Promise<boolean>;
  resolveAlert: (alertId: string) => void;
  addPublicReport: (projectId: string, message: string) => void;
  addProposal: (proposal: ProposalInput) => Promise<void>;
  updateProposal: (proposalId: string, proposal: ProposalInput) => Promise<void>;
  cancelProposal: (proposalId: string) => Promise<void>;
  submitProposalToChain: (proposal: ProposalInput) => Promise<void>;
  updateProposalMetadataOnChain: (proposal: ProposalInput & { id: string }) => Promise<void>;
  updateProposalStatus: (proposalId: string, status: Proposal['status'], comments?: string) => Promise<void>;
  recordApproval: (projectId: string, stage: ApprovalStage['stage'], approvedBy: string, approvedByRole: Role, comments?: string) => void;
  getProjectApprovals: (projectId: string) => ApprovalStage[];
  calculateComplianceScore: (projectId: string) => ComplianceScore;
  getAllDepartmentBudgets: () => DepartmentBudget[];
  uploadDocumentWithHash: (projectId: string, document: Omit<Document, 'id' | 'ipfsHash' | 'checksumHash'>, file: File, milestoneId?: string) => Promise<void>;
  addMilestonePhoto: (projectId: string, milestoneId: string, photo: Omit<MilestonePhoto, 'id'>, file: File) => Promise<void>;
  checkMilestoneVerificationRequirements: (projectId: string, milestoneId: string) => { isReady: boolean; photoCount: number; reportCount: number; missingPhotos: number; missingReports: number };
  refreshProjectFromChain: (projectId: string) => Promise<void>;
  chainBudgets: Record<string, number>;
  tamperedProjects: Array<{ id: string; chainBudget: number; databaseBudget: number }>;
  refreshChainBudgets: () => Promise<Record<string, number>>;
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
        photoUrl: 'https://picsum.photos/seed/drainage1/400/300',
        photos: [
          {
            id: 'photo-1',
            type: 'before',
            url: 'https://picsum.photos/seed/drainage-before/600/400',
            photoHash: '0xbf7a8e9c2d4f6e3a1b8c5d9e7f2a3b6c8d1e4f5a7b9c2d3e6f8a0b1c4d5e7f',
            geoTag: { lat: 14.2810, lng: 121.4111 },
            timestamp: '2026-02-10T08:30:00Z',
            description: 'Before excavation - showing current drainage condition',
            uploadedBy: 'user-mpdc'
          },
          {
            id: 'photo-2',
            type: 'after',
            url: 'https://picsum.photos/seed/drainage-after/600/400',
            photoHash: '0xa4d2c8e9f1b3a5c7e9d2f4a6b8d0e2f4a6c8e0f2a4c6e8f0a2b4c6d8e0f1a2',
            geoTag: { lat: 14.2810, lng: 121.4111 },
            timestamp: '2026-02-15T14:00:00Z',
            description: 'After excavation - foundation prepared for pipe laying',
            uploadedBy: 'user-mpdc'
          },
          {
            id: 'photo-3',
            type: 'proof',
            url: 'https://picsum.photos/seed/drainage-verified/600/400',
            photoHash: '0xe7f3a2b5c8d1e4f7a0b3c6d9e1f4a7b9c1d4e6f8a0b2c4d6e8f0a1b3c5d6f8',
            geoTag: { lat: 14.2810, lng: 121.4111 },
            timestamp: '2026-02-15T15:30:00Z',
            description: 'Completion verification - site inspection by MPDC officer',
            uploadedBy: 'Maria Santos'
          }
        ]
      },
      {
        id: 'm-2',
        title: 'Phase 2: Pipe Laying',
        description: 'Laying of new concrete pipes.',
        percentage: 40,
        status: 'Pending'
      },
      {
        id: 'm-3',
        title: 'Phase 3: Completion',
        description: 'Surface restoration and final inspection.',
        percentage: 30,
        status: 'Pending'
      }
    ],
    documents: [
      {
        id: 'doc-1',
        title: 'Initial Procurement Plan',
        type: 'Procurement',
        url: '#/documents/procurement-plan.pdf',
        fileFormat: 'PDF',
        uploadedBy: 'user-admin',
        dateUploaded: '2026-01-10T09:00:00Z',
        ipfsHash: '0xQmY7sSv9ylWrwboiXiCn4E8Q5X5DG4V6CcDyzmt42Wydu',
        checksumHash: '0x3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d',
        size: 245000,
        version: 1,
        verified: true,
        verifiedBy: 'Juan Reyes',
        verifiedDate: '2026-01-12T10:30:00Z'
      },
      {
        id: 'doc-2',
        title: 'Phase 1 - Excavation Progress Report',
        type: 'Report',
        url: '#/reports/phase-1-excavation-report.pdf',
        fileFormat: 'PDF',
        uploadedBy: 'user-mpdc',
        dateUploaded: '2026-02-16T09:00:00Z',
        ipfsHash: '0xQmX8tYu2RhV7rWm5qNp8oL9sJ6kI3hG4eF5dC2bR8aW9x',
        checksumHash: '0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a',
        size: 156000,
        version: 1,
        verified: true,
        verifiedBy: 'Maria Santos',
        verifiedDate: '2026-02-16T14:00:00Z'
      }
    ],
    transactions: [
      {
        id: 'tx-1',
        projectId: 'proj-001',
        amount: 500000,
        type: 'Allocation (SARO)',
        status: 'Completed',
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
        status: 'Executed',
        date: '2026-02-20T11:15:00Z',
        recordedBy: 'user-treasurer',
        recordedByRole: 'Treasurer',
        description: 'First tranche payment (30%)',
        hash: '0x4c1d...9e2f'
      }
    ],
    approvalStages: [
      {
        id: 'approval-1',
        stage: 'MPDC Verification',
        status: 'Verified',
        approvedBy: 'Maria Santos',
        approvedByRole: 'MPDC (Planning)',
        timestamp: '2026-01-18T09:30:00Z',
        signature: '0x8a92c4a83e7b3c9d2e1f6a5b8c7d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5',
        comments: 'Project approved. Meets all MPDC criteria and budget guidelines.'
      },
      {
        id: 'approval-2',
        stage: 'Budget Allocation',
        status: 'Verified',
        approvedBy: 'Juan Reyes',
        approvedByRole: 'Budget Officer',
        timestamp: '2026-01-20T14:45:00Z',
        signature: '0x6f4e2d8a9c1b3e7f5a4c2d9e8f1a3b6c7d5e4f2a1b8c9d0e3f4a5b6c7d8e9f',
        comments: 'SARO allocation approved: ₱500,000. Document reference SARO-2026-001.'
      },
      {
        id: 'approval-3',
        stage: 'Treasurer Disbursement',
        status: 'Verified',
        approvedBy: 'Ana Reyes',
        approvedByRole: 'Treasurer',
        timestamp: '2026-02-20T11:45:00Z',
        signature: '0x3c7f9e2b4a1d8c6f5e3a2b9d8c7e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
        comments: 'First tranche disbursed upon milestone verification.'
      }
    ]
  },
  {
    id: 'proj-002',
    name: 'Municipal Evacuation Center Repairs',
    description: 'Structural repair and interior restoration of the evacuation center to prepare it for the next funding release.',
    location: 'Evacuation Center Compound, Poblacion, Sta. Cruz',
    category: 'Social Services',
    totalBudget: 850000,
    allocatedFunds: 0,
    disbursedFunds: 0,
    status: 'MPDC Approved',
    createdAt: '2026-03-18T08:30:00Z',
    milestones: [
      {
        id: 'm-002-1',
        title: 'Phase 1: Site Preparation',
        description: 'Detailed inspection, clearing, and mobilization.',
        percentage: 30,
        status: 'Pending'
      },
      {
        id: 'm-002-2',
        title: 'Phase 2: Core Repairs',
        description: 'Roofing, ceiling, and wall reinforcement works.',
        percentage: 40,
        status: 'Pending'
      },
      {
        id: 'm-002-3',
        title: 'Phase 3: Final Turnover',
        description: 'Punch listing, cleanup, and final acceptance.',
        percentage: 30,
        status: 'Pending'
      }
    ],
    documents: [],
    transactions: [],
    approvalStages: [
      {
        id: 'approval-002-1',
        stage: 'MPDC Verification',
        status: 'Verified',
        approvedBy: 'Maria Santos',
        approvedByRole: 'MPDC (Planning)',
        timestamp: '2026-03-19T10:00:00Z',
        signature: '0x9d7f2b4e8c6a1d3f5e7b9c0a2d4f6b8c1e3a5d7f9b2c4e6a8d0f1b3c5e7a9',
        comments: 'Project validated and ready for Budget Officer SARO tagging.'
      }
    ]
  },
  {
    id: 'proj-003',
    name: 'Treasury Office Network Upgrade',
    description: 'Replacement of network switches, structured cabling, and server rack accessories for treasury operations.',
    location: 'Treasury Office, Municipal Hall, Sta. Cruz',
    category: 'Infrastructure',
    totalBudget: 420000,
    allocatedFunds: 420000,
    disbursedFunds: 0,
    status: 'In Progress',
    createdAt: '2026-03-05T09:15:00Z',
    saro: 'SARO-2026-003',
    milestones: [
      {
        id: 'm-003-1',
        title: 'Phase 1: Equipment Delivery',
        description: 'Delivery and installation of network equipment.',
        percentage: 40,
        status: 'Verified',
        dateVerified: '2026-03-25T13:30:00Z',
        verifiedBy: 'user-mpdc-1',
        verifiedByRole: 'MPDC (Planning)',
        photoUrl: 'https://picsum.photos/seed/network-upgrade/400/300',
        onChainVerifiedAt: '2026-03-25T13:30:00Z'
      },
      {
        id: 'm-003-2',
        title: 'Phase 2: Configuration',
        description: 'Switch configuration, testing, and failover checks.',
        percentage: 35,
        status: 'Pending'
      },
      {
        id: 'm-003-3',
        title: 'Phase 3: Full Deployment',
        description: 'Full office rollout and turnover.',
        percentage: 25,
        status: 'Pending'
      }
    ],
    documents: [
      {
        id: 'doc-003-1',
        title: 'Network Upgrade Inspection Report',
        type: 'Report',
        url: '#/reports/network-upgrade-inspection.pdf',
        fileFormat: 'PDF',
        uploadedBy: 'user-mpdc-1',
        dateUploaded: '2026-03-25T14:00:00Z',
        ipfsHash: '0xQmZ4uN7pHs2Lm9Qf5Ar8Tw1Yk6Bc3Dv0Rp7Sa1Xe9Gh2m',
        checksumHash: '0x7b1d2f3a4c5e6b7d8f9a0c1e2d3f4b5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e',
        size: 189000,
        version: 1,
        verified: true,
        verifiedBy: 'Maria Santos',
        verifiedDate: '2026-03-25T14:10:00Z'
      }
    ],
    transactions: [
      {
        id: 'tx-003-1',
        projectId: 'proj-003',
        amount: 420000,
        type: 'Allocation (SARO)',
        status: 'Completed',
        date: '2026-03-12T09:45:00Z',
        recordedBy: 'user-budget-1',
        recordedByRole: 'Budget Officer',
        description: 'Full SARO allocation for treasury network upgrade',
        hash: '0x3e7c1d9a5b4f2c8d6e1a3b7c9d0e2f4a6c8e0b2d4f6a8c1e3d5f7a9b0c2d4'
      }
    ],
    approvalStages: [
      {
        id: 'approval-003-1',
        stage: 'MPDC Verification',
        status: 'Verified',
        approvedBy: 'Maria Santos',
        approvedByRole: 'MPDC (Planning)',
        timestamp: '2026-03-10T08:45:00Z',
        signature: '0x1c3e5a7d9f2b4c6e8a0d1f3b5c7e9a2d4f6b8c1e3a5d7f9b2c4e6a8d0f1b3',
        comments: 'Initial project verification completed.'
      },
      {
        id: 'approval-003-2',
        stage: 'Budget Allocation',
        status: 'Verified',
        approvedBy: 'Juan Dela Cruz',
        approvedByRole: 'Budget Officer',
        timestamp: '2026-03-12T09:50:00Z',
        signature: '0x4f6a8c1e3d5f7a9b0c2d4e6f8a1b3c5d7e9f2a4c6e8b0d1f3a5c7e9b2d4f6',
        comments: 'SARO approved. Project is ready once MPDC milestone verification is posted.'
      }
    ]
  }
];

const BlockchainContext = createContext<BlockchainContextType | undefined>(undefined);

const mapProposalDocumentFromApi = (document: any): ProposalSupportingDocument => ({
  id: document.id,
  name: document.name || document.title || document.docType || 'Supporting document',
  url: document.url,
  cid: document.ipfs_hash || document.ipfsHash || document.cid || document.url,
  size: Number(document.size || 0),
  uploadedAt: document.date_uploaded || document.uploadedAt || document.created_at || new Date().toISOString(),
  docType: document.docType || document.name || document.title || 'Supporting document',
  ipfsHash: document.ipfs_hash || document.ipfsHash || document.cid || document.url,
});

const mapDraftMilestoneFromApi = (milestone: any): ProposalMilestonePlan => ({
  title: milestone.title || '',
  description: milestone.description || '',
  deliverables: Array.isArray(milestone.deliverables) ? milestone.deliverables : [],
  percentage: Number(milestone.percentage || 0),
  dueDate: milestone.due_date || milestone.dueDate || undefined,
});

const mapProposalFromApi = (proposal: any): Proposal => {
  const supportingDocuments = Array.isArray(proposal.supportingDocuments)
    ? proposal.supportingDocuments.map(mapProposalDocumentFromApi)
    : [];
  const draftMilestones = Array.isArray(proposal.draft_milestones || proposal.draftMilestones)
    ? (proposal.draft_milestones || proposal.draftMilestones).map(mapDraftMilestoneFromApi)
    : [];

  return {
    id: proposal.id,
    projectName: proposal.project_name || proposal.projectName || proposal.title,
    description: proposal.description || '',
    location: proposal.location || '',
    category: proposal.category || '',
    budget: Number(proposal.budget || 0),
    proposedBy: proposal.proposed_by || proposal.proposedBy || proposal.author || '',
    status: proposal.status,
    createdAt: proposal.created_at || proposal.createdAt || new Date().toISOString(),
    submittedBy: proposal.submitted_by || proposal.submittedBy || '',
    revisionComments: proposal.comments || proposal.revisionComments || undefined,
    lastUpdatedAt: proposal.updated_at || proposal.lastUpdatedAt || undefined,
    metadataHash: proposal.metadata_hash || proposal.metadataHash || undefined,
    supportingHash: proposal.supporting_hash || proposal.supportingHash || undefined,
    supportingDocuments,
    supportingDocumentName: supportingDocuments[0]?.name,
    supportingDocumentUrl: supportingDocuments[0]?.url,
    draftMilestones,
    version: Number(proposal.version || 1),
    submittingOfficialWallet: proposal.submitting_official_wallet || proposal.submittingOfficialWallet || proposal.proposer_wallet || proposal.proposerWallet || undefined,
    lastTransactionHash: proposal.blockchain_tx_hash || proposal.blockchainTxHash || undefined,
    onChainSubmittedAt: proposal.created_at || proposal.onChainSubmittedAt || undefined,
    onChainUpdatedAt: proposal.updated_at || proposal.onChainUpdatedAt || undefined,
    isOnChain: Boolean(proposal.blockchain_tx_hash || proposal.blockchainTxHash),
  };
};

const normalizeProjectStatus = (status: string | undefined): ProjectStatus => {
  if (
    status === 'MPDC Approved' ||
    status === 'SARO Approved - Pending Treasurer' ||
    status === 'ACTIVE' ||
    status === 'In Progress' ||
    status === 'Completed' ||
    status === 'Rejected - Budget Officer' ||
    status === 'Rejected - Treasurer' ||
    status === 'On Hold'
  ) {
    return status;
  }
  return 'MPDC Approved';
};

const isProjectOperationalStatus = (status: string | undefined) => status === 'ACTIVE' || status === 'In Progress';
const isProjectRejectedStatus = (status: string | undefined) => status === 'Rejected - Budget Officer' || status === 'Rejected - Treasurer';

const inferProjectStatus = (
  allocatedFunds: number,
  disbursedFunds: number,
  milestones: Milestone[],
  currentStatus?: string
): ProjectStatus => {
  const normalizedStatus = normalizeProjectStatus(currentStatus);
  if (normalizedStatus === 'On Hold') {
    return 'On Hold';
  }
  if (isProjectRejectedStatus(normalizedStatus) || normalizedStatus === 'Completed') {
    return normalizedStatus;
  }

  const hasExecutionActivity = milestones.some((milestone) =>
    milestone.status === 'Verified' || milestone.status === 'Paid' || milestone.onChainPaid
  );

  if (allocatedFunds > 0 && disbursedFunds >= allocatedFunds) {
    return 'Completed';
  }
  if (disbursedFunds > 0 || hasExecutionActivity) {
    return 'In Progress';
  }
  if (normalizedStatus === 'SARO Approved - Pending Treasurer') {
    return 'SARO Approved - Pending Treasurer';
  }
  if (normalizedStatus === 'ACTIVE') {
    return 'ACTIVE';
  }
  return 'MPDC Approved';
};

const mapDocumentFromApi = (document: any): Document => ({
  id: document.id,
  milestoneId: document.milestone_id || document.milestoneId || undefined,
  title: document.title || document.name || 'Document',
  type: document.type || 'Other',
  url: document.url,
  fileFormat: document.file_format || document.fileFormat || undefined,
  uploadedBy: document.uploaded_by || document.uploadedBy || '',
  dateUploaded: document.date_uploaded || document.created_at || new Date().toISOString(),
  ipfsHash: document.ipfs_hash || document.ipfsHash || '',
  size: Number(document.size || 0),
  version: Number(document.version || 1),
  previousVersion: document.previous_version || undefined,
  verified: Boolean(document.verified),
  verifiedBy: document.verified_by || undefined,
  verifiedDate: document.verified_date || undefined,
  checksumHash: document.checksum_hash || document.checksumHash || '',
});

const mapMilestonePhotoFromApi = (photo: any): MilestonePhoto => ({
  id: photo.id,
  type: photo.photo_type || photo.type || 'proof',
  url: photo.url,
  photoHash: photo.photo_hash || photo.photoHash || '',
  ipfsHash: photo.ipfs_hash || photo.ipfsHash || undefined,
  timestamp: photo.captured_at || photo.timestamp || photo.created_at || new Date().toISOString(),
  description: photo.description || undefined,
  uploadedBy: photo.uploaded_by || photo.uploadedBy || '',
});

const mapTransactionFromApi = (transaction: any): Transaction => ({
  id: transaction.id,
  projectId: transaction.project_id || transaction.projectId,
  milestoneId: transaction.milestone_id || transaction.milestoneId || undefined,
  amount: Number(transaction.amount || 0),
  type: transaction.type,
  status: transaction.status || 'Completed',
  date: transaction.date || transaction.created_at || new Date().toISOString(),
  initiatedBy: transaction.initiated_by || transaction.initiatedBy || undefined,
  recordedBy: transaction.recorded_by || transaction.initiated_by || '',
  recordedByRole: transaction.recorded_by_role || 'Admin',
  description: transaction.description || '',
  hash: transaction.blockchain_tx_hash || transaction.hash || transaction.request_tx_hash || '',
  contractorAddress: transaction.contractor_wallet || transaction.contractorAddress || undefined,
  requestMetadataHash: transaction.request_metadata_hash || transaction.requestMetadataHash || undefined,
  supportingHash: transaction.supporting_hash || transaction.supportingHash || undefined,
  signatureCount: Number(transaction.signature_count || transaction.signatureCount || 0),
  budgetSignedAt: transaction.budget_signed_at || transaction.budgetSignedAt || undefined,
  treasurerSignedAt: transaction.treasurer_signed_at || transaction.treasurerSignedAt || undefined,
  requestTxHash: transaction.request_tx_hash || transaction.requestTxHash || undefined,
  digitalSealHash: transaction.digital_seal_hash || transaction.digitalSealHash || undefined,
  rejectionReason: transaction.rejection_reason || transaction.rejectionReason || undefined,
  rejectedByRole: transaction.rejected_by_role || transaction.rejectedByRole || undefined,
});

const mapMilestoneFromApi = (milestone: any): Milestone => ({
  id: milestone.id,
  title: milestone.title,
  description: milestone.description || '',
  deliverables: Array.isArray(milestone.deliverables) ? milestone.deliverables : [],
  percentage: Number(milestone.percentage || 0),
  dueDate: milestone.due_date || milestone.dueDate || undefined,
  status: milestone.status === 'Verified' || milestone.status === 'Paid' ? milestone.status : 'Pending',
  dateVerified: milestone.date_verified || milestone.dateVerified || undefined,
  verifiedBy: milestone.verified_by || milestone.verifiedBy || undefined,
  photoUrl: milestone.photo_url || milestone.photoUrl || undefined,
  evidenceHash: milestone.evidence_hash || milestone.evidenceHash || undefined,
  reportHash: milestone.report_hash || milestone.reportHash || undefined,
  evidencePhotoCount: Number(milestone.evidence_photo_count || milestone.evidencePhotoCount || 0),
  evidenceReportCount: Number(milestone.evidence_report_count || milestone.evidenceReportCount || 0),
  onChainVerifiedAt: milestone.onchain_verified_at || milestone.onChainVerifiedAt || undefined,
  onChainPaid: Boolean(milestone.onchain_paid ?? milestone.onChainPaid),
  photos: Array.isArray(milestone.photos) ? milestone.photos.map(mapMilestonePhotoFromApi) : [],
});

const normalizeMilestonePlan = (milestones: ProposalMilestonePlan[]) => milestones
  .map((milestone) => ({
    title: milestone.title.trim(),
    description: milestone.description.trim(),
    deliverables: Array.isArray(milestone.deliverables)
      ? milestone.deliverables.map((deliverable) => String(deliverable || '').trim()).filter(Boolean)
      : [],
    percentage: Number(milestone.percentage || 0),
    dueDate: milestone.dueDate || undefined,
  }))
  .filter((milestone) => milestone.title);

const validateMilestonePlan = (milestones: ProposalMilestonePlan[], options?: { allowEmpty?: boolean; requireTargetDates?: boolean }) => {
  const normalized = normalizeMilestonePlan(milestones);

  if (normalized.length === 0) {
    if (options?.allowEmpty) {
      return { milestones: normalized, error: null as string | null };
    }
    return { milestones: normalized, error: 'Add at least one milestone before continuing.' };
  }

  let totalPercentage = 0;
  for (const milestone of normalized) {
    if (options?.requireTargetDates && !milestone.dueDate) {
      return { milestones: normalized, error: 'Each milestone must include a target date.' };
    }

    if (!milestone.deliverables || milestone.deliverables.length === 0) {
      milestone.deliverables = [milestone.title || 'Milestone deliverables and completion verification'];
    }

    if (!Number.isFinite(milestone.percentage) || milestone.percentage <= 0 || milestone.percentage > 100) {
      return { milestones: normalized, error: 'Milestone percentages must be between 1 and 100.' };
    }

    totalPercentage += milestone.percentage;
  }

  if (totalPercentage !== 100) {
    return { milestones: normalized, error: 'Milestone percentages must total exactly 100%.' };
  }

  return { milestones: normalized, error: null as string | null };
};

const calculateMilestoneAllocationAmount = (totalBudget: number, milestonePercentage: number) =>
  Math.round(totalBudget * (milestonePercentage / 100));

const deriveApprovalStages = (project: any, milestones: Milestone[], transactions: Transaction[]): ApprovalStage[] => {
  const stages: ApprovalStage[] = [];

  stages.push({
    id: `approval-${project.id}-mpdc-project-approval`,
    stage: 'MPDC Project Approval',
    status: 'Verified',
    approvedBy: project.blockchain_created_by_wallet || project.created_by || 'MPDC',
    approvedByRole: 'MPDC (Planning)',
    timestamp: project.created_at || project.createdAt || new Date().toISOString(),
    signature: project.metadata_hash || project.metadataHash || 'project-metadata-hash',
    comments: 'MPDC created this project directly as an approved municipal project.',
  });

  transactions
    .filter((transaction) => transaction.type === 'Allocation (SARO)')
    .forEach((transaction) => {
      const stageStatus: ApprovalStage['status'] =
        transaction.status === 'Rejected - Budget Officer' || transaction.status === 'Rejected - Treasurer'
          ? 'Rejected'
          : 'Verified';

      stages.push({
        id: `approval-${transaction.id}-budget-allocation`,
        stage: 'Budget Allocation',
        status: stageStatus,
        approvedBy: transaction.recordedBy || 'Budget Officer',
        approvedByRole: 'Budget Officer',
        timestamp: transaction.budgetSignedAt || transaction.date,
        signature: transaction.hash || transaction.requestTxHash || 'budget-allocation',
        comments: transaction.rejectionReason
          ? `Budget Officer rejected the project: ${transaction.rejectionReason}`
          : transaction.description || 'Budget Officer created the SARO allocation and applied the first signature.',
      });
    });

  if (project.treasurer_signed_at || project.treasurerSignedAt || project.activated_at || project.activatedAt || project.treasury_seal_hash || project.treasurySealHash) {
    stages.push({
      id: `approval-${project.id}-treasury-activation`,
      stage: 'Treasury Activation',
      status: project.status === 'Rejected - Treasurer' ? 'Rejected' : 'Verified',
      approvedBy: project.treasurer_wallet || project.treasurerWallet || 'Treasurer',
      approvedByRole: 'Treasurer',
      timestamp: project.activated_at || project.activatedAt || project.treasurer_signed_at || project.treasurerSignedAt || new Date().toISOString(),
      signature: project.treasury_seal_hash || project.treasurySealHash || 'treasury-seal',
      comments: project.rejection_reason
        ? `Treasurer rejected the project: ${project.rejection_reason}`
        : 'Treasurer signed the SARO and activated the project for execution.',
    });
  } else if (project.status === 'Rejected - Treasurer') {
    stages.push({
      id: `approval-${project.id}-treasury-activation-rejected`,
      stage: 'Treasury Activation',
      status: 'Rejected',
      approvedBy: project.treasurer_wallet || project.treasurerWallet || 'Treasurer',
      approvedByRole: 'Treasurer',
      timestamp: project.treasurer_signed_at || project.treasurerSignedAt || project.updated_at || new Date().toISOString(),
      signature: project.blockchain_tx_hash || project.blockchainTxHash || 'treasury-rejection',
      comments: project.rejection_reason || 'Treasurer rejected the project at Gate 2.',
    });
  }

  milestones
    .filter((milestone) => milestone.dateVerified)
    .forEach((milestone) => {
      stages.push({
        id: `approval-${milestone.id}-mpdc`,
        stage: 'MPDC Verification',
        status: 'Verified',
        approvedBy: milestone.verifiedBy || 'MPDC',
        approvedByRole: 'MPDC (Planning)',
        timestamp: milestone.dateVerified || new Date().toISOString(),
        signature: milestone.evidenceHash || milestone.reportHash || milestone.onChainVerifiedAt || 'mpdc-verification',
        comments: `Milestone ${milestone.title} verified and ready for downstream approvals.`,
      });
    });

  transactions
    .filter((transaction) => transaction.type === 'Disbursement (NCA)' && transaction.status === '1/2 Signed')
    .forEach((transaction) => {
      stages.push({
        id: `approval-${transaction.id}-budget-signature`,
        stage: 'Budget Allocation',
        status: 'Verified',
        approvedBy: 'Budget Officer',
        approvedByRole: 'Budget Officer',
        timestamp: transaction.budgetSignedAt || transaction.date,
        signature: transaction.supportingHash || transaction.hash || 'budget-signature',
        comments: 'Budget Officer validated the pending transaction request against the approved appropriation.',
      });
    });

  transactions
    .filter((transaction) => transaction.type === 'Disbursement (NCA)' && transaction.status === 'Executed')
    .forEach((transaction) => {
      stages.push({
        id: `approval-${transaction.id}-treasurer-execution`,
        stage: 'Treasurer Disbursement',
        status: 'Verified',
        approvedBy: transaction.recordedBy || 'Treasurer',
        approvedByRole: 'Treasurer',
        timestamp: transaction.treasurerSignedAt || transaction.date,
        signature: transaction.digitalSealHash || transaction.hash || 'digital-seal',
        comments: 'Treasurer applied the final signature and generated the digital seal of truth.',
      });
    });

  return stages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

const mapProjectFromApi = (project: any): Project => {
  const milestones = Array.isArray(project.milestones) ? project.milestones.map(mapMilestoneFromApi) : [];
  const allocatedFunds = Number(project.allocated_funds || project.allocatedFunds || 0);
  const disbursedFunds = Number(project.disbursed_funds || project.disbursedFunds || 0);
  const transactions = Array.isArray(project.transactions) ? project.transactions.map(mapTransactionFromApi) : [];

  return {
    id: project.id,
    name: project.name,
    description: project.description || '',
    location: project.location || '',
    category: project.category || '',
    budgetSource: project.budget_source || project.budgetSource || undefined,
    locationPhotos: Array.isArray(project.location_photos) ? project.location_photos : Array.isArray(project.locationPhotos) ? project.locationPhotos : undefined,
    startDate: project.start_date || project.startDate || undefined,
    endDate: project.end_date || project.endDate || undefined,
    stakeholders: Array.isArray(project.stakeholders) ? project.stakeholders : [],
    totalBudget: Number(project.total_budget || project.totalBudget || 0),
    allocatedFunds,
    disbursedFunds,
    status: inferProjectStatus(allocatedFunds, disbursedFunds, milestones, project.status),
    milestones,
    documents: Array.isArray(project.documents) ? project.documents.map(mapDocumentFromApi) : [],
    transactions,
    saro: project.saro || project.latest_saro_ref || project.latestSaroRef || undefined,
    createdAt: project.created_at || project.createdAt || new Date().toISOString(),
    metadataHash: project.metadata_hash || project.metadataHash || undefined,
    blockchainTxHash: project.blockchain_tx_hash || project.blockchainTxHash || undefined,
    latestDisbursementRef: project.latest_disbursement_ref || project.latestDisbursementRef || undefined,
    createdByWallet: project.blockchain_created_by_wallet || project.createdByWallet || undefined,
    onChainSyncedAt: project.onchain_synced_at || project.onChainSyncedAt || undefined,
    approvalStages: deriveApprovalStages(project, milestones, transactions),
    rejectionReason: project.rejection_reason || project.rejectionReason || undefined,
    rejectedByRole: project.rejected_by_role || project.rejectedByRole || undefined,
    budgetOfficerSignedAt: project.budget_officer_signed_at || project.budgetOfficerSignedAt || undefined,
    budgetOfficerWallet: project.budget_officer_wallet || project.budgetOfficerWallet || undefined,
    treasurerSignedAt: project.treasurer_signed_at || project.treasurerSignedAt || undefined,
    treasurerWallet: project.treasurer_wallet || project.treasurerWallet || undefined,
    treasurySealHash: project.treasury_seal_hash || project.treasurySealHash || undefined,
    activatedAt: project.activated_at || project.activatedAt || undefined,
  };
};

const mapAlertFromApi = (alert: any): SystemAlert => ({
  id: alert.id,
  projectId: alert.project_id || alert.projectId,
  message: alert.message,
  date: alert.created_at || alert.date || new Date().toISOString(),
  status: alert.status === 'Resolved' ? 'Resolved' : 'Unresolved',
  alertType: alert.alert_type || alert.alertType || 'general',
  severity: alert.severity || alert.severity || 'INFO',
  details: alert.details || {},
});

const mapAuditLogFromApi = (log: any): AuditLog => ({
  id: log.id,
  timestamp: log.timestamp || log.created_at || new Date().toISOString(),
  action: log.action,
  userRole: log.user_role || log.userRole || 'System',
  details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {}),
  hash: log.hash || log.tx_hash || '',
  userId: log.user_id || log.userId || undefined,
  resourceType: log.resource_type || log.resourceType || undefined,
  resourceId: log.resource_id || log.resourceId || undefined,
  actorName: log.actor_name || log.actorName || undefined,
  actorWallet: log.actor_wallet || log.actorWallet || null,
  rawDetails: log.details,
});

export const BlockchainProvider = ({ children }: { children: ReactNode }) => {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>(() => readStoredProjects());
  const [isLoading, setIsLoading] = useState(() => !hasStoredProjects());
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  /*
    {
      id: 'alert-mock-1',
      projectId: 'proj-001',
      message: 'Public Report: The drainage repair seems to be stalled for the past week despite the app showing ongoing progress.',
      date: new Date(Date.now() - 86400000).toISOString(),
      status: 'Unresolved'
    }
  ]); */
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  /*
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
  ]); */
  const [proposals, setProposals] = useState<Proposal[]>([]);

  const [isWeb3Connected, setIsWeb3Connected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [chainBudgets, setChainBudgets] = useState<Record<string, number>>(() => readStoredChainBudgets());

  const refreshChainBudgets = async () => {
    if (projects.length === 0) return readStoredChainBudgets();
    const provider = getReadOnlyWeb3Provider();
    if (!provider) return readStoredChainBudgets();

    try {
      const contractInstance = await getContract(provider);
      const snapshots = await Promise.all(
        projects.map(async (project) => {
          try {
            const chainProject = await contractInstance.projects(project.id);
            const exists = Boolean(chainProject.exists ?? chainProject[14]);
            if (!exists) return [project.id, null] as const;
            const totalBudget = Number(chainProject.totalBudget ?? chainProject[2] ?? 0);
            return [project.id, totalBudget] as const;
          } catch {
            return [project.id, null] as const;
          }
        })
      );

      const current = readStoredChainBudgets();
      let hasUpdate = false;
      const nextBudgets: Record<string, number> = { ...current };

      for (const [id, budget] of snapshots) {
        if (typeof budget === 'number' && Number.isFinite(budget)) {
          const project = projects.find((p) => p.id === id);
          const effectiveBudget =
            project &&
              Math.abs(project.totalBudget - budget) < 1 &&
              Math.round(project.totalBudget) === Math.round(budget)
              ? project.totalBudget
              : budget;

          if (nextBudgets[id] !== effectiveBudget) {
            nextBudgets[id] = effectiveBudget;
            hasUpdate = true;
          }
        }
      }

      if (hasUpdate) {
        writeStoredChainBudgets(nextBudgets);
        setChainBudgets(nextBudgets);
      }
      return nextBudgets;
    } catch (err) {
      console.warn('Unable to verify chain budgets against Sepolia:', err);
      return readStoredChainBudgets();
    }
  };

  useEffect(() => {
    if (projects.length > 0) {
      refreshChainBudgets();
    }
  }, [projects]);

  const tamperedProjects = useMemo(() => {
    const overrides = readBreachResolutionOverrides();
    return projects
      .filter((project) => {
        const chainBudget = chainBudgets[project.id];
        if (typeof chainBudget !== 'number') return false;
        const effectiveBudget = overrides[project.id] ?? project.totalBudget;
        return isProjectTampered(effectiveBudget, chainBudget);
      })
      .map((project) => ({
        id: project.id,
        chainBudget: chainBudgets[project.id],
        databaseBudget: project.totalBudget,
      }));
  }, [projects, chainBudgets]);

  // Sepolia chain id for production test; align with your final network
  const EXPECTED_CHAIN_ID = '0xaa36a7'; // Sepolia

  const switchOrAddSepoliaNetwork = async (provider: ethers.providers.Web3Provider) => {
    try {
      await provider.send('wallet_switchEthereumChain', [{ chainId: EXPECTED_CHAIN_ID }]);
      return true;
    } catch (switchError: any) {
      // 4902 error code means the chain has not been added to MetaMask.
      if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        await provider.send('wallet_addEthereumChain', [
          {
            chainId: EXPECTED_CHAIN_ID,
            chainName: 'Sepolia Test Network',
            nativeCurrency: {
              name: 'Sepolia Ether',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: [
              'https://sepolia.infura.io/v3/94868e8cc29b45c39a4fb474e5fae485',
              'https://rpc.sepolia.org',
            ],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          },
        ]);
        return true;
      }
      throw switchError;
    }
  };

  const ensureCorrectNetwork = async (provider: ethers.providers.Web3Provider) => {
    const current = await provider.send('eth_chainId', []);
    setChainId(current);
    const normalizedCurrent = String(current || '').toLowerCase();
    if (normalizedCurrent !== EXPECTED_CHAIN_ID.toLowerCase() && parseInt(normalizedCurrent, 16) !== 11155111) {
      try {
        await switchOrAddSepoliaNetwork(provider);
        const updated = await provider.send('eth_chainId', []);
        setChainId(updated);
        return true;
      } catch (err: any) {
        throw new Error('Please switch MetaMask network to Sepolia before continuing.');
      }
    }
    return true;
  };

  const refreshProjects = async () => {
    try {
      const response = await apiClient.getProjects(token ?? undefined, { limit: 100 }) as { projects: any[] };
      const mapped = (response.projects || []).map(mapProjectFromApi);
      if (mapped.length > 0) {
        setProjects(mapped);
        writeStoredProjects(mapped);
      }
      return mapped;
    } catch (err) {
      console.warn('Failed to refresh projects from backend:', err);
      const cached = readStoredProjects();
      if (cached.length > 0) {
        setProjects(cached);
      }
      return cached;
    }
  };

  const refreshAlerts = async () => {
    if (!token || !user) {
      setAlerts([]);
      return;
    }

    try {
      const response = await apiClient.getSystemAlerts(token) as { alerts: any[] };
      setAlerts((response.alerts || []).map(mapAlertFromApi));
    } catch (error) {
      console.warn('Failed to load alerts from backend:', error);
    }
  };

  const refreshAuditLogs = async () => {
    if (!token || !user) {
      setAuditLogs([]);
      return;
    }

    const response = await apiClient.getAuditLogs(token) as { logs: any[] };
    setAuditLogs((response.logs || []).map(mapAuditLogFromApi));
  };

  useEffect(() => {
    // Check if already connected and previously saved wallet from localStorage.
    const checkConnection = async () => {
      const provider = getWeb3Provider();
      if (!provider) return;

      try {
        await ensureCorrectNetwork(provider);
      } catch (err) {
        console.warn('Network mismatch on init', err);
        return;
      }

      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        const signer = await provider.getSigner();
        setWalletAddress(accounts[0]);
        setIsWeb3Connected(true);
        const contractInstance = await getContract(signer);
        setContract(contractInstance);
      }

      provider.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          setWalletAddress(null);
          setIsWeb3Connected(false);
          localStorage.removeItem('sta-cruz-wallet');
        } else {
          setWalletAddress(accounts[0]);
          localStorage.setItem('sta-cruz-wallet', accounts[0]);
        }
      });

      provider.on('chainChanged', async (newChainId: string) => {
        setChainId(newChainId);
        const normalized = String(newChainId || '').toLowerCase();
        if (normalized !== EXPECTED_CHAIN_ID.toLowerCase() && parseInt(normalized, 16) !== 11155111) {
          try {
            await switchOrAddSepoliaNetwork(provider);
          } catch {
            console.warn(`Please switch MetaMask to Sepolia (0xaa36a7). Current: ${newChainId}`);
          }
        }
      });

    };
    checkConnection();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadDashboardData = async () => {
      if (!hasStoredProjects()) {
        setIsLoading(true);
      }
      try {
        await refreshProjects();

        if (!token || !user) {
          setAlerts([]);
          setAuditLogs([]);
          return;
        }

        await Promise.all([
          refreshAlerts(),
          refreshAuditLogs(),
        ]);
      } catch (error) {
        console.warn('Failed to load dashboard data from backend:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [token, user]);

  useEffect(() => {
    const loadProposals = async () => {
      if (!token || !user) {
        setProposals([]);
        return;
      }

      try {
        const response = await apiClient.getProposals(token) as { proposals: any[] };
        const mapped = (response.proposals || []).map(mapProposalFromApi);
        setProposals(mapped);
      } catch (error) {
        console.warn('Failed to load proposals from backend:', error);
      }
    };

    loadProposals();
  }, [token, user]);

  // Set up blockchain event listeners when contract is connected
  useEffect(() => {
    if (!contract || !isWeb3Connected) return;

    const setupEventListeners = () => {
      // Role Granted Event
      contract.on('RoleGranted', (role, account, sender) => {
        console.log('Role granted on blockchain:', { role, account, sender });
        logAction('Role Granted (Blockchain)', 'System', `Role ${role} granted to ${account}`, 'blockchain-event');
      });

      // Role Revoked Event
      contract.on('RoleRevoked', (role, account, sender) => {
        console.log('Role revoked on blockchain:', { role, account, sender });
        logAction('Role Revoked (Blockchain)', 'System', `Role ${role} revoked from ${account}`, 'blockchain-event');
      });

      // Project Created Event
      contract.on('ProjectCreated', (projectId, name, totalBudget, createdBy) => {
        console.log('Project created on blockchain:', { projectId, name, totalBudget, createdBy });
        logAction('Project Created (Blockchain)', 'System', `Project ${name} created with budget PHP ${totalBudget}`, 'blockchain-event');
        if (projects.some((project) => project.id === projectId)) {
          refreshProjectFromChain(projectId).catch((error) => console.warn('Project sync failed after ProjectCreated event', error));
        }
      });

      // Funds Allocated Event
      contract.on('FundsAllocated', (projectId, amount, saro, allocatedBy) => {
        console.log('Funds allocated on blockchain:', { projectId, amount, saro, allocatedBy });
        logAction('Funds Allocated (Blockchain)', 'System', `PHP ${amount} allocated to ${projectId} (${saro})`, 'blockchain-event');
        if (projects.some((project) => project.id === projectId)) {
          refreshProjectFromChain(projectId).catch((error) => console.warn('Project sync failed after FundsAllocated event', error));
        }
      });

      if (contract.interface.events['ProjectRejected(string,string,string,address)']) {
        contract.on('ProjectRejected', (projectId, status, reason, rejectedBy) => {
          console.log('Project rejected on blockchain:', { projectId, status, reason, rejectedBy });
          logAction('Project Rejected (Blockchain)', 'System', `Project ${projectId} is now ${status}`, 'blockchain-event');
          if (projects.some((project) => project.id === projectId)) {
            refreshProjectFromChain(projectId).catch((error) => console.warn('Project sync failed after ProjectRejected event', error));
          }
        });
      }

      if (contract.interface.events['ProjectActivated(string,string,string,address)']) {
        contract.on('ProjectActivated', (projectId, status, treasurySealHash, treasurer) => {
          console.log('Project activated on blockchain:', { projectId, status, treasurySealHash, treasurer });
          logAction('Project Activated (Blockchain)', 'System', `Project ${projectId} entered ${status}`, 'blockchain-event');
          if (projects.some((project) => project.id === projectId)) {
            refreshProjectFromChain(projectId).catch((error) => console.warn('Project sync failed after ProjectActivated event', error));
          }
        });
      }

      if (contract.interface.events['DigitalSealOfTruth(string,uint256,address)']) {
        contract.on('DigitalSealOfTruth', (projectId, amount, treasurer) => {
          console.log('Project digital seal generated on blockchain:', { projectId, amount, treasurer });
          logAction('Project Digital Seal Of Truth (Blockchain)', 'System', `Project ${projectId} sealed for PHP ${amount}`, 'blockchain-event');
        });
      }

      // Milestone Verified Event
      contract.on('MilestoneVerified', (projectId, milestoneId, ipfsHash, verifiedBy) => {
        console.log('Milestone verified on blockchain:', { projectId, milestoneId, ipfsHash, verifiedBy });
        logAction('Milestone Verified (Blockchain)', 'System', `Milestone ${milestoneId} verified for ${projectId}`, 'blockchain-event');
        if (projects.some((project) => project.id === projectId)) {
          refreshProjectFromChain(projectId).catch((error) => console.warn('Project sync failed after MilestoneVerified event', error));
        }
      });

      // Funds Disbursed Event
      contract.on('FundsDisbursed', (projectId, amount, disbursedBy) => {
        console.log('Funds disbursed on blockchain:', { projectId, amount, disbursedBy });
        logAction('Funds Disbursed (Blockchain)', 'System', `PHP ${amount} disbursed for ${projectId}`, 'blockchain-event');
        if (projects.some((project) => project.id === projectId)) {
          refreshProjectFromChain(projectId).catch((error) => console.warn('Project sync failed after FundsDisbursed event', error));
        }
      });

      if (contract.interface.events['PendingTransactionCreated(string,string,string,uint256,address,string,address)']) {
        contract.on('PendingTransactionCreated', (requestId, projectId, milestoneId, amount, contractor, metadataHash, initiatedBy) => {
          console.log('Pending transaction created on blockchain:', { requestId, projectId, milestoneId, amount, contractor, metadataHash, initiatedBy });
          logAction('Pending Transaction Created (Blockchain)', 'System', `Request ${requestId} created for project ${projectId}`, 'blockchain-event');
        });
      }

      if (contract.interface.events['TransactionPartiallySigned(string,string,address,uint8,string)']) {
        contract.on('TransactionPartiallySigned', (requestId, projectId, budgetOfficer, signatureCount, supportingHash) => {
          console.log('Transaction partially signed on blockchain:', { requestId, projectId, budgetOfficer, signatureCount, supportingHash });
          logAction('Transaction 1/2 Signed (Blockchain)', 'System', `Request ${requestId} validated by Budget Officer`, 'blockchain-event');
        });
      }

      if (contract.interface.events['DisbursementDigitalSealOfTruth(string,string,string,address,uint256,string,address)']) {
        contract.on('DisbursementDigitalSealOfTruth', (requestId, projectId, milestoneId, contractor, amount, digitalSealHash, treasurer) => {
          console.log('Digital seal generated on blockchain:', { requestId, projectId, milestoneId, contractor, amount, digitalSealHash, treasurer });
          logAction('Digital Seal Of Truth (Blockchain)', 'System', `Request ${requestId} executed for project ${projectId}`, 'blockchain-event');
        });
      }
    };

    setupEventListeners();

    // Cleanup function to remove listeners
    return () => {
      if (contract) {
        contract.removeAllListeners();
      }
    };
  }, [contract, isWeb3Connected, projects]);

  const connectToWeb3 = async () => {
    try {
      const provider = getWeb3Provider();
      if (!provider) {
        throw new Error('MetaMask or Web3 wallet is not installed.');
      }

      const signer = await connectWallet();
      await ensureCorrectNetwork(provider);
      const address = await signer.getAddress();
      setWalletAddress(address);
      setIsWeb3Connected(true);
      setChainId(await provider.send('eth_chainId', []));
      localStorage.setItem('sta-cruz-wallet', address);
      const contractInstance = await getContract(signer);
      setContract(contractInstance);
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      alert(error?.message || 'Failed to connect wallet. Please ensure MetaMask is installed and unlocked.');
      throw error;
    }
  };

  const generateHash = () => {
    return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  };

  const buildDisbursementRequestMetadataHash = (projectId: string, milestoneId: string, amount: number, contractorAddress: string) => ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(JSON.stringify({
      projectId,
      milestoneId,
      amount,
      contractorAddress: contractorAddress.toLowerCase(),
      requestedBy: user?.id || '',
      requestedAt: new Date().toISOString(),
    }))
  );

  const buildDigitalSealHash = (transactionId: string, projectId: string, milestoneId: string, amount: number, transactionHash: string) => ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(JSON.stringify({
      transactionId,
      projectId,
      milestoneId,
      amount,
      transactionHash,
      sealedAt: new Date().toISOString(),
      sealedBy: user?.id || '',
    }))
  );

  const getProjectTransactionRequests = (projectId: string) => (projects.find((project) => project.id === projectId)?.transactions || [])
    .filter((transaction) => transaction.type === 'Disbursement (NCA)');

  const getMilestoneTransactionRequest = (projectId: string, milestoneId: string, statuses?: TransactionStatus[]) => (
    getProjectTransactionRequests(projectId).find((transaction) => {
      if (transaction.milestoneId !== milestoneId) return false;
      if (!statuses || statuses.length === 0) return true;
      return statuses.includes(transaction.status);
    })
  );

  const buildProposalMetadataHash = (proposalData: ProposalInput) => ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(JSON.stringify({
      projectName: proposalData.projectName,
      description: proposalData.description,
      location: proposalData.location,
      category: proposalData.category,
      budget: proposalData.budget,
      proposedBy: proposalData.proposedBy,
      submittedBy: proposalData.submittedBy,
      supportingHash: proposalData.supportingHash || '',
      draftMilestones: normalizeMilestonePlan(proposalData.draftMilestones || [])
    }))
  );

  const createProposalRecord = (
    proposalId: string,
    proposalData: ProposalInput,
    overrides?: Partial<Proposal>
  ): Proposal => ({
    ...proposalData,
    id: proposalId,
    status: 'Pending Review',
    createdAt: overrides?.createdAt || new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    version: overrides?.version ?? 1,
    metadataHash: overrides?.metadataHash || buildProposalMetadataHash(proposalData),
    supportingHash: overrides?.supportingHash || proposalData.supportingHash,
    supportingDocuments: overrides?.supportingDocuments || proposalData.supportingDocuments,
    supportingDocumentName: overrides?.supportingDocumentName || proposalData.supportingDocumentName,
    supportingDocumentUrl: overrides?.supportingDocumentUrl || proposalData.supportingDocumentUrl,
    draftMilestones: overrides?.draftMilestones || proposalData.draftMilestones || [],
    submittingOfficialWallet: overrides?.submittingOfficialWallet || walletAddress || undefined,
    lastTransactionHash: overrides?.lastTransactionHash,
    onChainSubmittedAt: overrides?.onChainSubmittedAt,
    onChainUpdatedAt: overrides?.onChainUpdatedAt,
    isOnChain: overrides?.isOnChain ?? false
  });

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

  const ensureWalletMatchesAuthenticatedUser = () => {
    if (!user) {
      throw new Error('You must be logged in to perform blockchain actions.');
    }

    if (!user.walletAddress) {
      throw new Error('Your account is not linked to a wallet yet.');
    }

    if (!walletAddress) {
      throw new Error('Connect your Web3 wallet before performing this action.');
    }

    if (user.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('Connected wallet does not match your linked account wallet.');
    }
  };

  const ensureProposalWalletAuthorization = async () => {
    if (!user) {
      throw new Error('You must be logged in to submit a proposal.');
    }

    if (user.role !== 'MPDC (Planning)') {
      throw new Error('Only MPDC accounts can submit or revise proposals in this system.');
    }

    if (!user.walletAddress) {
      throw new Error('Your MPDC account is not linked to a wallet yet.');
    }

    const provider = getWeb3Provider();
    if (!provider) {
      throw new Error('MetaMask or another Web3 wallet is required to submit a proposal.');
    }

    await provider.send('eth_requestAccounts', []);
    const signer = provider.getSigner();
    const connectedWallet = await signer.getAddress();

    if (connectedWallet.toLowerCase() !== user.walletAddress.toLowerCase()) {
      throw new Error(`Authorization failed: connected wallet ${connectedWallet} does not match the wallet linked to your MPDC account (${user.walletAddress}).`);
    }

    return connectedWallet.toLowerCase();
  };

  const ensureProposalReviewAuthorization = async () => {
    if (user?.role === 'MPDC (Planning)') {
      await ensureBlockchainReady('MPDC (Planning)');
      return walletAddress?.toLowerCase();
    }

    return undefined;
  };

  const ensureBlockchainReady = async (requiredRole?: Role | 'MPDC' | 'Budget Officer' | 'Treasurer' | 'Admin') => {
    if (!isWeb3Connected || !walletAddress || !contract) {
      throw new Error('Connect your Web3 wallet before performing this action.');
    }

    const provider = getWeb3Provider();
    if (!provider) {
      throw new Error('MetaMask or Web3 wallet is not installed.');
    }

    await ensureCorrectNetwork(provider);
    ensureWalletMatchesAuthenticatedUser();

    if (requiredRole && !(await hasRole(requiredRole, walletAddress))) {
      throw new Error(`Your connected wallet does not have ${requiredRole} permissions on chain.`);
    }
  };

  const describeBlockchainFailure = (action: string, error: unknown) => {
    const anyError = error as any;
    const messages = [
      anyError?.reason,
      anyError?.error?.reason,
      anyError?.data?.message,
      anyError?.error?.data?.message,
      anyError?.error?.message,
      anyError?.message,
    ].filter((value): value is string => Boolean(value));

    const rawMessage = messages[0];

    if (!rawMessage) {
      return `${action} failed on blockchain.`;
    }

    const normalized = rawMessage.toLowerCase();

    if (normalized.includes('user rejected')) {
      return `${action} was canceled in your wallet.`;
    }

    if (normalized.includes('unpredictable_gas_limit') || normalized.includes('cannot estimate gas')) {
      return `${action} failed on blockchain. The contract rejected the transaction or this deployed contract does not support that action.`;
    }

    const revertedWithReason = rawMessage.match(/execution reverted(?::| with reason string )\s*"?([^"\n]+)"?/i);
    if (revertedWithReason?.[1]) {
      return `${action} failed on blockchain: ${revertedWithReason[1]}`;
    }

    if (normalized.includes('execution reverted')) {
      return `${action} failed on blockchain because the contract reverted the transaction.`;
    }

    return `${action} failed on blockchain: ${rawMessage}`;
  };

  const contractHasFunction = (signature: string) => {
    if (!contract) return false;
    return Boolean(contract.interface.functions[signature]);
  };

  const deployedContractSupportsFunction = async (signature: string) => {
    if (!contractHasFunction(signature) || !contract) {
      return false;
    }

    const cacheKey = `${CONTRACT_ADDRESS}:${signature}`;
    if (deployedSelectorSupportCache.has(cacheKey)) {
      return deployedSelectorSupportCache.get(cacheKey)!;
    }

    try {
      const selector = contract.interface.getSighash(signature).replace('0x', '').toLowerCase();
      const code = (await contract.provider.getCode(CONTRACT_ADDRESS)).toLowerCase();
      const supported = code.includes(selector);
      deployedSelectorSupportCache.set(cacheKey, supported);
      return supported;
    } catch (error) {
      console.warn(`Unable to verify deployed selector support for ${signature}. Falling back to ABI check.`, error);
      return true;
    }
  };

  const toSafeNumber = (value: any) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    if (value?.toNumber) return value.toNumber();
    return 0;
  };

  const readProjectFromChain = async (projectId: string) => {
    if (!contract || !isWeb3Connected) {
      throw new Error('Blockchain contract is not connected.');
    }

    if (contractHasFunction('getProjectDetails(string)')) {
      return contract.getProjectDetails(projectId);
    }

    return contract.projects(projectId);
  };

  const readDisbursementRequestFromChain = async (requestId: string) => {
    if (!contract || !isWeb3Connected) {
      throw new Error('Blockchain contract is not connected.');
    }

    if (!contractHasFunction('disbursementRequests(string)')) {
      return null;
    }

    return contract.disbursementRequests(requestId);
  };

  const refreshProjectFromChain = async (projectId: string) => {
    const projectDetails = await readProjectFromChain(projectId);

    const projectExists = Boolean(projectDetails.exists ?? projectDetails[14] ?? projectDetails[10] ?? projectDetails[5]);
    if (!projectExists) {
      throw new Error(`Project ${projectId} does not exist on chain.`);
    }

    const allocatedFunds = toSafeNumber(projectDetails.allocatedFunds ?? projectDetails[3]);
    const disbursedFunds = toSafeNumber(projectDetails.disbursedFunds ?? projectDetails[4]);
    const totalBudget = toSafeNumber(projectDetails.totalBudget ?? projectDetails[2]);
    if (Number.isFinite(totalBudget) && totalBudget > 0) {
      const currentProject = projects.find((project) => project.id === projectId);
      const effectiveTotalBudget =
        currentProject &&
          Math.abs(currentProject.totalBudget - totalBudget) < 1 &&
          Math.round(currentProject.totalBudget) === Math.round(totalBudget)
          ? currentProject.totalBudget
          : totalBudget;

      updateStoredChainBudget(projectId, effectiveTotalBudget);
      setChainBudgets((prev) => ({ ...prev, [projectId]: effectiveTotalBudget }));
    }
    const metadataHash = projectDetails.metadataHash ?? projectDetails[5] ?? '';
    const latestSaroRef = projectDetails.latestSaroRef ?? projectDetails[6] ?? '';
    const latestDisbursementRef = projectDetails.latestDisbursementRef ?? projectDetails[7] ?? '';
    const createdAt = toSafeNumber(projectDetails.createdAt ?? projectDetails[8]);
    const createdBy = projectDetails.createdBy ?? projectDetails[9] ?? '';
    const chainStatus = projectDetails.status ?? projectDetails[11] ?? projectDetails[10] ?? '';
    const rejectionReason = projectDetails.rejectionReason ?? projectDetails[12] ?? projectDetails[11] ?? '';
    const treasurySealHash = projectDetails.treasurySealHash ?? projectDetails[13] ?? projectDetails[12] ?? '';
    const activatedAt = toSafeNumber(projectDetails.activatedAt ?? projectDetails[14] ?? projectDetails[13]);

    const currentProject = projects.find((project) => project.id === projectId);
    if (!currentProject) {
      return;
    }

    const syncedMilestones = await Promise.all(currentProject.milestones.map(async (milestone) => {
      let chainMilestone: any;

      if (contract && contractHasFunction('getMilestoneDetails(string,string)')) {
        chainMilestone = await contract.getMilestoneDetails(projectId, milestone.id);
        const isVerified = Boolean(chainMilestone.isVerified ?? chainMilestone[2]);
        const isPaid = Boolean(chainMilestone.isPaid ?? chainMilestone[3]);
        const verifiedAt = toSafeNumber(chainMilestone.verifiedAt ?? chainMilestone[9]);
        const verifiedBy = chainMilestone.verifiedBy ?? chainMilestone[10] ?? '';

        return {
          ...milestone,
          percentage: toSafeNumber(chainMilestone.percentage ?? chainMilestone[1]) || milestone.percentage,
          status: isPaid ? 'Paid' as const : milestone.status === 'Paid' ? 'Paid' as const : isVerified ? 'Verified' as const : milestone.status,
          evidenceHash: chainMilestone.evidenceHash ?? chainMilestone[5] ?? milestone.evidenceHash,
          reportHash: chainMilestone.reportHash ?? chainMilestone[6] ?? milestone.reportHash,
          evidencePhotoCount: toSafeNumber(chainMilestone.photoCount ?? chainMilestone[7]),
          evidenceReportCount: toSafeNumber(chainMilestone.reportCount ?? chainMilestone[8]),
          onChainVerifiedAt: verifiedAt ? new Date(verifiedAt * 1000).toISOString() : milestone.onChainVerifiedAt,
          onChainVerifiedBy: verifiedBy || milestone.onChainVerifiedBy,
          onChainPaid: isPaid,
          dateVerified: verifiedAt ? new Date(verifiedAt * 1000).toISOString() : milestone.dateVerified,
          verifiedBy: verifiedBy || milestone.verifiedBy
        };
      }

      if (!contract) {
        return milestone;
      }

      chainMilestone = await contract.projectMilestones(projectId, milestone.id);
      const basicVerified = Boolean(chainMilestone.isVerified ?? chainMilestone[2]);
      const basicPaid = Boolean(chainMilestone.isPaid ?? chainMilestone[3]);
      return {
        ...milestone,
        percentage: toSafeNumber(chainMilestone.percentage ?? chainMilestone[1]) || milestone.percentage,
        status: basicPaid ? 'Paid' as const : milestone.status === 'Paid' ? 'Paid' as const : basicVerified ? 'Verified' as const : milestone.status,
        evidenceHash: chainMilestone.evidenceHash ?? chainMilestone[5] ?? milestone.evidenceHash,
        reportHash: chainMilestone.reportHash ?? chainMilestone[6] ?? milestone.reportHash,
        onChainPaid: basicPaid
      };
    }));

    setProjects((prevProjects) => prevProjects.map((project) => {
      if (project.id !== projectId) return project;

      return {
        ...project,
        allocatedFunds,
        disbursedFunds,
        status: inferProjectStatus(allocatedFunds, disbursedFunds, syncedMilestones, chainStatus || project.status),
        milestones: syncedMilestones,
        metadataHash: metadataHash || project.metadataHash,
        saro: latestSaroRef || project.saro,
        latestDisbursementRef: latestDisbursementRef || project.latestDisbursementRef,
        createdByWallet: createdBy || project.createdByWallet,
        createdAt: createdAt ? new Date(createdAt * 1000).toISOString() : project.createdAt,
        onChainSyncedAt: new Date().toISOString(),
        rejectionReason: rejectionReason || project.rejectionReason,
        treasurySealHash: treasurySealHash || project.treasurySealHash,
        activatedAt: activatedAt ? new Date(activatedAt * 1000).toISOString() : project.activatedAt
      };
    }));
  };

  const getRoleIdentifier = async (role: string) => {
    const normalizedRole = role.trim().toLowerCase();

    if (normalizedRole === 'admin / hr' || normalizedRole === 'admin' || normalizedRole === 'admin_role') {
      return ethers.utils.id('ADMIN_ROLE');
    }
    if (normalizedRole === 'mpdc (planning)' || normalizedRole === 'mpdc' || normalizedRole === 'mpdc_role') {
      return ethers.utils.id('MPDC_ROLE');
    }
    if (normalizedRole === 'budget officer' || normalizedRole === 'budget_officer' || normalizedRole === 'budget_officer_role') {
      return ethers.utils.id('BUDGET_OFFICER_ROLE');
    }
    if (normalizedRole === 'treasurer' || normalizedRole === 'treasurer_role') {
      return ethers.utils.id('TREASURER_ROLE');
    }
    throw new Error(`Unknown role mapping for ${role}`);
  };

  const grantRole = async (role: string, walletAddress: string) => {
    if (!contract || !isWeb3Connected || !walletAddress) {
      throw new Error('MetaMask not connected');
    }

    await ensureBlockchainReady('Admin');
    const roleHash = await getRoleIdentifier(role);
    const tx = await contract.grantRole(roleHash, walletAddress);
    await tx.wait();

    logAction('Role Granted', 'Admin', `Granted ${role} to ${walletAddress}`, tx.hash);
    return tx.hash;
  };

  const revokeRole = async (role: string, walletAddress: string) => {
    if (!contract || !isWeb3Connected || !walletAddress) {
      throw new Error('MetaMask not connected');
    }

    await ensureBlockchainReady('Admin');
    const roleHash = await getRoleIdentifier(role);
    const tx = await contract.revokeRole(roleHash, walletAddress);
    await tx.wait();

    logAction('Role Revoked', 'Admin', `Revoked ${role} from ${walletAddress}`, tx.hash);
    return tx.hash;
  };

  const hasRole = async (role: string, walletAddress: string) => {
    if (!contract) {
      return false;
    }
    const roleHash = await getRoleIdentifier(role);
    return await contract.roles(roleHash, walletAddress);
  };

  const addProposal = async (proposalData: ProposalInput) => {
    const { milestones: draftMilestones, error: milestoneValidationError } = validateMilestonePlan(proposalData.draftMilestones || [], { allowEmpty: true });
    if (milestoneValidationError) {
      throw new Error(milestoneValidationError);
    }

    const proposalId = `PROP-${Date.now()}`;
    const nextProposalData = {
      ...proposalData,
      draftMilestones,
    };
    const metadataHash = buildProposalMetadataHash(nextProposalData);
    const supportingHash = proposalData.supportingHash || '';
    const submittingOfficialWallet = await ensureProposalWalletAuthorization();

    const newProposal = createProposalRecord(proposalId, nextProposalData, {
      metadataHash,
      supportingHash,
      submittingOfficialWallet,
      draftMilestones,
    });

    if (token) {
      const response = await apiClient.createProposal(token, {
        id: proposalId,
        projectName: nextProposalData.projectName,
        description: nextProposalData.description,
        location: nextProposalData.location,
        category: nextProposalData.category,
        budget: nextProposalData.budget,
        proposedBy: nextProposalData.proposedBy,
        submittedBy: nextProposalData.submittedBy,
        metadataHash,
        supportingHash,
        proposerWallet: submittingOfficialWallet,
        status: 'Pending Review',
        version: newProposal.version,
        comments: newProposal.revisionComments,
        supportingDocuments: nextProposalData.supportingDocuments?.map((document) => ({
          id: document.id,
          name: document.name,
          title: document.name,
          url: document.url,
          cid: document.cid,
          size: document.size,
          uploadedAt: document.uploadedAt,
        })),
        draftMilestones: draftMilestones.map((milestone) => ({
          title: milestone.title,
          description: milestone.description,
          deliverables: milestone.deliverables || [],
          percentage: milestone.percentage,
          dueDate: milestone.dueDate,
        })),
      });
      setProposals((prev) => [mapProposalFromApi((response as any).proposal), ...prev]);
    } else {
      setProposals((prev) => [...prev, newProposal]);
    }
    logAction('Proposal Submitted', 'MPDC (Planning)', `Submitted proposal ${proposalId} for ${nextProposalData.projectName}`, metadataHash);
  };

  const updateProposal = async (proposalId: string, proposalData: ProposalInput) => {
    const currentProposal = proposals.find((proposal) => proposal.id === proposalId);
    if (!currentProposal) {
      throw new Error('Proposal not found.');
    }

    const { milestones: draftMilestones, error: milestoneValidationError } = validateMilestonePlan(proposalData.draftMilestones || [], { allowEmpty: true });
    if (milestoneValidationError) {
      throw new Error(milestoneValidationError);
    }

    const nextProposalData = {
      ...proposalData,
      draftMilestones,
    };

    const metadataHash = buildProposalMetadataHash(nextProposalData);
    const supportingHash = proposalData.supportingHash || '';
    const isSelfManagedProposal = currentProposal.submittedBy === user?.id;
    const isMpdcReviewEdit = user?.role === 'MPDC (Planning)' && !isSelfManagedProposal;
    const submittingOfficialWallet = isMpdcReviewEdit
      ? (currentProposal.submittingOfficialWallet || undefined)
      : await ensureProposalWalletAuthorization();
    let nextVersion = (currentProposal.version || 1) + 1;
    let isOnChain = currentProposal.isOnChain || false;
    let updatedAt = new Date().toISOString();
    const nextStatus: Proposal['status'] = isMpdcReviewEdit
      ? (currentProposal.status === 'Pending Review' ? 'Under Review' : currentProposal.status)
      : 'Pending Review';

    const updatedProposal = proposals.find((proposal) => proposal.id === proposalId)
      ? {
        ...currentProposal,
        ...nextProposalData,
        status: nextStatus,
        metadataHash,
        supportingHash,
        version: nextVersion,
        submittingOfficialWallet,
        lastTransactionHash: currentProposal.lastTransactionHash,
        isOnChain,
        onChainUpdatedAt: currentProposal.onChainUpdatedAt,
        lastUpdatedAt: updatedAt
      }
      : currentProposal;

    if (token) {
      const response = await apiClient.updateProposal(token, proposalId, {
        projectName: nextProposalData.projectName,
        description: nextProposalData.description,
        location: nextProposalData.location,
        category: nextProposalData.category,
        budget: nextProposalData.budget,
        metadataHash,
        supportingHash,
        proposerWallet: submittingOfficialWallet,
        blockchainTxHash: currentProposal.lastTransactionHash,
        status: nextStatus,
        version: nextVersion,
        comments: nextProposalData.revisionComments,
        supportingDocuments: nextProposalData.supportingDocuments?.map((document) => ({
          id: document.id,
          name: document.name,
          title: document.name,
          url: document.url,
          cid: document.cid,
          size: document.size,
          uploadedAt: document.uploadedAt,
        })),
        draftMilestones: draftMilestones.map((milestone) => ({
          title: milestone.title,
          description: milestone.description,
          deliverables: milestone.deliverables || [],
          percentage: milestone.percentage,
          dueDate: milestone.dueDate,
        })),
      });
      const mapped = mapProposalFromApi((response as any).proposal);
      setProposals((prev) => prev.map((proposal) => proposal.id === proposalId ? mapped : proposal));
    } else {
      setProposals(proposals.map((proposal) => (
        proposal.id === proposalId ? updatedProposal : proposal
      )));
    }
    logAction(isMpdcReviewEdit ? 'Proposal Reviewed' : 'Proposal Revised', 'MPDC (Planning)', `${isMpdcReviewEdit ? 'Reviewed and updated' : 'Revised'} proposal ${proposalId}`, metadataHash);
  };

  const cancelProposal = async (proposalId: string) => {
    const currentProposal = proposals.find((proposal) => proposal.id === proposalId);
    if (!currentProposal) {
      throw new Error('Proposal not found.');
    }

    if (user?.role !== 'Admin' && currentProposal.submittedBy !== user?.id) {
      throw new Error('Only the submitting MPDC account can cancel this proposal.');
    }

    if (currentProposal.status === 'Approved') {
      throw new Error('Approved proposals can no longer be canceled.');
    }

    if (currentProposal.status === 'Rejected') {
      throw new Error('Rejected proposals can no longer be canceled.');
    }

    let txHash = generateHash();
    let isOnChain = currentProposal.isOnChain || false;
    let cancelSyncedOnChain = false;

    try {
      if (contractHasFunction('cancelProposal(string)')) {
        await ensureBlockchainReady('MPDC (Planning)');
        const txRequest = await contract!.populateTransaction.cancelProposal(proposalId);
        const tx = await contract!.signer.sendTransaction({
          ...txRequest,
          gasLimit: ethers.BigNumber.from(500000),
        });
        await tx.wait();
        txHash = tx.hash;
        isOnChain = true;
        cancelSyncedOnChain = true;
      }
    } catch (error) {
      throw new Error(describeBlockchainFailure('Proposal cancelation', error));
    }

    if (token) {
      const response = await apiClient.updateProposal(token, proposalId, {
        projectName: currentProposal.projectName,
        description: currentProposal.description,
        location: currentProposal.location,
        category: currentProposal.category,
        budget: currentProposal.budget,
        metadataHash: currentProposal.metadataHash,
        supportingHash: currentProposal.supportingHash,
        proposerWallet: currentProposal.submittingOfficialWallet,
        blockchainTxHash: cancelSyncedOnChain ? txHash : currentProposal.lastTransactionHash,
        status: 'Canceled',
        version: currentProposal.version,
        comments: currentProposal.revisionComments,
        supportingDocuments: currentProposal.supportingDocuments?.map((document) => ({
          id: document.id,
          name: document.name,
          title: document.name,
          url: document.url,
          cid: document.cid,
          size: document.size,
          uploadedAt: document.uploadedAt,
        })),
      });
      const mapped = mapProposalFromApi((response as any).proposal);
      setProposals((prev) => prev.map((proposal) => proposal.id === proposalId ? mapped : proposal));
    } else {
      setProposals(proposals.map((proposal) => (
        proposal.id === proposalId
          ? {
            ...proposal,
            status: 'Canceled',
            lastUpdatedAt: new Date().toISOString(),
            onChainUpdatedAt: cancelSyncedOnChain ? new Date().toISOString() : proposal.onChainUpdatedAt,
            lastTransactionHash: cancelSyncedOnChain ? txHash : proposal.lastTransactionHash,
            isOnChain
          }
          : proposal
      )));
    }
    logAction(cancelSyncedOnChain ? 'Proposal Canceled (On-Chain)' : 'Proposal Canceled', 'MPDC (Planning)', `Canceled proposal ${proposalId}`, txHash);
  };

  const submitProposalToChain = async (proposalData: ProposalInput) => {
    await addProposal(proposalData);
  };

  const updateProposalMetadataOnChain = async (proposalData: ProposalInput & { id: string }) => {
    const { id, ...rest } = proposalData;
    await updateProposal(id, rest);
  };

  const updateProposalStatus = async (proposalId: string, status: Proposal['status'], comments?: string) => {
    const actorWallet = await ensureProposalReviewAuthorization();

    if (token) {
      const response = await apiClient.updateProposalStatus(token, proposalId, status, comments, actorWallet);
      const mapped = mapProposalFromApi((response as any).proposal);
      setProposals((prev) => prev.map((proposal) => proposal.id === proposalId ? mapped : proposal));
    } else {
      setProposals(proposals.map(p => p.id === proposalId ? {
        ...p,
        status,
        revisionComments: status === 'Revision Requested' ? comments : p.revisionComments,
        lastUpdatedAt: new Date().toISOString()
      } : p));
    }
    logAction('Proposal Updated', 'MPDC (Planning)', `Updated proposal ${proposalId} to ${status}${comments ? `: ${comments}` : ''}`, generateHash());
  };

  const resolveAlert = (alertId: string) => {
    if (!token) {
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, status: 'Resolved' } : a));
      logAction('Alert Resolved', 'Admin', `Resolved alert ${alertId}`, generateHash());
      return;
    }

    apiClient.updateSystemAlert(token, alertId, { status: 'Resolved' })
      .then(() => Promise.all([refreshAlerts(), refreshAuditLogs()]))
      .catch((error) => console.warn('Failed to resolve alert in backend:', error));
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setIsWeb3Connected(false);
    setChainId(null);
    setContract(null);
    localStorage.removeItem('sta-cruz-wallet');
  };

  const addPublicReport = (projectId: string, message: string) => {
    const fullMessage = `Public Report: ${message}`;

    if (token) {
      apiClient.createSystemAlert(token, {
        project_id: projectId,
        message: fullMessage,
        alert_type: 'general',
        severity: 'INFO'
      })
        .then(() => refreshAlerts())
        .catch((error) => {
          console.warn('Failed to create system alert in backend:', error);
          const newAlert: SystemAlert = {
            id: `alert-${Date.now()}`,
            projectId,
            message: fullMessage,
            date: new Date().toISOString(),
            status: 'Unresolved',
            alertType: 'general',
            severity: 'INFO',
            details: {}
          };
          setAlerts([...alerts, newAlert]);
        });
    } else {
      const newAlert: SystemAlert = {
        id: `alert-${Date.now()}`,
        projectId,
        message: fullMessage,
        date: new Date().toISOString(),
        status: 'Unresolved',
        alertType: 'general',
        severity: 'INFO',
        details: {}
      };
      setAlerts([...alerts, newAlert]);
    }
    logAction('Public Report Added', 'Public', `Added public report: ${fullMessage}`, generateHash());
  };

  const addProject = async (projectData: ProjectInput) => {
    const { milestones, error: milestoneValidationError } = validateMilestonePlan(projectData.milestones, { requireTargetDates: false });
    if (milestoneValidationError) {
      throw new Error(milestoneValidationError);
    }

    if (projectData.startDate && projectData.endDate) {
      const start = new Date(projectData.startDate).getTime();
      const end = new Date(projectData.endDate).getTime();
      if (start > end) {
        throw new Error('Project start date cannot be later than the end date.');
      }
    }

    const projectId = `proj-${Date.now()}`;
    const metadataHash = generateTransactionHash(
      projectData.name,
      projectData.totalBudget,
      projectData.category,
      projectData.location,
      projectData.description
    );

    let txHash = generateHash();
    let projectCreatedOnChain = false;

    try {
      await ensureBlockchainReady('MPDC (Planning)');
      const onChainBudget = Math.round(projectData.totalBudget);
      const txRequest = contractHasFunction('createProjectWithMetadata(string,string,uint256,string)')
        ? await contract!.populateTransaction.createProjectWithMetadata(projectId, projectData.name, onChainBudget, metadataHash)
        : await contract!.populateTransaction.createProject(projectId, projectData.name, onChainBudget);
      const tx = await contract!.signer.sendTransaction({
        ...txRequest,
        gasLimit: ethers.BigNumber.from(900000),
      });
      await tx.wait();
      txHash = tx.hash;
      projectCreatedOnChain = true;
    } catch (error) {
      throw new Error(describeBlockchainFailure('Project creation', error));
    }

    if (token) {
      await apiClient.createProject(token, {
        id: projectId,
        name: projectData.name,
        description: projectData.description,
        location: projectData.location,
        category: projectData.category,
        totalBudget: projectData.totalBudget,
        budgetSource: projectData.budgetSource,
        locationPhotos: projectData.locationPhotos,
        startDate: projectData.startDate,
        endDate: projectData.endDate,
        stakeholders: projectData.stakeholders || [],
        metadataHash,
        blockchainTxHash: txHash,
        createdByWallet: walletAddress,
        milestones: milestones.map((milestone) => ({
          title: milestone.title,
          description: milestone.description,
          deliverables: milestone.deliverables || [],
          percentage: milestone.percentage,
          dueDate: milestone.dueDate,
        })),
      });
      await refreshProjects();
      await refreshAuditLogs();
    }

    updateStoredChainBudget(projectId, projectData.totalBudget);
    setChainBudgets((prev) => ({ ...prev, [projectId]: projectData.totalBudget }));

    if (projectCreatedOnChain) {
      await refreshProjectFromChain(projectId).catch(() => undefined);
    }
    logAction('Project Created (On-Chain)', 'MPDC (Planning)', `Created project ${projectData.name}`, txHash);
  };

  const addMilestone = async (projectId: string, milestoneData: Omit<Milestone, 'id'>) => {
    if (!token) {
      throw new Error('You must be logged in to add milestones.');
    }

    await apiClient.createMilestone(token, {
      id: `m-${Date.now()}`,
      projectId,
      title: milestoneData.title,
      description: milestoneData.description,
      percentage: milestoneData.percentage,
      dueDate: milestoneData.dueDate,
    });

    await refreshProjects();
    await refreshAuditLogs();
  };

  const verifyMilestone = async (
    projectId: string,
    milestoneId: string,
    verifiedBy: string,
    photoUrl: string,
    evidence?: { evidenceHash: string; reportHash: string; photoCount: number; reportCount: number }
  ) => {
    const project = projects.find(p => p.id === projectId);
    const milestone = project?.milestones.find(m => m.id === milestoneId);

    if (!project || !milestone) {
      throw new Error('Project or milestone not found');
    }

    if (!isProjectOperationalStatus(project.status)) {
      throw new Error('Milestone verification is blocked until the Treasurer activates the project.');
    }

    if (milestone.status !== 'Pending') {
      throw new Error('Only pending milestones can be verified.');
    }

    await ensureBlockchainReady('MPDC (Planning)');

    // Generate verification data for IPFS
    const verificationData = {
      projectId,
      milestoneId,
      percentage: milestone.percentage,
      verifiedBy,
      timestamp: new Date().toISOString(),
      photos: milestone.photos || [],
      reportUrl: photoUrl
    };

    // Upload verification data to IPFS
    const ipfsHash = await generateVerificationHash(verificationData);

    let txHash = generateHash();
    try {
      let tx;
      if (evidence && contractHasFunction('verifyMilestoneWithEvidence(string,string,uint8,string,string,string,uint8,uint8)')) {
        try {
          tx = await contract!.verifyMilestoneWithEvidence(
            projectId,
            milestoneId,
            milestone.percentage,
            ipfsHash,
            evidence.evidenceHash,
            evidence.reportHash,
            evidence.photoCount,
            evidence.reportCount
          );
        } catch (evidenceTxError: any) {
          const errMsg = String(evidenceTxError?.message || '');
          if (errMsg.includes('At least two photos required')) {
            console.warn("verifyMilestoneWithEvidence rejected due to legacy contract check, falling back to verifyMilestone:", evidenceTxError);
            tx = await contract!.verifyMilestone(projectId, milestoneId, milestone.percentage, ipfsHash);
          } else {
            throw evidenceTxError;
          }
        }
      } else {
        tx = await contract!.verifyMilestone(projectId, milestoneId, milestone.percentage, ipfsHash);
      }
      await tx.wait();
      txHash = tx.hash;
      console.log("Milestone verified on blockchain:", tx.hash);
    } catch (error) {
      console.error("Smart contract call failed:", error);
      throw new Error(describeBlockchainFailure('Milestone verification', error));
    }

    if (token) {
      await apiClient.verifyMilestone(token, milestoneId, {
        verificationData: {
          ...verificationData,
          ipfsHash,
          photoUrl,
          evidenceHash: evidence?.evidenceHash,
          reportHash: evidence?.reportHash,
          photoCount: evidence?.photoCount,
          reportCount: evidence?.reportCount,
        },
        transactionHash: txHash,
      });
      await refreshProjects();
      await refreshAuditLogs();
    }

    await refreshProjectFromChain(projectId).catch(() => undefined);
    logAction('Milestone Verified', 'MPDC (Planning)', `Verified milestone ${milestoneId} (${milestone.percentage}%) on project ${projectId}`, txHash);
  };

  const addDocument = (projectId: string, documentData: Omit<Document, 'id'>) => {
    console.warn('addDocument called without a file payload. Use uploadDocumentWithHash for persisted uploads.', {
      projectId,
      title: documentData.title,
    });
    logAction('Document Uploaded', 'Admin', `Uploaded ${documentData.title} to project ${projectId}`, generateHash());
  };

  const addTransaction = async (projectId: string, txData: Omit<Transaction, 'id' | 'hash' | 'projectId' | 'status'> & { status?: TransactionStatus }, saro?: string, milestoneId?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found.');

    if (txData.type === 'Allocation (SARO)' && project.milestones.length === 0) {
      throw new Error('Allocation blocked: define at least one milestone before signing the SARO.');
    }

    if (txData.type === 'Allocation (SARO)' && project.status !== 'MPDC Approved' && project.status !== 'SARO Approved - Pending Treasurer') {
      throw new Error('Budget Officer action is only allowed while the project is in MPDC Approved status.');
    }

    if (txData.type === 'Disbursement (NCA)' && !project.saro) {
      throw new Error('Cannot disburse: SARO is not signed/allocated for this project.');
    }

    if (txData.type === 'Disbursement (NCA)' && !isProjectOperationalStatus(project.status)) {
      throw new Error('Disbursement is blocked until the Treasurer activates the project.');
    }

    if (txData.type === 'Disbursement (NCA)') {
      if (!milestoneId) {
        throw new Error('Cannot disburse without selecting a verified milestone.');
      }

      const milestone = project.milestones.find((item) => item.id === milestoneId);
      if (!milestone) {
        throw new Error('Selected milestone was not found.');
      }

      if (milestone.status !== 'Verified') {
        throw new Error('Disbursement blocked: only verified milestones can be paid.');
      }
    }

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

    if (txData.type === 'Allocation (SARO)') {
      await ensureBlockchainReady('Budget Officer');
    } else if (txData.type === 'Disbursement (NCA)') {
      await ensureBlockchainReady('Treasurer');
    }

    let txHash = generateTransactionHash(
      projectId,
      txData.amount,
      txData.type,
      txData.date,
      txData.recordedBy
    );
    const disbursementReference = generateTransactionHash(projectId, txData.amount, txData.description, txData.date, txData.recordedBy);

    try {
      if (txData.type === 'Allocation (SARO)') {
        const onChainAmount = Math.round(txData.amount);
        if (txData.status === 'Rejected - Budget Officer') {
          const tx = await contract!.rejectProjectByBudgetOfficer(projectId, txData.description);
          await tx.wait();
          txHash = tx.hash;
        } else {
          // Preflight: check on-chain state to prevent revert if already allocated or clamp amount
          let alreadyAllocatedOnChain = false;
          let chainTotalBudget = onChainAmount;
          let chainAllocatedFunds = 0;

          try {
            const chainProj = await readProjectFromChain(projectId);
            if (chainProj) {
              const chainExists = Boolean(chainProj.exists ?? chainProj[14] ?? chainProj[10] ?? chainProj[5]);
              if (!chainExists) {
                throw new Error(`Project ${projectId} does not exist on the blockchain contract.`);
              }
              const chainStatus = normalizeProjectStatus(chainProj.status ?? chainProj[11] ?? chainProj[10] ?? '');
              chainTotalBudget = toSafeNumber(chainProj.totalBudget ?? chainProj[2] ?? onChainAmount);
              chainAllocatedFunds = toSafeNumber(chainProj.allocatedFunds ?? chainProj[3] ?? 0);

              if (chainStatus === 'SARO Approved - Pending Treasurer' || chainAllocatedFunds > 0) {
                alreadyAllocatedOnChain = true;
                txHash = project.blockchainTxHash || txHash;
              }
            }
          } catch (readErr: any) {
            if (readErr?.message?.includes('does not exist on the blockchain')) {
              throw readErr;
            }
            console.warn('Could not read project from chain before allocation:', readErr);
          }

          if (!alreadyAllocatedOnChain) {
            // Clamp onChainAmount to remaining on-chain budget to eliminate precision/rounding mismatches
            const remainingBudget = Math.max(0, chainTotalBudget - chainAllocatedFunds);
            const targetOnChainAmount = remainingBudget > 0 ? Math.min(onChainAmount, remainingBudget) : onChainAmount;

            const tx = await contract!.allocateFunds(projectId, targetOnChainAmount, saro || "");
            await tx.wait();
            txHash = tx.hash;
          }
        }
      } else if (txData.type === 'Disbursement (NCA)') {
        const onChainAmount = Math.round(txData.amount);
        const tx = contractHasFunction('disburseFundsWithReference(string,uint256,string)')
          ? await contract!.disburseFundsWithReference(projectId, onChainAmount, disbursementReference)
          : await contract!.disburseFunds(projectId, onChainAmount);
        await tx.wait();
        txHash = tx.hash;
        if (milestoneId && contractHasFunction('markMilestonePaid(string,string)')) {
          const markPaidTx = await contract!.markMilestonePaid(projectId, milestoneId);
          await markPaidTx.wait();
        }
      }
    } catch (error) {
      console.error("Smart contract call failed:", error);
      throw new Error(describeBlockchainFailure('Blockchain transaction', error));
    }

    const newTx: Transaction = {
      ...txData,
      id: `tx-${Date.now()}`,
      projectId,
      status: txData.status || (txData.type === 'Allocation (SARO)' ? '1/2 Signed' : 'Executed'),
      hash: txHash
    };

    let backendSyncError: Error | null = null;

    if (token) {
      try {
        await apiClient.createTransaction(token, {
          projectId,
          milestoneId,
          type: txData.type,
          amount: txData.amount,
          description: txData.description,
          recordedByRole: txData.recordedByRole,
          saro,
          status: txData.status || (txData.type === 'Allocation (SARO)' ? '1/2 Signed' : 'Executed'),
          rejectionReason: txData.status === 'Rejected - Budget Officer' ? txData.description : undefined,
          transactionHash: txHash,
        });
        await refreshProjects();
        await refreshAlerts();
        await refreshAuditLogs();
      } catch (error) {
        console.error('Backend transaction sync failed after blockchain success:', error);
        backendSyncError = error instanceof Error ? error : new Error('Unknown backend sync error');
      }
    }

    await refreshProjectFromChain(projectId).catch(() => undefined);

    if (backendSyncError) {
      throw new Error(`Blockchain transaction succeeded, but backend sync failed: ${backendSyncError.message}`);
    }

    logAction(txData.type, txData.recordedByRole, `Amount: PHP ${txData.amount} on project ${projectId}`, newTx.hash);
  };

  const createDisbursementRequest = async (projectId: string, milestoneId: string, contractorAddress: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) throw new Error('Project not found.');

    const milestone = project.milestones.find((item) => item.id === milestoneId);
    if (!milestone) throw new Error('Milestone not found.');
    if (!isProjectOperationalStatus(project.status)) throw new Error('Transaction request blocked: the project must be ACTIVE before execution can begin.');
    if (!project.saro) throw new Error('Transaction request blocked: Budget Officer must sign the SARO first.');
    if (milestone.status !== 'Verified') throw new Error('Transaction request blocked: milestone must be verified by MPDC first.');

    const existingRequest = getMilestoneTransactionRequest(projectId, milestoneId, ['Pending Transaction', '1/2 Signed', 'Executed']);
    if (existingRequest) {
      throw new Error(`A transaction request already exists for this milestone with status "${existingRequest.status}".`);
    }

    const normalizedContractor = contractorAddress.trim().toLowerCase();
    if (!ethers.utils.isAddress(normalizedContractor)) {
      throw new Error('Enter a valid contractor wallet address.');
    }

    await ensureBlockchainReady('MPDC (Planning)');

    const amountDue = calculateMilestoneAllocationAmount(project.allocatedFunds, milestone.percentage);
    if (amountDue <= 0) {
      throw new Error('No remaining amount is due for this milestone.');
    }

    if (project.disbursedFunds + amountDue > project.allocatedFunds) {
      throw new Error('Pending transaction request exceeds the remaining allocated funds.');
    }

    const requestId = `tx-${Date.now()}`;
    const metadataHash = buildDisbursementRequestMetadataHash(projectId, milestoneId, amountDue, normalizedContractor);
    let requestTxHash = generateHash();

    try {
      if (!(await deployedContractSupportsFunction('createDisbursementRequest(string,string,string,address,uint256,string)'))) {
        throw new Error('The deployed contract does not support staged transaction requests yet. Redeploy the updated contract first.');
      }

      const onChainAmountDue = Math.round(amountDue);
      const tx = await contract!.createDisbursementRequest(
        requestId,
        projectId,
        milestoneId,
        normalizedContractor,
        onChainAmountDue,
        metadataHash
      );
      await tx.wait();
      requestTxHash = tx.hash;

      const chainRequest = await readDisbursementRequestFromChain(requestId);
      const chainExists = Boolean(chainRequest?.exists ?? chainRequest?.[16]);
      if (!chainExists) {
        throw new Error(`The pending request ${requestId} was not found on the current contract after creation. This usually means the app is pointing at a different deployment than the one that stored the request.`);
      }
    } catch (error) {
      throw new Error(describeBlockchainFailure('Pending transaction creation', error));
    }

    if (token) {
      await apiClient.createTransaction(token, {
        id: requestId,
        projectId,
        milestoneId,
        type: 'Disbursement (NCA)',
        amount: amountDue,
        description: `Pending transaction request for ${milestone.title}`,
        recordedByRole: 'MPDC (Planning)',
        status: 'Pending Transaction',
        contractorAddress: normalizedContractor,
        requestMetadataHash: metadataHash,
        requestTxHash,
        transactionHash: requestTxHash,
      });
      await refreshProjects();
      await refreshAlerts();
      await refreshAuditLogs();
    }

    logAction('Pending Transaction Created', 'MPDC (Planning)', `Created pending transaction request ${requestId} for milestone ${milestone.title}`, requestTxHash);
  };

  const signDisbursementRequest = async (projectId: string, transactionId: string, supportingHash?: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) throw new Error('Project not found.');

    const request = getProjectTransactionRequests(projectId).find((transaction) => transaction.id === transactionId);
    if (!request) throw new Error('Transaction request not found.');
    if (request.status !== 'Pending Transaction') throw new Error('Only pending transaction requests can be budget-signed.');

    await ensureBlockchainReady('Budget Officer');

    const supportingReference = supportingHash || ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(JSON.stringify({
        transactionId,
        projectId,
        milestoneId: request.milestoneId,
        validatedBy: user?.id || '',
        validatedAt: new Date().toISOString(),
      }))
    );

    let budgetTxHash = generateHash();

    try {
      if (!(await deployedContractSupportsFunction('signDisbursementRequestByBudgetOfficer(string,string)'))) {
        throw new Error('The deployed contract does not support Budget Officer signing for staged transaction requests yet. Redeploy the updated contract first.');
      }

      const chainRequest = await readDisbursementRequestFromChain(transactionId);
      const chainExists = Boolean(chainRequest?.exists ?? chainRequest?.[16]);
      if (!chainExists) {
        throw new Error(
          `Transaction request ${transactionId} is saved in the app database but missing from the current blockchain contract. Recreate or migrate this request on chain before applying the Budget Officer signature.`
        );
      }

      const chainExecuted = Boolean(chainRequest?.executed ?? chainRequest?.[15]);
      if (chainExecuted) {
        throw new Error(`Transaction request ${transactionId} is already executed on chain.`);
      }

      const chainBudgetSigned = Boolean(chainRequest?.budgetSigned ?? chainRequest?.[14]);
      if (chainBudgetSigned) {
        if (token) {
          await apiClient.budgetSignTransaction(token, transactionId, {
            supportingHash: supportingReference,
            transactionHash: request.hash || request.requestTxHash,
          });
          await refreshProjects();
          await refreshAuditLogs();
        }
        return;
      }

      const tx = await contract!.signDisbursementRequestByBudgetOfficer(transactionId, supportingReference);
      await tx.wait();
      budgetTxHash = tx.hash;
    } catch (error) {
      throw new Error(describeBlockchainFailure('Budget Officer signature', error));
    }

    if (token) {
      await apiClient.budgetSignTransaction(token, transactionId, {
        supportingHash: supportingReference,
        transactionHash: budgetTxHash,
      });
      await refreshProjects();
      await refreshAuditLogs();
    }

    logAction('Transaction 1/2 Signed', 'Budget Officer', `Validated transaction request ${transactionId} for project ${projectId}`, budgetTxHash);
  };

  const processPayment = async (projectId: string, milestoneId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found.');

    if (!isProjectOperationalStatus(project.status)) {
      throw new Error('Payment blocked by blockchain: the project must be ACTIVE before execution can continue.');
    }

    if (!project.saro) {
      throw new Error('Payment blocked by blockchain: budget approval (SARO) is not signed by Budget Officer.');
    }

    if (!walletAddress) {
      throw new Error('Please connect your wallet first.');
    }

    if (!(await hasRole('Treasurer', walletAddress))) {
      throw new Error('Your connected wallet does not have Treasurer permissions on chain.');
    }

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) throw new Error('Milestone not found.');
    if (milestone.status !== 'Verified') throw new Error('Payment blocked by blockchain: milestone must be verified by MPDC before payment.');
    if (!milestone.verifiedBy) throw new Error('Payment blocked by blockchain: milestone signature missing from MPDC.');

    const signedRequest = getMilestoneTransactionRequest(projectId, milestoneId, ['1/2 Signed']);
    if (!signedRequest) {
      const pendingRequest = getMilestoneTransactionRequest(projectId, milestoneId, ['Pending Transaction']);
      if (pendingRequest) {
        throw new Error('Payment blocked: waiting for the Budget Officer to provide the first signature.');
      }
      throw new Error('Payment blocked: MPDC must create a pending transaction request before the Treasurer can execute disbursement.');
    }

    let effectiveAllocatedFunds = project.allocatedFunds;
    let chainMilestonePaid = Boolean(milestone.onChainPaid);
    let chainMilestoneVerified = milestone.status === 'Verified' || milestone.status === 'Paid';

    if (contract && isWeb3Connected) {
      try {
        const chainProject = contractHasFunction('getProjectDetails(string)')
          ? await contract.getProjectDetails(projectId)
          : await contract.projects(projectId);
        effectiveAllocatedFunds = Math.max(effectiveAllocatedFunds, toSafeNumber(chainProject.allocatedFunds ?? chainProject[3]));
        const chainMilestone = contractHasFunction('getMilestoneDetails(string,string)')
          ? await contract.getMilestoneDetails(projectId, milestoneId)
          : await contract.projectMilestones(projectId, milestoneId);
        chainMilestoneVerified = Boolean(chainMilestone.isVerified ?? chainMilestone[2]);
        chainMilestonePaid = Boolean(chainMilestone.isPaid ?? chainMilestone[3]);
      } catch (error) {
        console.warn('Unable to preflight payment state from chain, using local state:', error);
      }
    }

    if (chainMilestonePaid) {
      throw new Error('Payment already completed on blockchain for this milestone.');
    }

    const amountDue = signedRequest.amount || calculateMilestoneAllocationAmount(effectiveAllocatedFunds, milestone.percentage);
    if (amountDue <= 0) {
      if (chainMilestoneVerified) {
        throw new Error('Funds for this milestone were already disbursed on blockchain. The remaining issue is paid-status sync, not fund release.');
      }
      throw new Error('No remaining amount is due for this milestone.');
    }

    if (project.disbursedFunds + amountDue > effectiveAllocatedFunds) {
      throw new Error('Payment blocked: executing this milestone would exceed the allocated SARO amount.');
    }

    let executionTxHash = generateHash();
    let digitalSealHash = generateHash();

    try {
      if (!contractHasFunction('executeDisbursementRequest(string,string)')) {
        throw new Error('The deployed contract does not support Treasurer execution for staged transaction requests yet. Redeploy the updated contract first.');
      }

      const provisionalDigitalSeal = buildDigitalSealHash(
        signedRequest.id,
        projectId,
        milestoneId,
        amountDue,
        signedRequest.requestTxHash || signedRequest.hash
      );

      const tx = await contract!.executeDisbursementRequest(signedRequest.id, provisionalDigitalSeal);
      await tx.wait();
      executionTxHash = tx.hash;
      digitalSealHash = buildDigitalSealHash(signedRequest.id, projectId, milestoneId, amountDue, executionTxHash);
    } catch (error) {
      throw new Error(describeBlockchainFailure('Treasurer execution', error));
    }

    if (token) {
      await apiClient.executeTransactionRequest(token, signedRequest.id, {
        transactionHash: executionTxHash,
        digitalSealHash,
      });
      await refreshProjects();
      await refreshAlerts();
      await refreshAuditLogs();
    }

    await refreshProjectFromChain(projectId).catch(() => undefined);
    logAction('Digital Seal of Truth Generated', 'Treasurer', `Treasurer executed transaction request ${signedRequest.id} for milestone ${milestone.id}`, executionTxHash);
  };

  const activateProject = async (projectId: string) => {
    await ensureBlockchainReady('Treasurer');

    const localProject = projects.find((item) => item.id === projectId);
    if (!localProject) throw new Error('Project not found.');

    let latestProject = localProject;
    if (token) {
      try {
        const response = await apiClient.getProjects(token) as { projects: any[] };
        const projectFromApi = (response.projects || []).find((item) => item.id === projectId);
        if (projectFromApi) {
          latestProject = mapProjectFromApi(projectFromApi);
          setProjects((prevProjects) => prevProjects.map((item) => item.id === projectId ? latestProject : item));
        }
      } catch (error) {
        console.warn('Failed to refresh project state before treasury activation:', error);
      }
    }

    let chainProject: any = null;
    try {
      chainProject = await readProjectFromChain(projectId);
    } catch (error) {
      console.warn('Treasury activation pre-check could not read project details from chain. Falling back to synced app state.', error);
    }

    const chainExists = chainProject
      ? Boolean(chainProject.exists ?? chainProject[14] ?? chainProject[10] ?? chainProject[5])
      : true;
    if (!chainExists) {
      throw new Error(`Project ${projectId} does not exist on chain.`);
    }

    const chainAllocatedFunds = chainProject
      ? toSafeNumber(chainProject.allocatedFunds ?? chainProject[3])
      : latestProject.allocatedFunds;
    const chainStatus = chainProject
      ? normalizeProjectStatus(chainProject.status ?? chainProject[11] ?? chainProject[10] ?? latestProject.status)
      : latestProject.status;

    const allocationTransaction = latestProject.transactions.find(
      (transaction) => transaction.type === 'Allocation (SARO)' && transaction.status === '1/2 Signed'
    );

    if (chainStatus === 'ACTIVE' || chainStatus === 'In Progress' || chainStatus === 'Completed') {
      if (token && allocationTransaction) {
        const recoveredSealHash = chainProject
          ? chainProject.treasurySealHash ?? chainProject[13] ?? chainProject[12] ?? allocationTransaction.digitalSealHash ?? null
          : allocationTransaction.digitalSealHash ?? null;
        await apiClient.executeTransactionRequest(token, allocationTransaction.id, {
          transactionHash: allocationTransaction.hash || allocationTransaction.requestTxHash,
          digitalSealHash: recoveredSealHash || undefined,
        });
        await refreshProjects();
        await refreshAlerts();
        await refreshAuditLogs();
      }

      await refreshProjectFromChain(projectId).catch(() => undefined);
      return;
    }

    if (chainStatus !== 'SARO Approved - Pending Treasurer') {
      throw new Error(`Treasury activation is not available because the blockchain project status is "${chainStatus}".`);
    }

    if (chainAllocatedFunds <= 0) {
      throw new Error('Treasury activation is blocked because no allocated SARO amount is recorded on chain.');
    }

    let targetAllocationTx = allocationTransaction;
    if (!targetAllocationTx && token && latestProject.saro) {
      try {
        const createRes = await apiClient.createTransaction(token, {
          projectId,
          type: 'Allocation (SARO)',
          amount: latestProject.allocatedFunds || latestProject.totalBudget,
          description: `SARO Allocation: ${latestProject.saro}`,
          recordedByRole: 'Budget Officer',
          saro: latestProject.saro,
          status: '1/2 Signed',
          transactionHash: latestProject.blockchainTxHash || generateHash(),
        }) as { transaction: Transaction };
        if (createRes?.transaction) {
          targetAllocationTx = createRes.transaction;
        }
      } catch (err) {
        console.warn('Could not auto-create missing allocation transaction during activation:', err);
      }
    }

    if (!targetAllocationTx) {
      throw new Error('No pending SARO allocation was found for Treasury execution.');
    }

    const provisionalSeal = buildDigitalSealHash(
      targetAllocationTx.id,
      projectId,
      'project-activation',
      targetAllocationTx.amount,
      targetAllocationTx.hash || targetAllocationTx.requestTxHash || generateHash()
    );

    let executionTxHash = generateHash();
    let treasurySealHash = provisionalSeal;

    try {
      if (!(await deployedContractSupportsFunction('approveProjectActivation(string,string)'))) {
        throw new Error(`The deployed contract at ${CONTRACT_ADDRESS} does not support Treasury activation yet. Redeploy the updated contract and update the app environment to the new address first.`);
      }

      try {
        await contract!.callStatic.approveProjectActivation(projectId, provisionalSeal);
      } catch (error) {
        const diagnosticBits = [
          `contract=${CONTRACT_ADDRESS}`,
          `project=${projectId}`,
          `localStatus=${latestProject.status}`,
          `chainStatus=${chainStatus}`,
          `allocated=${chainAllocatedFunds}`,
          `tx=${targetAllocationTx.id}`,
        ];
        throw new Error(`${describeBlockchainFailure('Treasury activation preflight', error)} [${diagnosticBits.join(', ')}]`);
      }

      const tx = await contract!.approveProjectActivation(projectId, provisionalSeal);
      await tx.wait();
      executionTxHash = tx.hash;
      treasurySealHash = buildDigitalSealHash(
        targetAllocationTx.id,
        projectId,
        'project-activation',
        targetAllocationTx.amount,
        executionTxHash
      );
    } catch (error) {
      await refreshProjectFromChain(projectId).catch(() => undefined);
      throw new Error(describeBlockchainFailure('Treasury activation', error));
    }

    if (token) {
      await apiClient.executeTransactionRequest(token, targetAllocationTx.id, {
        transactionHash: executionTxHash,
        digitalSealHash: treasurySealHash,
      });
      await refreshProjects();
      await refreshAlerts();
      await refreshAuditLogs();
    }

    await refreshProjectFromChain(projectId).catch(() => undefined);
    logAction('Project Activated', 'Treasurer', `Treasurer activated project ${projectId} with a digital seal of truth`, executionTxHash);
  };

  const rejectProjectBudget = async (projectId: string, reason: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) throw new Error('Project not found.');
    if (project.status !== 'MPDC Approved') {
      throw new Error('Budget rejection is only available while the project is in MPDC Approved status.');
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error('A rejection reason is required.');
    }

    await addTransaction(projectId, {
      amount: project.totalBudget,
      type: 'Allocation (SARO)',
      date: new Date().toISOString(),
      recordedBy: user?.id || '',
      recordedByRole: 'Budget Officer',
      description: trimmedReason,
      status: 'Rejected - Budget Officer',
    });
  };

  const rejectProjectTreasury = async (projectId: string, transactionId: string, reason: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) throw new Error('Project not found.');
    if (project.status !== 'SARO Approved - Pending Treasurer') {
      throw new Error('Treasurer rejection is only available while the project is pending Treasury approval.');
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error('A rejection reason is required.');
    }

    await ensureBlockchainReady('Treasurer');

    let rejectionTxHash = generateHash();
    try {
      if (!(await deployedContractSupportsFunction('rejectProjectByTreasurer(string,string)'))) {
        throw new Error(`The deployed contract at ${CONTRACT_ADDRESS} does not support Treasury rejection yet. Redeploy the updated contract and update the app environment to the new address first.`);
      }

      const tx = await contract!.rejectProjectByTreasurer(projectId, trimmedReason);
      await tx.wait();
      rejectionTxHash = tx.hash;
    } catch (error) {
      throw new Error(describeBlockchainFailure('Treasury rejection', error));
    }

    if (token) {
      await apiClient.rejectTreasurerTransaction(token, transactionId, {
        reason: trimmedReason,
        transactionHash: rejectionTxHash,
      });
      await refreshProjects();
      await refreshAlerts();
      await refreshAuditLogs();
    }

    await refreshProjectFromChain(projectId).catch(() => undefined);
    logAction('Project Rejected', 'Treasurer', `Treasurer rejected project ${projectId}: ${trimmedReason}`, rejectionTxHash);
  };

  const recordApproval = (projectId: string, stage: ApprovalStage['stage'], approvedBy: string, approvedByRole: Role, comments?: string) => {
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        const newApproval: ApprovalStage = {
          id: `approval-${Date.now()}`,
          stage,
          status: 'Verified',
          approvedBy,
          approvedByRole,
          timestamp: new Date().toISOString(),
          signature: generateHash(),
          comments
        };
        return {
          ...p,
          approvalStages: [...(p.approvalStages || []), newApproval]
        };
      }
      return p;
    }));
  };

  const getProjectApprovals = (projectId: string): ApprovalStage[] => {
    const project = projects.find(p => p.id === projectId);
    return project?.approvalStages || [];
  };

  const calculateComplianceScore = (projectId: string): ComplianceScore => {
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      return {
        projectId,
        totalScore: 0,
        documentScore: 0,
        milestoneScore: 0,
        budgetScore: 0,
        auditScore: 0,
        lastUpdated: new Date().toISOString()
      };
    }

    // Document Score (0-25)
    const requiredDocs = 3; // Minimum required documents
    const documentScore = Math.min((project.documents.length / requiredDocs) * 25, 25);

    // Milestone Score (0-25)
    const verifiedMilestones = project.milestones.filter(m => m.status === 'Verified').length;
    const milestoneScore = project.milestones.length > 0 ? (verifiedMilestones / project.milestones.length) * 25 : 0;

    // Budget Score (0-25)
    const budgetUtilization = project.totalBudget > 0 ? (project.disbursedFunds / project.allocatedFunds) : 0;
    const budgetScore = Math.min(Math.abs(budgetUtilization - 1) * 25, 25); // Penalize over/under-spending

    // Audit Score (0-25)
    const auditLogCount = auditLogs.filter((log: AuditLog) => log.details.includes(projectId)).length;
    const auditScore = Math.min((auditLogCount / 5) * 25, 25);

    const totalScore = Math.round(documentScore + milestoneScore + budgetScore + auditScore);

    return {
      projectId,
      totalScore: Math.min(totalScore, 100),
      documentScore: Math.round(documentScore),
      milestoneScore: Math.round(milestoneScore),
      budgetScore: Math.round(budgetScore),
      auditScore: Math.round(auditScore),
      lastUpdated: new Date().toISOString()
    };
  };

  const getAllDepartmentBudgets = (): DepartmentBudget[] => {
    const departments = new Map<string, DepartmentBudget>();

    projects.forEach(project => {
      const dept = project.category || 'Unassigned';

      if (!departments.has(dept)) {
        departments.set(dept, {
          department: dept,
          allocatedBudget: 0,
          spentBudget: 0,
          projectCount: 0
        });
      }

      const budget = departments.get(dept)!;
      budget.allocatedBudget += project.allocatedFunds;
      budget.spentBudget += project.disbursedFunds;
      budget.projectCount += 1;
    });

    return Array.from(departments.values());
  };

  const uploadDocumentWithHash = async (projectId: string, doc: Omit<Document, 'id' | 'ipfsHash' | 'checksumHash'>, file: File, milestoneId?: string) => {
    try {
      // Upload file to IPFS
      const ipfsHash = await uploadToIPFS(file, doc.title);

      if (token) {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('projectId', projectId);
        formData.append('documentType', doc.type);
        formData.append('ipfsHash', ipfsHash);
        if (milestoneId) {
          formData.append('milestoneId', milestoneId);
        }
        if (doc.title) {
          formData.append('description', doc.title);
        }
        await apiClient.uploadDocument(token, formData);
        await refreshProjects();
        await refreshAuditLogs();
      }

      logAction('Document Uploaded (IPFS)', 'Admin', `Uploaded ${doc.title} to IPFS: ${ipfsHash}`, ipfsHash);
      console.log('Document uploaded to IPFS:', ipfsHash);
    } catch (error) {
      console.error('Failed to upload document to IPFS:', error);
      logAction('Document Uploaded (Fallback)', 'Admin', `Uploaded ${doc.title} (IPFS failed)`, 'fallback');
      throw error;
    }
  };

  const addMilestonePhoto = async (projectId: string, milestoneId: string, photo: Omit<MilestonePhoto, 'id'>, file: File) => {
    if (!token) {
      throw new Error('You must be logged in to upload milestone photos.');
    }

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('projectId', projectId);
    formData.append('photoType', photo.type);
    formData.append('description', photo.description || '');
    formData.append('capturedAt', photo.timestamp);

    await apiClient.uploadMilestonePhoto(token, milestoneId, formData);
    await refreshProjects();
    await refreshAuditLogs();
  };

  const checkMilestoneVerificationRequirements = (projectId: string, milestoneId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      return { isReady: false, photoCount: 0, reportCount: 0, missingPhotos: 1, missingReports: 1 };
    }

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      return { isReady: false, photoCount: 0, reportCount: 0, missingPhotos: 1, missingReports: 1 };
    }

    const photoCount = (milestone.photos || []).length;
    const reportCount = project.documents.filter(d =>
      d.milestoneId === milestoneId &&
      d.type === 'Report' &&
      (d.fileFormat === 'PDF' || d.url.toLowerCase().endsWith('.pdf'))
    ).length;

    const missingPhotos = Math.max(0, 1 - photoCount);
    const missingReports = Math.max(0, 1 - reportCount);
    const isReady = photoCount >= 1 && reportCount >= 1;

    return { isReady, photoCount, reportCount, missingPhotos, missingReports };
  };

  return (
    <BlockchainContext.Provider value={{
      projects, alerts, auditLogs, proposals, isLoading,
      isWeb3Connected, walletAddress, chainId, contract, connectToWeb3, disconnectWallet,
      addProject, addMilestone, verifyMilestone, addDocument, addTransaction, createDisbursementRequest, signDisbursementRequest, processPayment, activateProject, rejectProjectBudget, rejectProjectTreasury, grantRole, revokeRole, hasRole, resolveAlert, addPublicReport, addProposal, updateProposal, cancelProposal, submitProposalToChain, updateProposalMetadataOnChain, updateProposalStatus, recordApproval, getProjectApprovals, calculateComplianceScore, getAllDepartmentBudgets, uploadDocumentWithHash, addMilestonePhoto, checkMilestoneVerificationRequirements, refreshProjectFromChain,
      chainBudgets, tamperedProjects, refreshChainBudgets
    }}>
      {children}
    </BlockchainContext.Provider>
  );
};

export const useBlockchain = (): BlockchainContextType => {
  const context = useContext(BlockchainContext);
  if (context === undefined) {
    throw new Error('useBlockchain must be used within a BlockchainProvider');
  }
  return context;
};
