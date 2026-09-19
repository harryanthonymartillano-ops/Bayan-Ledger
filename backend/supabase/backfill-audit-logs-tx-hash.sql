-- Backfill tx_hash in audit_logs for PROJECT_CREATED_DIRECT_APPROVAL actions
-- This updates existing audit logs to pull the blockchain_tx_hash from the projects table
UPDATE public.audit_logs
SET tx_hash = projects.blockchain_tx_hash
FROM public.projects
WHERE audit_logs.resource_type = 'project'
  AND audit_logs.resource_id = projects.id
  AND audit_logs.action = 'PROJECT_CREATED_DIRECT_APPROVAL'
  AND audit_logs.tx_hash IS NULL
  AND projects.blockchain_tx_hash IS NOT NULL;

-- Backfill tx_hash for TRANSACTION_REQUEST_CREATED actions from transactions table
UPDATE public.audit_logs
SET tx_hash = transactions.request_tx_hash
FROM public.transactions
WHERE audit_logs.resource_type = 'transaction'
  AND audit_logs.resource_id = transactions.id
  AND audit_logs.action = 'TRANSACTION_REQUEST_CREATED'
  AND audit_logs.tx_hash IS NULL
  AND transactions.request_tx_hash IS NOT NULL;

-- Backfill tx_hash for MILESTONE_VERIFIED actions from milestones table
UPDATE public.audit_logs
SET tx_hash = milestones.blockchain_tx_hash
FROM public.milestones
WHERE audit_logs.resource_type = 'milestone'
  AND audit_logs.resource_id = milestones.id
  AND audit_logs.action = 'MILESTONE_VERIFIED'
  AND audit_logs.tx_hash IS NULL
  AND milestones.blockchain_tx_hash IS NOT NULL;

-- Backfill tx_hash for DOCUMENT_UPLOADED actions from documents table
UPDATE public.audit_logs
SET tx_hash = documents.blockchain_tx_hash
FROM public.documents
WHERE audit_logs.resource_type = 'document'
  AND audit_logs.resource_id = documents.id
  AND audit_logs.action = 'DOCUMENT_UPLOADED'
  AND audit_logs.tx_hash IS NULL
  AND documents.blockchain_tx_hash IS NOT NULL;
