export interface Project {
  id: string;
  name: string;
  description?: string;
  location: string;
  category: string;
  start_date?: string;
  end_date?: string;
  stakeholders?: unknown[];
  total_budget: number;
  allocated_funds: number;
  disbursed_funds: number;
  status:
    | 'MPDC Approved'
    | 'SARO Approved - Pending Treasurer'
    | 'ACTIVE'
    | 'In Progress'
    | 'Completed'
    | 'Rejected - Budget Officer'
    | 'Rejected - Treasurer'
    | 'On Hold';
  saro?: string;
  metadata_hash?: string;
  latest_disbursement_ref?: string;
  rejection_reason?: string;
  rejected_by_role?: string;
  budget_officer_signed_at?: string;
  budget_officer_wallet?: string;
  treasurer_signed_at?: string;
  treasurer_wallet?: string;
  treasury_seal_hash?: string;
  activated_at?: string;
  contract_address?: string;
  chain_id?: string;
  blockchain_created_by_wallet?: string;
  blockchain_tx_hash?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  onchain_synced_at?: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  due_date?: string;
  budget?: number;
  deliverables?: unknown[];
  percentage: number;
  status: 'Pending' | 'Verified' | 'Paid';
  verification_data?: Record<string, unknown>;
  date_verified?: string;
  verified_by?: string;
  verified_by_wallet?: string;
  photo_url?: string;
  ipfs_hash?: string;
  evidence_hash?: string;
  report_hash?: string;
  evidence_photo_count?: number;
  evidence_report_count?: number;
  onchain_verified_at?: string;
  onchain_paid: boolean;
  blockchain_tx_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface MilestonePhoto {
  id: string;
  milestone_id: string;
  project_id: string;
  photo_type: 'before' | 'after' | 'proof';
  url: string;
  photo_hash?: string;
  ipfs_hash?: string;
  description?: string;
  uploaded_by?: string;
  uploaded_by_wallet?: string;
  captured_at?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  project_id: string;
  milestone_id?: string;
  amount: number;
  type: 'Allocation (SARO)' | 'Disbursement (NCA)';
  date: string;
  recipient?: string;
  payment_method?: string;
  initiated_by?: string;
  recorded_by?: string;
  recorded_by_role: string;
  description?: string;
  hash?: string;
  saro?: string;
  blockchain_reference_hash?: string;
  blockchain_tx_hash?: string;
  status:
    | 'pending'
    | 'confirmed'
    | 'failed'
    | 'Pending Transaction'
    | '1/2 Signed'
    | 'Executed'
    | 'Completed'
    | 'Rejected - Budget Officer'
    | 'Rejected - Treasurer';
  rejection_reason?: string;
  rejected_by_role?: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  milestone_id?: string;
  title: string;
  name?: string;
  type: 'Procurement' | 'Contract' | 'Personnel' | 'Other' | 'Report' | 'Invoice';
  url: string;
  storage_provider: 'supabase' | 'cloudinary' | 'ipfs' | 'external';
  storage_path?: string;
  ipfs_hash?: string;
  checksum_hash?: string;
  cloudinary_id?: string;
  mime_type?: string;
  file_format?: string;
  size?: number;
  uploaded_by?: string;
  uploaded_by_wallet?: string;
  description?: string;
  verified: boolean;
  verified_by?: string;
  verified_date?: string;
  blockchain_tx_hash?: string;
  date_uploaded: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  user_role?: string;
  user_id?: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  hash?: string;
  tx_hash?: string;
  created_at: string;
}

export interface ProjectCommentPhoto {
  id: string;
  comment_id: string;
  project_id: string;
  url: string;
  storage_provider: 'local' | 'cloudinary';
  storage_path?: string;
  cloudinary_id?: string;
  mime_type?: string;
  size?: number;
  file_name?: string;
  photo_hash?: string;
  created_at: string;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  display_name: string;
  content: string;
  created_at: string;
  updated_at: string;
  photos?: ProjectCommentPhoto[];
}

export interface SystemAlert {
  id: string;
  project_id: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'Unresolved' | 'Resolved';
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  wallet_address?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  role: string;
  chain_role_granted: boolean;
  chain_role_granted_at?: string;
  status: 'Active' | 'Inactive';
  last_login?: string;
  created_at: string;
  updated_at: string;
}



export interface BlockchainEvent {
  id: string;
  project_id?: string;
  milestone_id?: string;
  event_name: string;
  tx_hash: string;
  block_number?: number;
  log_index?: number;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface BlockchainSyncQueueItem {
  id: string;
  entity_type: 'project' | 'milestone' | 'transaction' | 'document' | 'event';
  entity_id: string;
  sync_action: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  last_error?: string;
  payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
