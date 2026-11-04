
# Audit Log Blockchain Hash Issue - Complete Analysis

## Problem Summary
The "Not recorded" status appearing in the Audit Trails page indicates that audit log entries are missing blockchain transaction hashes. This occurs because the `hash` and `tx_hash` fields in audit log records are not being populated during log creation.

---

## Frontend Display (Line 455 in AuditTrails.tsx)
```typescript
<span>{shortenHash(log.hash || log.tx_hash)}</span>
```

When both `hash` and `tx_hash` are null, the `shortenHash` function (line 104-105) returns **"Not recorded"**:
```typescript
const shortenHash = (value?: string | null) => {
  if (!value) return 'Not recorded';
  // ... truncate hash display
};
```

---

## Database Schema
The `audit_logs` table **DOES have** the fields available:
```sql
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  action text not null,
  user_role text,
  user_id uuid references public.users(id) on delete set null,
  resource_type text,
  resource_id text,
  details jsonb,
  hash text,              -- ✅ Available but empty
  tx_hash text,           -- ✅ Available but empty
  created_at timestamptz not null default now()
);
```

---

## Root Cause Analysis

### ✅ Correct Implementation (blockchain.ts)
The blockchain route **correctly** records tx_hash when handling blockchain events:

**File:** `backend/src/routes/blockchain.ts` (lines 59-74)
```typescript
await supabase.from('audit_logs').insert({
  user_id: req.user?.id || null,
  action: 'BLOCKCHAIN_EVENT_RECORDED',
  resource_type: 'blockchain_event',
  resource_id: data.id,
  details: { event_name, tx_hash, project_id, milestone_id },
  tx_hash,  // ✅ CORRECTLY INCLUDED
});
```

### ❌ Missing Implementation (20+ Locations)

**Files with missing tx_hash in audit log insertions:**

#### backend/src/routes/projects.ts (4 locations)
- Line ~623: PROJECT_CREATED_DIRECT_APPROVAL
- Line ~667: PROJECT_STATUS_UPDATED  
- Line ~715: (Unknown action)
- Line ~746: (Unknown action)

**Example (Line 623 area):**
```typescript
await supabase.from('audit_logs').insert({
  user_id: req.user!.id,
  action: 'PROJECT_CREATED_DIRECT_APPROVAL',
  resource_type: 'project',
  resource_id: data.id,
  details: {
    name,
    category,
    totalBudget,
    milestoneCount: milestoneRows.length,
    status: 'MPDC Approved',
    blockchainTxHash: blockchainTxHash || null,
  },
  // ❌ MISSING: tx_hash field
});
```

#### backend/src/routes/auth.ts (7 locations)
- Line ~150: Authentication related
- Line ~297: Password/token related
- Line ~339: Role related
- Line ~436: User action
- Line ~498: Login/session
- Line ~557: Account management

#### backend/src/routes/milestones.ts (4 locations)
- Line ~86: Milestone creation/update
- Line ~123: Milestone verification
- Line ~222: Status update
- Line ~332: Milestone progress
- Line ~363: Completion tracking

#### backend/src/routes/documents.ts (2 locations)
- Line ~96: Document upload
- Line ~169: Document verification

#### backend/src/routes/systemAlerts.ts (2 locations)
- Line ~56: Alert creation
- Line ~92: Alert update

#### backend/src/services/tamperingDetection.ts (1 location)
- Line ~167: Tampering alert

---

## Solution: Three-Part Fix

### ✅ Key Finding: blockchainTxHash is Already Available!

In `backend/src/routes/projects.ts`, the code **already receives** `blockchainTxHash` from the request (line 503) and stores it in the project (line 580), but **fails to pass it to the audit log** (line 634 area).

**Current (Broken):**
```typescript
// Line 503: Parameter is available
const { blockchainTxHash } = req.body;

// Line 580: Stored in project
blockchain_tx_hash: blockchainTxHash || null,

// Line 634: Included in details but NOT in tx_hash field ❌
await supabase.from('audit_logs').insert({
  details: {
    blockchainTxHash: blockchainTxHash || null,  // Inside details, not where frontend looks
  },
  // Missing: tx_hash field
});
```

### Part 1: Use blockchainTxHash Where Available
For actions that have blockchain transaction hashes available, pass them to the audit log:

```typescript
// Corrected project creation
await supabase.from('audit_logs').insert({
  user_id: req.user!.id,
  action: 'PROJECT_CREATED_DIRECT_APPROVAL',
  resource_type: 'project',
  resource_id: data.id,
  details: {
    name,
    category,
    totalBudget,
    milestoneCount: milestoneRows.length,
    status: 'MPDC Approved',
  },
  tx_hash: blockchainTxHash || null,  // ✅ Pass it here from req.body
});
```

### Part 2: Update All Audit Log Insertions
Replace all instances of:
```typescript
await supabase.from('audit_logs').insert({
  user_id: req.user!.id,
  action: 'SOME_ACTION',
  resource_type: 'resource_type',
  resource_id: id,
  details: { /* ... */ },
  // Missing tx_hash
});
```

With:
```typescript
await supabase.from('audit_logs').insert({
  user_id: req.user!.id,
  action: 'SOME_ACTION',
  resource_type: 'resource_type',
  resource_id: id,
  details: { /* ... */ },
  tx_hash: blockchainTxHash || null,  // ✅ Always include
});
```

### Part 3: Implement Blockchain Hash Generation
Ensure there's a centralized service that:
1. Generates/retrieves blockchain transaction hashes for actions
2. Returns the tx_hash to pass to audit log insertions
3. Handles cases where immediate blockchain recording isn't available

---

## Implementation Priority

**High Priority** (Critical paths):
1. Projects - project creation, status changes
2. Milestones - verification, payment completion
3. Documents - uploads, verification
4. Transactions - payments, disbursements

**Medium Priority** (Important paths):
1. Auth - role changes, permissions
2. System Alerts - tampering detection, security events

---

## Verification Checklist
- [ ] Identify blockchain hash generation logic
- [ ] Add tx_hash capture at source of each action
- [ ] Update all 20+ audit log insertions to include tx_hash
- [ ] Test audit trail displays blockchain hashes
- [ ] Verify hash display in AuditTrails.tsx shows truncated tx_hash instead of "Not recorded"
- [ ] Test with various action types (project, milestone, document, transaction)
