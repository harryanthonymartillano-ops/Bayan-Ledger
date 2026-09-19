# Supabase Setup Guide

This backend uses Supabase (PostgreSQL) to store application-level project, milestone, document, user, and transaction records, while the Ethereum Sepolia smart contract (`BayanLedger`) serves as the immutable on-chain source of truth for critical authorizations, fund allocations, and disbursements.

---

## What Supabase Stores vs. What Stays On-Chain

### What Supabase Stores (Fast querying, reporting & dashboards)
- User profiles, roles, and linked wallet addresses
- Project metadata, categories, locations, and descriptions
- Milestone details, deliverables, and progress tracking
- Milestone verification photos and attached document references
- Transaction logs, SARO/NCA references, and timestamps
- System alerts, tampering notifications, and audit log history
- Citizen project comments and community photos
- Mirrored blockchain event logs and background sync queue jobs

### What Stays On-Chain (Immutable proof of record)
- Project creation cryptographic anchor (`metadataHash`)
- Budget allocation and SARO reference (`recordSAROAllocation`)
- Milestone completion verification proof (`verifyMilestone`)
- Fund disbursement transaction proof (`disburseFunds`)
- Evidence hashes (SHA-256 / IPFS) for milestone completion
- Treasury digital seal and authorized signatory addresses

---

## Setup Instructions

### 1. Create Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. In Project Settings -> **API**, locate and copy:
   - `Project URL` (`SUPABASE_URL`)
   - `anon / public key` (`SUPABASE_ANON_KEY`)
   - `service_role secret` (`SUPABASE_SERVICE_ROLE_KEY`)

### 2. Run the Database Schema
1. Open the Supabase **SQL Editor** in your dashboard.
2. Open and copy the contents of [`backend/supabase/schema.sql`](./supabase/schema.sql).
3. Paste into the SQL Editor and click **Run**.
4. *(Optional / Upgrading)*: If upgrading from an older schema where transaction hashes were missing in audit trails, run [`backend/supabase/backfill-audit-logs-tx-hash.sql`](./supabase/backfill-audit-logs-tx-hash.sql).

### 3. Configure Backend Environment
1. Copy [`.env.example`](./.env.example) to `.env` inside the `backend/` directory:
   ```bash
   cp .env.example .env
   ```
2. Fill in the values:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `CONTRACT_ADDRESS` (deployed `BayanLedger` address on Sepolia)
   - `SEPOLIA_RPC_URL` (Infura or Alchemy endpoint)
   - Cloudinary keys (optional, only if using Cloudinary for media uploads)

### 4. Create Storage Bucket
1. In the Supabase Dashboard, navigate to **Storage**.
2. Click **New Bucket** and name it `project-documents`.
3. Set bucket access (Private recommended for municipal documents, Public if open transparency download is required).

### 5. Start the Backend API
```powershell
cd backend
npm install
npm run dev
```

---

## Validated Tables

The backend expects the following tables in the `public` schema:
- `users`: Registered officials and their role/wallet assignments
- `projects`: LGU projects with budget and SARO details
- `milestones`: Milestone goals, deliverables, and statuses
- `milestone_photos`: Image proof records with IPFS/SHA-256 hashes
- `documents`: Uploaded supporting documentation
- `transactions`: Milestone payments, signatures, and NCA hashes
- `project_comments`: Citizen community comments
- `project_comment_photos`: Photos attached to citizen comments
- `audit_logs`: Audit trail for compliance monitoring
- `system_alerts`: System notifications and security/tamper alerts
- `blockchain_events`: Mirrored on-chain event logs
- `blockchain_sync_queue`: Background queue for blockchain transaction retries
- `notifications`: User notification delivery records

---

## Initial Admin Setup

After running the schema, register the initial administrator account:
1. Run the test admin creation script:
   ```bash
   node create-test-admin.js
   ```
2. Or register via the application frontend, then use the Supabase table editor to verify your user record in `users`.
3. Ensure the official wallet address is assigned and `chain_role_granted` is set to `true` once on-chain role assignment is completed.
