const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { ethers } = require('ethers');
const { createClient } = require('../backend/node_modules/@supabase/supabase-js');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env'), override: false });

const artifactPath = path.resolve(__dirname, '../artifacts/contracts/StaCruzChain.sol/BayanLedger.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, artifact.abi, wallet);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ACTIVE_STATUSES = new Set(['ACTIVE', 'In Progress', 'Completed']);

const hashText = (value) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));

async function ensureRole(roleName) {
  const roleHash = await contract[roleName]();
  const hasRole = await contract.roles(roleHash, wallet.address);
  if (hasRole) {
    console.log(`Role already granted: ${roleName}`);
    return;
  }

  console.log(`Granting ${roleName} to ${wallet.address}`);
  const tx = await contract.grantRole(roleHash, wallet.address);
  await tx.wait();
}

async function readProject(projectId) {
  try {
    return await contract.projects(projectId);
  } catch (error) {
    return null;
  }
}

async function readMilestone(projectId, milestoneId) {
  try {
    return await contract.projectMilestones(projectId, milestoneId);
  } catch (error) {
    return null;
  }
}

async function readRequest(requestId) {
  try {
    return await contract.disbursementRequests(requestId);
  } catch (error) {
    return null;
  }
}

function randomSeal(prefix, id) {
  return hashText(`${prefix}:${id}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`);
}

async function migrate() {
  console.log(`Migrating state to contract ${process.env.CONTRACT_ADDRESS} with wallet ${wallet.address}`);

  await ensureRole('MPDC_ROLE');
  await ensureRole('BUDGET_OFFICER_ROLE');
  await ensureRole('TREASURER_ROLE');

  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id,name,total_budget,status,allocated_funds,disbursed_funds,saro,metadata_hash,treasury_seal_hash');

  if (projectError) throw projectError;

  for (const project of projects || []) {
    console.log(`\nProject ${project.id} - ${project.name}`);
    let chainProject = await readProject(project.id);

    if (!chainProject || !chainProject.exists) {
      console.log('Creating project on chain');
      const tx = await contract.createProjectWithMetadata(
        project.id,
        project.name,
        Number(project.total_budget || 0),
        project.metadata_hash || ''
      );
      await tx.wait();
      chainProject = await readProject(project.id);
    }

    const allocatedFunds = Number(project.allocated_funds || 0);
    if (allocatedFunds > 0 && Number(chainProject.allocatedFunds || 0) === 0) {
      console.log(`Allocating SARO ${project.saro || 'MIGRATED-SARO'} for ${allocatedFunds}`);
      const tx = await contract.allocateFunds(project.id, allocatedFunds, project.saro || 'MIGRATED-SARO');
      await tx.wait();
      chainProject = await readProject(project.id);
    }

    if (ACTIVE_STATUSES.has(project.status) && chainProject && chainProject.status !== 'ACTIVE' && chainProject.status !== 'In Progress' && chainProject.status !== 'Completed') {
      console.log('Activating project on chain');
      const tx = await contract.approveProjectActivation(project.id, project.treasury_seal_hash || randomSeal('project-activation', project.id));
      await tx.wait();
      chainProject = await readProject(project.id);
    }

    const { data: milestones, error: milestoneError } = await supabase
      .from('milestones')
      .select('id,title,status,percentage,evidence_hash,report_hash,evidence_photo_count,evidence_report_count')
      .eq('project_id', project.id);

    if (milestoneError) throw milestoneError;

    for (const milestone of milestones || []) {
      if (milestone.status !== 'Verified' && milestone.status !== 'Paid') continue;
      const chainMilestone = await readMilestone(project.id, milestone.id);
      if (chainMilestone && chainMilestone.isVerified) continue;

      console.log(`Verifying milestone ${milestone.id} on chain`);
      const tx = await contract.verifyMilestoneWithEvidence(
        project.id,
        milestone.id,
        Number(milestone.percentage || 0),
        '',
        milestone.evidence_hash || '',
        milestone.report_hash || '',
        Number(milestone.evidence_photo_count || 1),
        Number(milestone.evidence_report_count || 1)
      );
      await tx.wait();
    }

    const { data: transactions, error: transactionError } = await supabase
      .from('transactions')
      .select('id,milestone_id,type,status,amount,contractor_wallet,request_metadata_hash,supporting_hash,digital_seal_hash')
      .eq('project_id', project.id)
      .eq('type', 'Disbursement (NCA)');

    if (transactionError) throw transactionError;

    for (const transaction of transactions || []) {
      const chainRequest = await readRequest(transaction.id);

      if (!chainRequest || !chainRequest.exists) {
        console.log(`Creating disbursement request ${transaction.id} on chain`);
        const tx = await contract.createDisbursementRequest(
          transaction.id,
          project.id,
          transaction.milestone_id,
          transaction.contractor_wallet,
          Number(transaction.amount || 0),
          transaction.request_metadata_hash || hashText(`request:${transaction.id}`)
        );
        await tx.wait();
      }

      const refreshedRequest = await readRequest(transaction.id);

      if ((transaction.status === '1/2 Signed' || transaction.status === 'Executed') && refreshedRequest && !refreshedRequest.budgetSigned) {
        console.log(`Budget-signing request ${transaction.id} on chain`);
        const tx = await contract.signDisbursementRequestByBudgetOfficer(
          transaction.id,
          transaction.supporting_hash || hashText(`budget-sign:${transaction.id}`)
        );
        await tx.wait();
      }

      const executedRequest = await readRequest(transaction.id);
      if (transaction.status === 'Executed' && executedRequest && !executedRequest.executed) {
        console.log(`Executing request ${transaction.id} on chain`);
        const tx = await contract.executeDisbursementRequest(
          transaction.id,
          transaction.digital_seal_hash || randomSeal('disbursement-execution', transaction.id)
        );
        await tx.wait();
      }
    }
  }

  console.log('\nMigration complete.');
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
