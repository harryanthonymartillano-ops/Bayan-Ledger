import { Router, Response } from 'express';
import { supabase } from '../db/config';
import { logger } from '../logger';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { createNotification, notifyUsers } from './notifications';
import {
  generateSAROHash,
  generateDigitalSealHash,
  generateSignatureHash,
  generateMilestoneVerificationHash,
} from '../lib/hashUtils';

const router = Router();

const normalizeRole = (role: string) => role.trim().toLowerCase();
const normalizeTransactionType = (type: string) => type.trim().toLowerCase();
const normalizeTransactionStatus = (status: string | undefined) => status?.trim().toLowerCase() || '';

const isMpdcRole = (role: string) => {
  const normalized = normalizeRole(role);
  return normalized === 'mpdc (planning)' || normalized === 'mpdc';
};

const isBudgetOfficerRole = (role: string) => normalizeRole(role) === 'budget officer';
const isTreasurerRole = (role: string) => normalizeRole(role) === 'treasurer';

const isAllocationTransaction = (type: string) => {
  const normalized = normalizeTransactionType(type);
  return normalized === 'allocation' || normalized === 'allocation (saro)';
};

const isDisbursementTransaction = (type: string) => {
  const normalized = normalizeTransactionType(type);
  return normalized === 'disbursement' || normalized === 'disbursement (nca)';
};

const isPendingTransactionStatus = (status: string | undefined) => normalizeTransactionStatus(status) === 'pending transaction';
const isHalfSignedStatus = (status: string | undefined) => normalizeTransactionStatus(status) === '1/2 signed';
const isBudgetRejectedStatus = (status: string | undefined) => normalizeTransactionStatus(status) === 'rejected - budget officer';
const isTreasurerRejectedStatus = (status: string | undefined) => normalizeTransactionStatus(status) === 'rejected - treasurer';

const isOperationalProjectStatus = (status: string | null | undefined) => status === 'ACTIVE' || status === 'In Progress';
const isRejectedProjectStatus = (status: string | null | undefined) =>
  status === 'Rejected - Budget Officer' || status === 'Rejected - Treasurer';

const inferProjectStatus = (
  currentStatus: string | null | undefined,
  allocatedFunds: number,
  disbursedFunds: number,
  milestoneStatuses: string[]
) => {
  if (currentStatus === 'Completed' || currentStatus === 'On Hold' || isRejectedProjectStatus(currentStatus)) {
    return currentStatus;
  }

  if (disbursedFunds > 0 || milestoneStatuses.some((status) => status === 'Verified' || status === 'Paid')) {
    if (allocatedFunds > 0 && disbursedFunds >= allocatedFunds) {
      return 'Completed';
    }
    return 'In Progress';
  }

  if (currentStatus === 'SARO Approved - Pending Treasurer') {
    return 'SARO Approved - Pending Treasurer';
  }

  if (currentStatus === 'ACTIVE') {
    return 'ACTIVE';
  }

  return 'MPDC Approved';
};

const insertAuditLog = async (payload: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  hash?: string;
  txHash?: string;
}) => {
  // Extract hash from details if it contains a transactionHash field
  const txHashToStore = payload.txHash || (payload.details?.transactionHash as string) || null;
  const hashToStore = payload.hash || txHashToStore || null;

  await supabase.from('audit_logs').insert({
    user_id: payload.userId,
    action: payload.action,
    resource_type: payload.resourceType,
    resource_id: payload.resourceId,
    details: payload.details || {},
    hash: hashToStore,
    tx_hash: txHashToStore,
  });
};

const fetchProjectMilestoneStatuses = async (projectId: string) => {
  const { data, error } = await supabase
    .from('milestones')
    .select('id, status')
    .eq('project_id', projectId);

  if (error) {
    throw error;
  }

  return data || [];
};

// Get transactions for a project
router.get('/project/:projectId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }

    res.json({ transactions: data });
  } catch (error) {
    logger.error('Fetch transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Create transaction
router.post('/', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      id,
      projectId,
      milestoneId,
      type,
      amount,
      description,
      recipient,
      paymentMethod,
      recordedByRole,
      saro,
      transactionHash,
      status,
      contractorAddress,
      requestMetadataHash,
      supportingHash,
      requestTxHash,
      rejectionReason,
    } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!projectId || !type || !amount) {
      return res.status(400).json({ error: 'Project ID, type, and amount are required' });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        created_by,
        total_budget,
        allocated_funds,
        disbursed_funds,
        saro,
        latest_disbursement_ref,
        status
      `)
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      logger.error('Project lookup error:', projectError);
      return res.status(404).json({ error: 'Project not found' });
    }

    const milestones = await fetchProjectMilestoneStatuses(projectId);
    const isAllocation = isAllocationTransaction(type);
    const isDisbursement = isDisbursementTransaction(type);
    const requestedStatus = String(status || '').trim() || (isAllocation ? '1/2 Signed' : 'Executed');

    let nextAllocatedFunds = Number(project.allocated_funds || 0);
    let nextDisbursedFunds = Number(project.disbursed_funds || 0);
    let nextSaro = project.saro || null;
    let nextDisbursementReference = project.latest_disbursement_ref || null;

    if (isAllocation) {
      if (!isBudgetOfficerRole(req.user.role)) {
        return res.status(403).json({ error: 'Only the Budget Officer can act on budget allocation' });
      }

      if (project.status !== 'MPDC Approved' && project.status !== 'SARO Approved - Pending Treasurer') {
        return res.status(400).json({ error: 'Budget allocation is only allowed while the project is in MPDC Approved status' });
      }

      if (project.status === 'SARO Approved - Pending Treasurer') {
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('*')
          .eq('project_id', projectId)
          .eq('type', type)
          .maybeSingle();

        if (existingTx) {
          return res.status(200).json({ transaction: existingTx });
        }
      }

      if ((milestones || []).length === 0) {
        return res.status(400).json({ error: 'Allocation blocked: define at least one project milestone before signing the SARO' });
      }

      const allocationTransactionId = `tx-${Date.now()}`;
      const decidedAt = new Date().toISOString();

      if (isBudgetRejectedStatus(requestedStatus)) {
        const resolvedReason = String(rejectionReason || description || '').trim();
        if (!resolvedReason) {
          return res.status(400).json({ error: 'A rejection reason is required when the Budget Officer rejects the project' });
        }

        const { data, error } = await supabase
          .from('transactions')
          .insert({
            id: allocationTransactionId,
            project_id: projectId,
            type,
            amount: Math.round(numericAmount),
            date: decidedAt,
            description: resolvedReason,
            recipient,
            payment_method: paymentMethod,
            initiated_by: req.user!.id,
            recorded_by: req.user.id,
            recorded_by_role: recordedByRole || req.user.role,
            hash: transactionHash || null,
            blockchain_tx_hash: transactionHash || null,
            signature_count: 1,
            budget_signed_at: decidedAt,
            budget_signed_by: req.user!.id,
            budget_signature_hash: transactionHash || null,
            rejection_reason: resolvedReason,
            rejected_by_role: 'Budget Officer',
            status: 'Rejected - Budget Officer',
          })
          .select()
          .single();

        if (error) {
          logger.error('Budget rejection transaction create error:', error);
          return res.status(500).json({ error: 'Failed to record the Budget Officer rejection' });
        }

        const { error: projectUpdateError } = await supabase
          .from('projects')
          .update({
            status: 'Rejected - Budget Officer',
            rejection_reason: resolvedReason,
            rejected_by_role: 'Budget Officer',
            budget_officer_signed_at: decidedAt,
            budget_officer_wallet: req.user.walletAddress || null,
            blockchain_tx_hash: transactionHash || null,
            onchain_synced_at: transactionHash ? decidedAt : null,
            updated_at: decidedAt,
          })
          .eq('id', projectId);

        if (projectUpdateError) {
          logger.error('Project rejection sync error:', projectUpdateError);
          return res.status(500).json({ error: 'Rejection recorded but project status failed to sync' });
        }

        await insertAuditLog({
          userId: req.user!.id,
          action: 'PROJECT_REJECTED_BY_BUDGET_OFFICER',
          resourceType: 'project',
          resourceId: projectId,
          details: { reason: resolvedReason, transactionHash: transactionHash || null },
        });

        return res.status(201).json({ transaction: data });
      }

      if (!saro) {
        return res.status(400).json({ error: 'SARO reference is required before the allocation can be recorded' });
      }

      if (Number(project.allocated_funds || 0) > 0) {
        nextAllocatedFunds = Number(project.allocated_funds || 0);
      } else {
        nextAllocatedFunds += numericAmount;
      }
      if (nextAllocatedFunds > Number(project.total_budget || 0) + 0.01) {
        return res.status(400).json({ error: 'Allocation exceeds total budget' });
      }

      nextSaro = saro || nextSaro;

      // Generate SARO hash if not provided
      const saroHash = transactionHash || generateSAROHash(
        projectId,
        nextSaro,
        numericAmount,
        req.user!.id,
        decidedAt
      );

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          id: allocationTransactionId,
          project_id: projectId,
          type,
          amount: Math.round(numericAmount),
          date: decidedAt,
          description,
          recipient,
          payment_method: paymentMethod,
          initiated_by: req.user!.id,
          recorded_by: req.user.id,
          recorded_by_role: recordedByRole || req.user.role,
          hash: saroHash,
          saro: nextSaro,
          blockchain_tx_hash: saroHash,
          signature_count: 1,
          budget_signed_at: decidedAt,
          budget_signed_by: req.user!.id,
          budget_signature_hash: saroHash,
          status: '1/2 Signed',
        })
        .select()
        .single();

      if (error) {
        logger.error('Allocation transaction create error:', error);
        return res.status(500).json({ error: 'Failed to create allocation transaction' });
      }

      const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({
          allocated_funds: nextAllocatedFunds,
          status: 'SARO Approved - Pending Treasurer',
          saro: nextSaro,
          rejection_reason: null,
          rejected_by_role: null,
          budget_officer_signed_at: decidedAt,
          budget_officer_wallet: req.user.walletAddress || null,
          blockchain_tx_hash: saroHash,
          onchain_synced_at: decidedAt,
          updated_at: decidedAt,
        })
        .eq('id', projectId);

      if (projectUpdateError) {
        logger.error('Project sync error after allocation create:', projectUpdateError);
        return res.status(500).json({ error: 'Allocation saved but project totals failed to sync' });
      }

      await insertAuditLog({
        userId: req.user!.id,
        action: 'SARO_CREATED_PENDING_TREASURER',
        resourceType: 'transaction',
        resourceId: data.id,
        details: { projectId, amount: numericAmount, saro: nextSaro, transactionHash: saroHash },
      });

      const { data: treasurers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'Treasurer')
        .eq('status', 'Active');

      if (treasurers?.length) {
        await notifyUsers({
          userIds: treasurers.map((item) => item.id),
          type: 'approval',
          title: 'SARO Ready for Treasury Sign-off',
          message: `Budget Officer created SARO ${nextSaro} for project "${project.name}". Treasurer approval is now required.`,
          link: `/official/disbursement-pipeline?projectId=${projectId}`,
          resourceType: 'project',
          resourceId: projectId,
        });
      }

      return res.status(201).json({ transaction: data });
    }

    if (isDisbursement && isPendingTransactionStatus(requestedStatus)) {
      if (!isMpdcRole(req.user.role)) {
        return res.status(403).json({ error: 'Only MPDC can create pending disbursement requests' });
      }

      if (!milestoneId) {
        return res.status(400).json({ error: 'Milestone ID is required for a pending transaction request' });
      }

      if (!isOperationalProjectStatus(project.status)) {
        return res.status(400).json({ error: 'Pending transaction request blocked: the project must be ACTIVE before execution can begin' });
      }

      if (!project.saro) {
        return res.status(400).json({ error: 'Pending transaction request blocked: SARO has not been signed by the Budget Officer' });
      }

      if (!contractorAddress) {
        return res.status(400).json({ error: 'Contractor wallet address is required for a transaction request' });
      }

      const targetMilestone = milestones.find((milestone) => milestone.id === milestoneId);
      if (!targetMilestone) {
        return res.status(404).json({ error: 'Milestone not found for this project' });
      }

      if (targetMilestone.status !== 'Verified') {
        return res.status(400).json({ error: 'Pending transaction request blocked: only verified milestones can be requested for payment' });
      }

      const availableFunds = nextAllocatedFunds - nextDisbursedFunds;
      if (numericAmount > availableFunds + 0.01) {
        return res.status(400).json({ error: 'Pending transaction request exceeds allocated funds' });
      }

      const requestId = String(id || '').trim() || `tx-${Date.now()}`;

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          id: requestId,
          project_id: projectId,
          milestone_id: milestoneId,
          type,
          amount: Math.round(numericAmount),
          date: new Date().toISOString(),
          description,
          recipient,
          contractor_wallet: String(contractorAddress).toLowerCase(),
          payment_method: paymentMethod,
          initiated_by: req.user!.id,
          recorded_by: req.user.id,
          recorded_by_role: recordedByRole || req.user.role,
          hash: requestTxHash || transactionHash || null,
          request_tx_hash: requestTxHash || transactionHash || null,
          request_metadata_hash: requestMetadataHash || null,
          supporting_hash: supportingHash || null,
          signature_count: 0,
          saro: saro || project.saro || null,
          blockchain_reference_hash: requestTxHash || transactionHash || null,
          status: 'Pending Transaction',
        })
        .select()
        .single();

      if (error) {
        logger.error('Pending transaction request create error:', error);
        return res.status(500).json({ error: 'Failed to create pending transaction request' });
      }

      await insertAuditLog({
        userId: req.user!.id,
        action: 'TRANSACTION_REQUEST_CREATED',
        resourceType: 'transaction',
        resourceId: data.id,
        details: {
          requestId,
          projectId,
          milestoneId,
          amount: numericAmount,
          transactionHash: data.request_tx_hash,
        },
        txHash: data.request_tx_hash,
      });

      const { data: budgetOfficers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'Budget Officer')
        .eq('status', 'Active');

      if (budgetOfficers?.length) {
        await notifyUsers({
          userIds: budgetOfficers.map((item) => item.id),
          type: 'approval',
          title: 'Disbursement Request Needs Signature',
          message: `MPDC created a disbursement request for project "${project.name}". Budget Officer sign-off is now required.`,
          link: `/official/disbursement-pipeline?projectId=${projectId}`,
          resourceType: 'transaction',
          resourceId: data.id,
        });
      }

      return res.status(201).json({ transaction: data });
    }

    if (isDisbursement) {
      if (!isTreasurerRole(req.user.role)) {
        return res.status(403).json({ error: 'Only the Treasurer can record direct disbursements' });
      }

      if (!milestoneId) {
        return res.status(400).json({ error: 'Milestone ID is required for disbursement' });
      }

      if (!isOperationalProjectStatus(project.status)) {
        return res.status(400).json({ error: 'Disbursement blocked: the project must be ACTIVE before funds can be released' });
      }

      const targetMilestone = milestones.find((milestone) => milestone.id === milestoneId);
      if (!targetMilestone) {
        return res.status(404).json({ error: 'Milestone not found for this project' });
      }

      if (targetMilestone.status !== 'Verified') {
        return res.status(400).json({ error: 'Disbursement blocked: only verified milestones can be paid' });
      }

      const availableFunds = nextAllocatedFunds - nextDisbursedFunds;
      if (numericAmount > availableFunds + 0.01) {
        return res.status(400).json({ error: 'Insufficient allocated funds' });
      }

      nextDisbursedFunds += numericAmount;
      nextDisbursementReference = transactionHash || nextDisbursementReference;
    }

    const nextStatus = inferProjectStatus(
      project.status,
      nextAllocatedFunds,
      nextDisbursedFunds,
      (milestones || []).map((milestone) => milestone.status)
    );

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        id: `tx-${Date.now()}`,
        project_id: projectId,
        milestone_id: milestoneId || null,
        type,
        amount: Math.round(numericAmount),
        date: new Date().toISOString(),
        description,
        recipient,
        payment_method: paymentMethod,
        initiated_by: req.user!.id,
        recorded_by: req.user.id,
        recorded_by_role: recordedByRole || req.user.role,
        hash: transactionHash,
        saro: saro || null,
        blockchain_tx_hash: transactionHash,
        contractor_wallet: contractorAddress ? String(contractorAddress).toLowerCase() : null,
        request_metadata_hash: requestMetadataHash || null,
        supporting_hash: supportingHash || null,
        request_tx_hash: requestTxHash || null,
        signature_count: isDisbursement ? 2 : 1,
        status: isDisbursement ? 'Executed' : requestedStatus,
      })
      .select()
      .single();

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to create transaction' });
    }

    const projectUpdates: Record<string, unknown> = {
      allocated_funds: nextAllocatedFunds,
      disbursed_funds: nextDisbursedFunds,
      status: nextStatus,
      updated_at: new Date().toISOString(),
      blockchain_tx_hash: transactionHash,
      onchain_synced_at: transactionHash ? new Date().toISOString() : null,
    };

    if (isDisbursement) {
      projectUpdates.latest_disbursement_ref = nextDisbursementReference;
    }

    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update(projectUpdates)
      .eq('id', projectId);

    if (projectUpdateError) {
      logger.error('Project sync error after transaction create:', projectUpdateError);
      return res.status(500).json({ error: 'Transaction saved but project totals failed to sync' });
    }

    if (isDisbursement && milestoneId) {
      const { error: milestoneUpdateError } = await supabase
        .from('milestones')
        .update({
          status: 'Paid',
          onchain_paid: true,
          blockchain_tx_hash: transactionHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', milestoneId);

      if (milestoneUpdateError) {
        logger.error('Milestone sync error after disbursement:', milestoneUpdateError);
        return res.status(500).json({ error: 'Transaction saved but milestone status failed to sync' });
      }
    }

    await insertAuditLog({
      userId: req.user!.id,
      action: 'TRANSACTION_CREATED',
      resourceType: 'transaction',
      resourceId: data.id,
      details: { projectId, milestoneId, type, amount: numericAmount, saro, transactionHash },
    });

    if (project.created_by) {
      await createNotification({
        userId: project.created_by,
        type: 'transaction',
        title: 'New Transaction Recorded',
        message: `A ${type} transaction of PHP ${numericAmount.toLocaleString()} has been recorded for project "${project.name}".`,
        link: `/official/payment-hashes?projectId=${projectId}`,
        resourceType: 'transaction',
        resourceId: data.id,
      });
    }

    res.status(201).json({ transaction: data });
  } catch (error) {
    logger.error('Create transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

router.post('/:id/budget-sign', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isBudgetOfficerRole(req.user.role)) {
      return res.status(403).json({ error: 'Only the Budget Officer can provide the first signature' });
    }

    const { id } = req.params;
    const { supportingHash, transactionHash, requestId } = req.body;
    const nextRequestId = String(requestId || '').trim();

    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !transaction) {
      return res.status(404).json({ error: 'Transaction request not found' });
    }

    if (!isDisbursementTransaction(transaction.type)) {
      return res.status(400).json({ error: 'Only disbursement requests can be budget-signed' });
    }

    if (!isPendingTransactionStatus(transaction.status)) {
      return res.status(400).json({ error: 'Only pending transaction requests can be budget-signed' });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, status')
      .eq('id', transaction.project_id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!isOperationalProjectStatus(project.status)) {
      return res.status(400).json({ error: 'Budget sign-off is only allowed after the Treasurer activates the project' });
    }

    const signedAt = new Date().toISOString();

    // Generate signature hash if not provided
    const budgetSignatureHash = transactionHash || generateSignatureHash(
      id as string,
      req.user!.id,
      signedAt,
      supportingHash
    );

    const { data, error } = await supabase
      .from('transactions')
      .update({
        ...(nextRequestId && nextRequestId !== id ? { id: nextRequestId } : {}),
        status: '1/2 Signed',
        signature_count: 1,
        supporting_hash: supportingHash || transaction.supporting_hash || null,
        budget_signed_at: signedAt,
        budget_signed_by: req.user!.id,
        budget_signature_hash: budgetSignatureHash,
        recorded_by: req.user!.id,
        recorded_by_role: req.user!.role,
        updated_at: signedAt,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Budget sign update error:', error);
      return res.status(500).json({ error: 'Failed to mark transaction as 1/2 signed' });
    }

    await insertAuditLog({
      userId: req.user!.id,
      action: 'TRANSACTION_REQUEST_BUDGET_SIGNED',
      resourceType: 'transaction',
      resourceId: String(data.id),
      details: {
        transactionHash: budgetSignatureHash,
        supportingHash: supportingHash || null,
        requestId: nextRequestId || id,
        previousRequestId: nextRequestId && nextRequestId !== id ? id : null,
      },
    });

    const { data: treasurers } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'Treasurer')
      .eq('status', 'Active');

    if (treasurers?.length) {
      await notifyUsers({
        userIds: treasurers.map((item) => item.id),
        type: 'approval',
        title: 'Payment Ready for Treasury Execution',
        message: `Budget Officer signed a disbursement request for project "${project.name}". Treasurer execution is now required.`,
        link: `/official/payment-hashes?projectId=${project.id}`,
        resourceType: 'transaction',
        resourceId: String(data.id),
      });
    }

    res.json({ transaction: data });
  } catch (error) {
    logger.error('Budget sign error:', error);
    res.status(500).json({ error: 'Failed to sign transaction request' });
  }
});

router.post('/:id/treasurer-execute', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isTreasurerRole(req.user.role)) {
      return res.status(403).json({ error: 'Only the Treasurer can execute this approval' });
    }

    const { id } = req.params;
    const { transactionHash, digitalSealHash, requestId } = req.body;
    const nextRequestId = String(requestId || '').trim();

    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !transaction) {
      return res.status(404).json({ error: 'Transaction request not found' });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, created_by, allocated_funds, disbursed_funds, latest_disbursement_ref, status')
      .eq('id', transaction.project_id)
      .single();

    if (projectError || !project) {
      logger.error('Project lookup error during treasurer execute:', projectError);
      return res.status(404).json({ error: 'Project not found' });
    }

    if (isAllocationTransaction(transaction.type)) {
      if (!isHalfSignedStatus(transaction.status)) {
        return res.status(400).json({ error: 'Allocation must be in 1/2 Signed status before Treasurer execution' });
      }

      if (project.status !== 'SARO Approved - Pending Treasurer') {
        return res.status(400).json({ error: 'Project is not awaiting Treasurer approval' });
      }

      const executedAt = new Date().toISOString();

      // Generate digital seal hash if not provided
      const treasurySealHash = digitalSealHash || generateDigitalSealHash(
        id as string,
        req.user!.id,
        executedAt,
        transaction.amount
      );

      const finalBlockchainHash = transactionHash || transaction.hash || treasurySealHash;

      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'Completed',
          signature_count: 2,
          treasurer_signed_at: executedAt,
          treasurer_signed_by: req.user!.id,
          digital_seal_hash: treasurySealHash,
          hash: finalBlockchainHash,
          blockchain_tx_hash: finalBlockchainHash,
          blockchain_reference_hash: treasurySealHash,
          recorded_by: req.user!.id,
          recorded_by_role: req.user!.role,
          updated_at: executedAt,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Treasurer allocation execution update error:', error);
        return res.status(500).json({ error: 'Failed to execute SARO approval' });
      }

      const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({
          status: 'ACTIVE',
          treasurer_signed_at: executedAt,
          treasurer_wallet: req.user.walletAddress || null,
          treasury_seal_hash: treasurySealHash,
          activated_at: executedAt,
          rejection_reason: null,
          rejected_by_role: null,
          blockchain_tx_hash: finalBlockchainHash,
          onchain_synced_at: executedAt,
          updated_at: executedAt,
        })
        .eq('id', transaction.project_id);

      if (projectUpdateError) {
        logger.error('Project activation sync error during treasurer execute:', projectUpdateError);
        return res.status(500).json({ error: 'SARO executed but project activation failed to sync' });
      }

      await insertAuditLog({
        userId: req.user!.id,
        action: 'PROJECT_ACTIVATED_BY_TREASURER',
        resourceType: 'project',
        resourceId: transaction.project_id,
        details: { transactionHash: finalBlockchainHash, digitalSealHash: treasurySealHash },
      });

      if (project.created_by) {
        await createNotification({
          userId: project.created_by,
          type: 'approval',
          title: 'Project Activated',
          message: `Treasurer approved the SARO for project "${project.name}". The project is now ACTIVE and ready for execution.`,
          link: `/official/dashboard?projectId=${transaction.project_id}`,
          resourceType: 'project',
          resourceId: transaction.project_id,
        });
      }

      return res.json({ transaction: data });
    }

    if (!isDisbursementTransaction(transaction.type)) {
      return res.status(400).json({ error: 'Only allocation or disbursement requests can be executed' });
    }

    if (!isHalfSignedStatus(transaction.status)) {
      return res.status(400).json({ error: 'Transaction must be in 1/2 Signed status before execution' });
    }

    if (!isOperationalProjectStatus(project.status)) {
      return res.status(400).json({ error: 'Project must be ACTIVE before Treasurer execution' });
    }

    const { data: milestone, error: milestoneError } = await supabase
      .from('milestones')
      .select('id, status')
      .eq('id', transaction.milestone_id)
      .single();

    if (milestoneError || !milestone) {
      return res.status(404).json({ error: 'Milestone not found for this transaction request' });
    }

    if (milestone.status !== 'Verified') {
      return res.status(400).json({ error: 'Milestone must still be verified before Treasurer execution' });
    }

    const nextAllocatedFunds = Number(project.allocated_funds || 0);
    const nextDisbursedFunds = Number(project.disbursed_funds || 0) + Number(transaction.amount || 0);
    if (nextDisbursedFunds > nextAllocatedFunds + 0.01) {
      return res.status(400).json({ error: 'Execution would exceed allocated funds' });
    }

    const executedAt = new Date().toISOString();

    // Generate digital seal hash for disbursement if not provided
    const disbursementSealHash = digitalSealHash || generateDigitalSealHash(
      id as string,
      req.user!.id,
      executedAt,
      transaction.amount
    );

    const finalDisbursementHash = transactionHash || transaction.hash || disbursementSealHash;

    const { data, error } = await supabase
      .from('transactions')
      .update({
        ...(nextRequestId && nextRequestId !== id ? { id: nextRequestId } : {}),
        status: 'Executed',
        signature_count: 2,
        treasurer_signed_at: executedAt,
        treasurer_signed_by: req.user!.id,
        digital_seal_hash: disbursementSealHash,
        hash: finalDisbursementHash,
        blockchain_tx_hash: finalDisbursementHash,
        blockchain_reference_hash: disbursementSealHash,
        recorded_by: req.user!.id,
        recorded_by_role: req.user!.role,
        updated_at: executedAt,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Treasurer execution update error:', error);
      return res.status(500).json({ error: 'Failed to execute transaction request' });
    }

    const milestoneStatuses = await fetchProjectMilestoneStatuses(transaction.project_id);
    const nextStatus = inferProjectStatus(
      project.status,
      nextAllocatedFunds,
      nextDisbursedFunds,
      milestoneStatuses.map((item) => item.id === transaction.milestone_id ? 'Paid' : item.status)
    );

    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({
        disbursed_funds: nextDisbursedFunds,
        latest_disbursement_ref: disbursementSealHash || project.latest_disbursement_ref || null,
        status: nextStatus,
        updated_at: executedAt,
        blockchain_tx_hash: finalDisbursementHash,
        onchain_synced_at: executedAt,
      })
      .eq('id', transaction.project_id);

    if (projectUpdateError) {
      logger.error('Project sync error during treasurer execute:', projectUpdateError);
      return res.status(500).json({ error: 'Transaction executed but project totals failed to sync' });
    }

    const { error: milestoneUpdateError } = await supabase
      .from('milestones')
      .update({
        status: 'Paid',
        onchain_paid: true,
        blockchain_tx_hash: finalDisbursementHash,
        updated_at: executedAt,
      })
      .eq('id', transaction.milestone_id);

    if (milestoneUpdateError) {
      logger.error('Milestone sync error during treasurer execute:', milestoneUpdateError);
      return res.status(500).json({ error: 'Transaction executed but milestone status failed to sync' });
    }

    await insertAuditLog({
      userId: req.user!.id,
      action: 'TRANSACTION_REQUEST_EXECUTED',
      resourceType: 'transaction',
      resourceId: String(data.id),
      details: {
        transactionHash: finalDisbursementHash,
        digitalSealHash: disbursementSealHash,
        requestId: nextRequestId || id,
        previousRequestId: nextRequestId && nextRequestId !== id ? id : null,
      },
    });

    if (project.created_by) {
      await createNotification({
        userId: project.created_by,
        type: 'transaction',
        title: 'Transaction Executed',
        message: `Treasurer executed the transaction request for milestone on project "${project.name}".`,
        link: `/official/payment-hashes?projectId=${transaction.project_id}`,
        resourceType: 'transaction',
        resourceId: String(data.id),
      });
    }

    res.json({ transaction: data });
  } catch (error) {
    logger.error('Treasurer execute error:', error);
    res.status(500).json({ error: 'Failed to execute transaction request' });
  }
});

router.post('/:id/treasurer-reject', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isTreasurerRole(req.user.role)) {
      return res.status(403).json({ error: 'Only the Treasurer can reject SARO approval' });
    }

    const { id } = req.params;
    const { transactionHash, rejectionReason } = req.body;

    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (!isAllocationTransaction(transaction.type)) {
      return res.status(400).json({ error: 'Only SARO allocation transactions can be rejected at the Treasurer gate' });
    }

    if (!isHalfSignedStatus(transaction.status)) {
      return res.status(400).json({ error: 'Only 1/2 Signed SARO transactions can be rejected by the Treasurer' });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, created_by, status')
      .eq('id', transaction.project_id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.status !== 'SARO Approved - Pending Treasurer') {
      return res.status(400).json({ error: 'Project is not awaiting Treasurer approval' });
    }

    const rejectedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('transactions')
      .update({
        status: 'Rejected - Treasurer',
        rejection_reason: rejectionReason,
        rejected_by_role: 'Treasurer',
        treasurer_signed_at: rejectedAt,
        treasurer_signed_by: req.user!.id,
        blockchain_tx_hash: transactionHash || null,
        recorded_by: req.user!.id,
        recorded_by_role: req.user!.role,
        updated_at: rejectedAt,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Treasurer rejection update error:', error);
      return res.status(500).json({ error: 'Failed to record the Treasurer rejection' });
    }

    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({
        status: 'Rejected - Treasurer',
        rejection_reason: rejectionReason,
        rejected_by_role: 'Treasurer',
        treasurer_signed_at: rejectedAt,
        treasurer_wallet: req.user.walletAddress || null,
        blockchain_tx_hash: transactionHash || null,
        onchain_synced_at: transactionHash ? rejectedAt : null,
        updated_at: rejectedAt,
      })
      .eq('id', transaction.project_id);

    if (projectUpdateError) {
      logger.error('Project sync error during Treasurer rejection:', projectUpdateError);
      return res.status(500).json({ error: 'Rejection saved but project status failed to sync' });
    }

    await insertAuditLog({
      userId: req.user!.id,
      action: 'PROJECT_REJECTED_BY_TREASURER',
      resourceType: 'project',
      resourceId: transaction.project_id,
      details: { reason: rejectionReason, transactionHash: transactionHash || null },
    });

    if (project.created_by) {
      await createNotification({
        userId: project.created_by,
        type: 'approval',
        title: 'Project Rejected by Treasurer',
        message: `Treasurer rejected the SARO activation for project "${project.name}".`,
        link: `/official/dashboard?projectId=${transaction.project_id}`,
        resourceType: 'project',
        resourceId: transaction.project_id,
      });
    }

    res.json({ transaction: data });
  } catch (error) {
    logger.error('Treasurer rejection error:', error);
    res.status(500).json({ error: 'Failed to reject SARO approval' });
  }
});

// Update transaction status
router.patch('/:id/status', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const { data, error } = await supabase
      .from('transactions')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to update transaction status' });
    }

    await insertAuditLog({
      userId: req.user!.id,
      action: 'TRANSACTION_STATUS_UPDATED',
      resourceType: 'transaction',
      resourceId: String(id),
      details: { status, notes },
    });

    res.json({ transaction: data });
  } catch (error) {
    logger.error('Update transaction status error:', error);
    res.status(500).json({ error: 'Failed to update transaction status' });
  }
});

// Get transaction by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ transaction: data });
  } catch (error) {
    logger.error('Fetch transaction error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Delete transaction (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to delete transaction' });
    }

    await insertAuditLog({
      userId: req.user!.id,
      action: 'TRANSACTION_DELETED',
      resourceType: 'transaction',
      resourceId: String(id),
    });

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    logger.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

export default router;
