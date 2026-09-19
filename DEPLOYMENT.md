# BayanLedger Deployment Checklist

This document provides step-by-step instructions for deploying the BayanLedger platform across its database, backend, smart contract, and frontend layers.

---

## 1. Database Setup (Supabase)

1. Open your project in the [Supabase Dashboard](https://app.supabase.com) and navigate to the **SQL Editor**.
2. Run `backend/supabase/schema.sql`. This initializes the following tables and indexes:
   - `users`: User profiles with split names, roles, and linked wallet addresses
   - `projects`: Infrastructure projects, statuses, and SARO metadata
   - `milestones`: Milestones, target deliverables, and verification statuses
   - `milestone_photos`: Photographic evidence attached to milestones
   - `documents`: Uploaded supporting files and checksum hashes
   - `transactions`: Milestone payment records, signatures, and NCA hashes
   - `project_comments`: Citizen community comments and feedback
   - `project_comment_photos`: Photos uploaded alongside citizen comments
   - `audit_logs`: Detailed system and blockchain transaction audit logs
   - `blockchain_events`: Mirrored on-chain event records
   - `blockchain_sync_queue`: Queue for reconciling and retrying on-chain sync operations
   - `notifications`: User notification delivery records
3. *(Optional / Upgrades)*: If upgrading from an earlier version with missing audit trail hashes, execute `backend/supabase/backfill-audit-logs-tx-hash.sql`.
4. In **Storage**, create a bucket named `project-documents`. Set access according to privacy requirements (private by default for internal government records).

---

## 2. Backend API Deployment

1. Copy `backend/.env.example` to `backend/.env` and populate all required variables:
   - `PORT=5000`
   - `SUPABASE_URL`: Your Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (for administrative access)
   - `JWT_SECRET`: Secure string (at least 32 characters)
   - `CONTRACT_ADDRESS`: The deployed `BayanLedger` contract address on Sepolia
   - `SEPOLIA_RPC_URL`: Infura/Alchemy RPC URL for Sepolia network queries
   - `CHAIN_ID=11155111`
   - `FRONTEND_URL`: Allowed CORS origin for the frontend (e.g. `http://localhost:3000` or production domain)
2. *(Optional Storage)*: Provide `CLOUDINARY_*` credentials if routing file uploads to Cloudinary; otherwise files persist locally in `backend/uploads`.
3. Install dependencies and start the backend service:
   ```bash
   cd backend
   npm install
   npm run dev      # Development with live reloading
   # OR
   npm run build && npm run start # Production build
   ```

---

## 3. Smart Contract Deployment (Hardhat)

1. Ensure the root `.env` has:
   - `SEPOLIA_URL`: RPC endpoint (Infura/Alchemy)
   - `PRIVATE_KEY`: Deployer private key with sufficient Sepolia ETH
2. Deploy the `BayanLedger` smart contract to Sepolia:
   ```bash
   npm run hardhat:deploy:sepolia
   ```
3. The deployment script outputs contract details to `artifacts/deployment.latest.json`.
4. Copy the deployed contract address and update:
   - Root `.env` -> `CONTRACT_ADDRESS` & `VITE_CONTRACT_ADDRESS`
   - `backend/.env` -> `CONTRACT_ADDRESS`

---

## 4. On-Chain Role Assignment

Municipal workflow operations require on-chain role authorization. Assign roles to official municipal wallet addresses:

1. Configure wallet addresses in the root `.env`:
   - `MPDC_WALLET_ADDRESS`
   - `BUDGET_WALLET_ADDRESS`
   - `TREASURER_WALLET_ADDRESS`
2. Run the role grant script:
   ```bash
   npm run hardhat:grant-roles:sepolia
   ```
3. Admins can also grant or revoke roles interactively via the **User Management (RBAC)** interface in the official dashboard.

---

## 5. Frontend Deployment

1. Copy `.env.example` to `.env` in the project root:
   - `VITE_CONTRACT_ADDRESS`: Deployed `BayanLedger` smart contract address
   - `VITE_API_BASE_URL`: Full URL of the backend API (e.g., `http://localhost:5000/api` or production URL)
2. Install dependencies and build the production bundle:
   ```bash
   npm install
   npm run build
   ```
3. Deploy the compiled `dist/` directory to your static hosting provider (e.g., Vercel, Netlify, Cloudflare Pages).

---

## 6. Blockchain Event Synchronization

The backend provides endpoints to synchronize and queue events emitted by the smart contract:
- `GET /api/blockchain/events`: Retrieve recorded blockchain events
- `POST /api/blockchain/events`: Persist a new contract event record
- `GET /api/blockchain/sync-queue`: Inspect pending event synchronization jobs
- `POST /api/blockchain/sync-queue`: Enqueue an entity for retryable blockchain sync
- `PATCH /api/blockchain/sync-queue/:id`: Update synchronization task status

---

## 7. Production Security Checklist

Before going live in a production municipal environment:
- [ ] Enforce HTTPS across all frontend and backend domains.
- [ ] Store private keys and service keys in secure vault/environment secret management (never commit to git).
- [ ] Ensure Supabase Row-Level Security (RLS) policies and storage bucket access rules match municipal compliance policies.
- [ ] Set proper CORS policies restricting access to designated municipal domains.
- [ ] Enable log retention and monitoring for tamper alerts and suspicious activities.
