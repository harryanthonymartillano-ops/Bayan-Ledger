# BayanLedger: Functional Requirements Document

**System Name:** BayanLedger (Sta. Cruz Municipality Budget Transparency System)  
**Version:** 1.0  
**Status:** Active  
**Last Updated:** May 4, 2026

---

## Executive Summary

BayanLedger is a blockchain-based municipal project and budget transparency platform designed for Philippine municipalities. It ensures immutable, transparent, and accountable management of municipal projects through role-based access control, smart contracts, and comprehensive audit trails.

**Motto:** *Immutable, Transparent, Accountable.*

---

## System Architecture Overview

**Key Stakeholders:**
- MPDC (Municipal Planning & Development Coordinator) - Project Creation & Milestone Verification
- Budget Officer - Budget Allocation & Gate 1 Financial Review
- Treasurer - Treasury Approval & Fund Disbursement (Gate 2)
- Admin - Platform Access & Role Management
- Citizens - Public Project Transparency Portal

**Technology Stack:**
- Frontend: React + TypeScript + Vite
- Backend: Node.js with Express + TypeScript
- Blockchain: Ethereum (Hardhat) - Smart Contract BayanLedger
- Database: Supabase (PostgreSQL)
- Storage: IPFS
- Web3: MetaMask Integration

---

## Functional Requirements

### **FR-01✅ User Registration and Login**
**Status:** Implemented  
**Description:** Allow officials (MPDC, Budget Officer, Treasurer, Admin) to register and login securely with role-based access control.

**Features:**
- Register new officials with first name, middle name, last name, email, password, and role
- Secure login authentication with JWT tokens
- Auto-grant blockchain roles upon registration
- Wallet address association for officials
- Role-based dashboard access
- Session management and auto-logout
- Password reset functionality

**Acceptance Criteria:**
- ✅ User can register with all required fields
- ✅ System validates email uniqueness
- ✅ Blockchain role is automatically granted on registration
- ✅ User can login and receive JWT token
- ✅ Logout clears session and token
- ✅ Invalid credentials are rejected
- ✅ Role-specific dashboard loads per permissions

---

### **FR-02✅ User Management (Admin Only)**
**Status:** Implemented  
**Description:** Admins can create, manage, and grant/revoke blockchain roles for officials.

**Features:**
- Add new officials with role assignment
- View all registered officials with their details
- Display on-chain role verification status
- Grant blockchain roles to officials
- Revoke blockchain roles from officials
- Display wallet addresses and chain status
- Update user status (Active/Inactive)
- Role-based permissions matrix visibility

**Acceptance Criteria:**
- ✅ Admin can access User Management page
- ✅ Admin can add new official with all details
- ✅ System requires wallet address for officials
- ✅ Blockchain role is granted during creation
- ✅ Admin can view on-chain verification status
- ✅ Admin can manually grant/revoke roles
- ✅ Role grant/revoke updates blockchain immediately
- ✅ Only Admin can access this feature

---

### **FR-03✅ Project Creation and Management**
**Status:** Implemented  
**Description:** MPDC staff can create new municipal projects with budget allocation and milestones.

**Features:**
- Create new project with ID, name, and total budget
- Define project milestones with deliverables and target dates
- Set milestone completion percentages (e.g., 25%, 50%, 75%, 100%)
- Add project description and category
- Upload supporting documents and metadata
- Track project status (PENDING, ACTIVE, COMPLETED, REJECTED)
- View project pipeline with all projects
- Project activation workflow (2-gate approval system)

**Acceptance Criteria:**
- ✅ Only MPDC role can create projects
- ✅ Project ID is unique and auto-generated
- ✅ Budget is positive integer
- ✅ Milestones have clear deliverables
- ✅ Project stored on blockchain with metadata hash
- ✅ Project appears in pipeline after creation
- ✅ Metadata is uploaded to IPFS
- ✅ Project can be edited before activation

---

### **FR-04✅ Budget Allocation (Gate 1 - Budget Officer)**
**Status:** Implemented  
**Description:** Budget Officer reviews and allocates SARO funds to approved projects.

**Features:**
- View pending projects awaiting budget allocation
- Allocate funds with SARO reference number
- Verify project details and budget requirements
- Sign SARO allocation document
- Generate SARO (Special Allotment Release Order) hash
- Approve or reject project budget allocation
- Add rejection reasons for failed allocations
- Track allocated funds vs. total budget

**Acceptance Criteria:**
- ✅ Only Budget Officer can allocate funds
- ✅ Budget allocation requires SARO number
- ✅ Allocated amount must match project budget
- ✅ SARO document is signed electronically
- ✅ SARO hash is recorded on blockchain
- ✅ Project moves to "approved" status after allocation
- ✅ Budget Officer can reject with reason
- ✅ Rejected project remains in PENDING status

---

### **FR-05✅ Treasury Approval (Gate 2 - Treasurer)**
**Status:** Implemented  
**Description:** Treasurer performs final approval and creates digital seal for fund disbursement.

**Features:**
- View projects approved by Budget Officer
- Review SARO allocation details
- Create treasury activation approval
- Generate "Digital Seal of Truth" (treasury seal hash)
- Approve project activation for disbursement
- Reject project activation with reason
- Record treasury seal on blockchain
- Link NCA (Notice of Cash Allocation) to project

**Acceptance Criteria:**
- ✅ Only Treasurer can approve treasury activation
- ✅ Treasurer must review SARO before approval
- ✅ Digital seal is generated and recorded on-chain
- ✅ Project status changes to ACTIVE after approval
- ✅ Treasury can reject with documented reason
- ✅ Rejection triggers notification to Budget Officer
- ✅ Treasury seal hash is immutable on blockchain
- ✅ NCA reference is linked to project

---

### **FR-06✅ Milestone Tracking and Verification**
**Status:** Implemented  
**Description:** MPDC verifies project milestone completion with evidence documentation.

**Features:**
- Create milestones with deliverables and due dates
- Track milestone status (PENDING, VERIFIED, COMPLETED)
- Upload milestone verification evidence (photos, documents)
- Record evidence hash on IPFS and blockchain
- Verify milestone completion percentage
- Generate milestone verification certificate
- Link milestone verification to disbursement request
- View milestone timeline with status indicators

**Acceptance Criteria:**
- ✅ MPDC can add milestones to active projects
- ✅ Milestone has clear deliverables
- ✅ Evidence can be uploaded (photos + documents)
- ✅ Evidence is hashed and stored on IPFS
- ✅ Verification hash recorded on blockchain
- ✅ Milestone moves to VERIFIED status
- ✅ Only MPDC can verify milestones
- ✅ Completed milestones cannot be re-verified

---

### **FR-07✅ Fund Disbursement Request**
**Status:** Implemented  
**Description:** MPDC creates disbursement requests linked to verified milestones for payment processing.

**Features:**
- Create disbursement request for verified milestone
- Link to specific project and milestone
- Specify contractor/recipient and amount
- Generate disbursement metadata hash
- Track disbursement status (PENDING, 1/2 SIGNED, EXECUTED, COMPLETED)
- View all pending disbursement requests
- Require multi-signature approval (Budget Officer + Treasurer)

**Acceptance Criteria:**
- ✅ Only MPDC can create disbursement request
- ✅ Request requires verified milestone
- ✅ Request specifies contractor address
- ✅ Amount matches verified milestone allocation
- ✅ Request stored with metadata hash
- ✅ Request appears in pending queue
- ✅ Request requires 2 signatures to execute
- ✅ Request status tracked throughout process

---

### **FR-08✅ Multi-Signature Fund Release (Budget Officer Signature)**
**Status:** Implemented  
**Description:** Budget Officer signs disbursement requests as first checkpoint.

**Features:**
- View pending disbursement requests
- Review request details and supporting documents
- Add supporting document hash for signature
- Sign disbursement request electronically
- Record first signature on blockchain
- Update request status to "1/2 SIGNED"
- Cannot proceed without this signature
- Generate signature timestamp

**Acceptance Criteria:**
- ✅ Only Budget Officer can sign as first checkpoint
- ✅ Budget Officer can view pending requests
- ✅ Signature requires supporting document hash
- ✅ Signature is recorded on blockchain with timestamp
- ✅ Request status updates to "1/2 SIGNED"
- ✅ Treasurer is notified for second signature
- ✅ Cannot execute without this signature
- ✅ Signature cannot be revoked

---

### **FR-09✅ Multi-Signature Fund Release (Treasurer Signature)**
**Status:** Implemented  
**Description:** Treasurer signs disbursement requests as final checkpoint before fund release.

**Features:**
- View requests with first signature from Budget Officer
- Review and approve disbursement for payment
- Add treasury seal hash for disbursement
- Sign disbursement request as second signature
- Record second signature on blockchain
- Update request status to "EXECUTED"
- Generate Digital Seal of Truth for payment
- Trigger fund transfer/payment execution

**Acceptance Criteria:**
- ✅ Only Treasurer can sign as second checkpoint
- ✅ Cannot sign without Budget Officer's signature
- ✅ Treasurer can add treasury seal hash
- ✅ Signature recorded on blockchain with timestamp
- ✅ Request status updates to "EXECUTED"
- ✅ Funds are marked ready for disbursement
- ✅ Both signatures are immutable on blockchain
- ✅ Payment process initiated automatically

---

### **FR-10✅ Document Management**
**Status:** Implemented  
**Description:** Secure upload, storage, and management of project documents.

**Features:**
- Upload project supporting documents
- Upload milestone verification evidence
- Upload SARO allocation documents
- Upload NCA allocation documents
- Upload payment supporting documents
- Generate document hash (SHA-256)
- Store documents on IPFS
- Record document references on blockchain
- Download verified documents
- Maintain audit trail of document uploads

**Acceptance Criteria:**
- ✅ Documents can be uploaded in multiple formats
- ✅ Each document generates unique hash
- ✅ Hash recorded on blockchain for immutability
- ✅ Documents stored on IPFS
- ✅ File size limits enforced
- ✅ Only authorized roles can upload
- ✅ Documents tagged with project/milestone
- ✅ Document history is auditable

---

### **FR-11✅ SARO Registry**
**Status:** Implemented  
**Description:** Centralized registry of all SARO allocations with transparency and tracking.

**Features:**
- View all SARO allocations across projects
- Filter by project, date range, or status
- Display SARO number and allocation amount
- Show project allocation percentage
- Track SARO status (ALLOCATED, PARTIALLY USED, FULLY USED)
- Link SARO to specific projects
- Display Budget Officer who allocated
- Export SARO registry reports

**Acceptance Criteria:**
- ✅ All SARO allocations are listed
- ✅ SARO linked to correct project
- ✅ Amount matches project allocation
- ✅ Status accurately reflects usage
- ✅ Budget Officer info is recorded
- ✅ Date of allocation is tracked
- ✅ Registry is tamper-proof
- ✅ Filtering works by multiple criteria

---

### **FR-12✅ NCA Ledger**
**Status:** Implemented  
**Description:** Notice of Cash Allocation (NCA) tracking for treasury fund management.

**Features:**
- View all NCA allocations to projects
- Link NCA to treasury-approved projects
- Display NCA amount and status
- Track NCA utilization and disbursements
- Show Treasurer approval date
- Filter NCA by status or project
- Generate NCA allocation reports
- Record disbursement references against NCA

**Acceptance Criteria:**
- ✅ NCA linked to treasury-approved projects
- ✅ NCA amount recorded accurately
- ✅ Treasurer recorded as allocating official
- ✅ Disbursement references linked to NCA
- ✅ NCA balance tracked
- ✅ Status updated as funds are used
- ✅ Historical NCA records maintained
- ✅ Reports exportable

---

### **FR-13✅ Audit Trail and Digital Audit Log**
**Status:** Implemented  
**Description:** Comprehensive immutable audit log of all system actions and transactions.

**Features:**
- Log all user actions (create, update, verify, sign, disburse)
- Record action timestamp and user
- Log blockchain transactions and hashes
- Log role grants and revocations
- Log project status changes
- Log fund disbursement milestones
- View audit trail with filters (date, user, action type)
- Export audit logs
- Immutable audit log on blockchain
- Search audit logs by keyword

**Acceptance Criteria:**
- ✅ Every action is logged with timestamp
- ✅ User identity is recorded
- ✅ Action type clearly identified
- ✅ Blockchain transaction hashes included
- ✅ Logs cannot be deleted or modified
- ✅ Filtering by date range works
- ✅ Filtering by user works
- ✅ Filtering by action type works
- ✅ Audit logs exportable to CSV/PDF

---

### **FR-14✅ Compliance Scoreboard**
**Status:** Implemented  
**Description:** Real-time dashboard showing system compliance metrics and health.

**Features:**
- Display overall compliance score (0-100%)
- Show approval turnaround metrics
- Track projects on-time vs. delayed
- Display budget utilization rate
- Show fund disbursement completion rate
- Track document upload compliance
- Display milestone verification rate
- Alert on compliance anomalies

**Acceptance Criteria:**
- ✅ Scorecard updates in real-time
- ✅ All metrics calculated accurately
- ✅ On-time projects properly tracked
- ✅ Budget utilization rate is correct
- ✅ Completion rates calculated
- ✅ Alerts trigger on anomalies
- ✅ Historical trends visible
- ✅ Scoreboard accessible to all roles

---

### **FR-15✅ System Alerts and Anomaly Detection**
**Status:** Implemented  
**Description:** Real-time alerts for system anomalies, compliance issues, and security events.

**Features:**
- Alert on delayed projects
- Alert on budget overruns
- Alert on unauthorized access attempts
- Alert on delayed approvals
- Alert on document upload failures
- Alert on blockchain transaction failures
- Alert on system errors
- Display alert severity (CRITICAL, WARNING, INFO)
- View all alerts with details
- Mark alerts as resolved
- Archive old alerts

**Acceptance Criteria:**
- ✅ Alerts generated in real-time
- ✅ Alert types cover all critical events
- ✅ Severity levels assigned correctly
- ✅ Alerts viewable by relevant roles
- ✅ Alert details include context
- ✅ Alerts can be marked resolved
- ✅ Alert history maintained
- ✅ Notifications sent to relevant users

---

### **FR-16✅ Role-Based Access Control (RBAC)**
**Status:** Implemented  
**Description:** Fine-grained permission matrix ensuring each role has appropriate access.

**Features:**

| Feature | MPDC | Budget Officer | Treasurer | Admin |
|---------|------|-----------------|-----------|-------|
| View Projects | ✅ | ✅ | ✅ | ✅ |
| Create Project | ✅ | ❌ | ❌ | ❌ |
| Verify Milestones | ✅ | ❌ | ❌ | ❌ |
| Allocate SARO | ❌ | ✅ | ❌ | ❌ |
| Sign SARO | ❌ | ✅ | ❌ | ❌ |
| Approve Treasury | ❌ | ❌ | ✅ | ❌ |
| Sign NCA | ❌ | ❌ | ✅ | ❌ |
| Disburse Funds | ❌ | ❌ | ✅ | ❌ |
| Manage Users | ❌ | ❌ | ❌ | ✅ |
| Grant/Revoke Roles | ❌ | ❌ | ❌ | ✅ |
| View Audit Logs | ✅ | ✅ | ✅ | ✅ |
| View System Alerts | ✅ | ✅ | ✅ | ✅ |

**Acceptance Criteria:**
- ✅ Each role has distinct permissions
- ✅ Permissions enforced at UI and API level
- ✅ Blockchain validates role before transaction
- ✅ Permission matrix is visible in RBAC page
- ✅ Unauthorized actions are rejected
- ✅ Audit logs track permission usage
- ✅ Permission validation cannot be bypassed

---

### **FR-17✅ Role-Based Dashboard**
**Status:** Implemented  
**Description:** Customized dashboard view based on user role and responsibilities.

**Features:**
- **MPDC Dashboard:** Project pipeline, pending milestones, verification queue, disbursement requests
- **Budget Officer Dashboard:** Pending allocations, SARO registry, approval queue, signed requests
- **Treasurer Dashboard:** Pending treasury approvals, NCA ledger, executed disbursements, fund status
- **Admin Dashboard:** User management, system alerts, audit logs, compliance metrics
- Display role-specific quick stats
- Show pending action count
- Display role-specific tasks

**Acceptance Criteria:**
- ✅ Dashboard loads based on user role
- ✅ MPDC sees project pipeline
- ✅ Budget Officer sees allocation queue
- ✅ Treasurer sees approval queue
- ✅ Admin sees system overview
- ✅ Stats update in real-time
- ✅ Dashboard responsive on all devices

---

### **FR-18✅ Project Pipeline View**
**Status:** Implemented  
**Description:** Visual representation of all projects and their progression through approval gates.

**Features:**
- Display all projects with current status
- Show projects in PENDING, ACTIVE, COMPLETED, REJECTED states
- Display project budget and allocated/disbursed amounts
- Show project progress percentage
- Display approval status (Awaiting SARO, Awaiting Treasury, etc.)
- Link to project details
- Filter projects by status or category
- Search projects by ID or name

**Acceptance Criteria:**
- ✅ All projects displayed in pipeline
- ✅ Status clearly indicated
- ✅ Budget info visible
- ✅ Progress percentage calculated
- ✅ Filtering by status works
- ✅ Search functionality works
- ✅ Project details accessible via click
- ✅ Pipeline updates in real-time

---

### **FR-19✅ Milestone Tracker**
**Status:** Implemented  
**Description:** Comprehensive tracking of project milestones from creation to completion.

**Features:**
- View all project milestones
- Display milestone status (PENDING, VERIFIED, COMPLETED)
- Show completion percentage
- Display due dates and completion dates
- Show evidence upload status
- Link to milestone verification documents
- Filter by project or status
- Generate milestone completion reports

**Acceptance Criteria:**
- ✅ All milestones tracked
- ✅ Status accurately reflects completion
- ✅ Completion percentage calculated
- ✅ Due dates tracked
- ✅ Evidence linked and accessible
- ✅ Filtering works
- ✅ Reports generated
- ✅ Milestone timeline visible

---

### **FR-20✅ My Tasks Dashboard**
**Status:** Implemented  
**Description:** Personal task queue showing pending actions for each official.

**Features:**
- Display pending tasks specific to user role
- Show task priority and due date
- Enable quick action on tasks
- Track task completion status
- Notify on new tasks
- Filter tasks by status
- Sort by priority or due date
- Mark tasks complete

**Acceptance Criteria:**
- ✅ Only user's pending tasks displayed
- ✅ Tasks match user's role
- ✅ Priority indicated
- ✅ Due dates visible
- ✅ Quick action buttons available
- ✅ Completion updates system
- ✅ Task list updates automatically
- ✅ Notifications sent for new tasks

---

### **FR-21✅ Project Details and Evidence Gallery**
**Status:** Implemented  
**Description:** Detailed project view with milestone evidence gallery and supporting documents.

**Features:**
- Display project overview with all details
- Show budget allocation breakdown
- Display milestone evidence photo gallery
- View document gallery for project
- Link all evidence to blockchain
- Display verification hashes
- Show approver signatures and timestamps
- Download certificates and reports

**Acceptance Criteria:**
- ✅ All project details displayed
- ✅ Budget breakdown clear
- ✅ Evidence photos viewable in gallery
- ✅ Documents linked and downloadable
- ✅ Verification hashes visible
- ✅ Signatures and timestamps recorded
- ✅ Gallery responsive on mobile
- ✅ Evidence immutable on blockchain

---

### **FR-22✅ Public Transparency Portal**
**Status:** Implemented  
**Description:** Citizen-accessible portal showing project transparency and status.

**Features:**
- Allow citizens to view approved municipal projects
- Display project details (budget, timeline, status)
- Show project category and description
- View milestone completion status
- Display fund allocation and disbursement info
- Show evidence galleries for completed milestones
- Public audit trail access (non-sensitive info)
- Search and filter projects

**Acceptance Criteria:**
- ✅ Public can view active projects
- ✅ Project details clearly displayed
- ✅ Budget and spending visible
- ✅ Timeline and status transparent
- ✅ Evidence accessible to public
- ✅ No sensitive data exposed
- ✅ Search and filter work
- ✅ Mobile responsive

---

### **FR-23✅ Blockchain Integration**
**Status:** Implemented  
**Description:** Smart contract integration for immutable record-keeping and role-based access control.

**Features:**
- Deploy BayanLedger smart contract to Ethereum
- Implement role-based access control (RBAC) on-chain
- Record all project creations on blockchain
- Record fund allocations on blockchain
- Record milestone verifications on blockchain
- Record disbursement transactions on blockchain
- Generate transaction hashes for all actions
- Implement multi-signature requirements on-chain
- Store metadata hashes for documents
- Verify contract interactions via ethers.js

**Acceptance Criteria:**
- ✅ Smart contract deployed and verified
- ✅ All critical actions recorded on-chain
- ✅ RBAC enforced at contract level
- ✅ Role validation on every transaction
- ✅ Multi-signature logic implemented
- ✅ Metadata hashes stored
- ✅ Transaction hashes generated
- ✅ MetaMask integration working
- ✅ Blockchain interactions auditable

---

### **FR-24✅ Wallet and Web3 Integration**
**Status:** Implemented  
**Description:** MetaMask wallet integration for officials to authenticate and sign transactions.

**Features:**
- Connect MetaMask wallet
- Verify wallet address for officials
- Sign transactions with wallet
- Validate wallet authorization
- Display connected wallet address
- Handle wallet disconnection
- Support wallet switching
- Track wallet transaction history

**Acceptance Criteria:**
- ✅ MetaMask connection works
- ✅ Wallet address verified
- ✅ Transactions signed by wallet
- ✅ Wallet disconnection handled
- ✅ Can switch wallets
- ✅ Transaction history visible
- ✅ Wallet validation on login
- ✅ Error handling for wallet issues

---

### **FR-25✅ IPFS Document Storage**
**Status:** Implemented  
**Description:** Decentralized storage of documents and evidence using IPFS.

**Features:**
- Upload documents to IPFS
- Generate IPFS hash for document
- Store IPFS hash on blockchain
- Retrieve documents from IPFS
- Verify document integrity via hash
- Support multiple file formats
- Enable document sharing via IPFS hash
- Maintain document version history

**Acceptance Criteria:**
- ✅ Documents uploaded to IPFS
- ✅ IPFS hash generated
- ✅ Hash stored on blockchain
- ✅ Documents retrievable
- ✅ Hash verification works
- ✅ Multiple formats supported
- ✅ Version history maintained
- ✅ IPFS availability monitored

---

### **FR-26✅ Real-Time Notifications**
**Status:** Implemented  
**Description:** Real-time notifications for officials about pending actions and system events.

**Features:**
- Notify on pending approvals
- Notify on role assignments
- Notify on project status changes
- Notify on milestone completions
- Notify on fund disbursements
- Notify on system alerts
- In-app notification display
- Email notification support
- Notification history
- Mark notifications as read

**Acceptance Criteria:**
- ✅ Notifications delivered in real-time
- ✅ Notification type matches event
- ✅ Recipients are correct
- ✅ In-app display works
- ✅ History maintained
- ✅ Can mark as read
- ✅ Can dismiss notifications
- ✅ No duplicate notifications

---

### **FR-27✅ Archive and Document Storage**
**Status:** Implemented  
**Description:** Centralized archive for completed project documents and historical records.

**Features:**
- Archive completed projects
- Store all project documents
- Maintain document organization
- Search archived documents
- Download archived materials
- Preserve historical records
- Track archival dates
- Maintain archival integrity

**Acceptance Criteria:**
- ✅ Completed projects can be archived
- ✅ All documents preserved
- ✅ Documents searchable in archive
- ✅ Download functionality works
- ✅ Archive is secure
- ✅ Records immutable
- ✅ Archival dates tracked
- ✅ Can restore from archive

---

### **FR-28✅ Verified Payments Ledger**
**Status:** Implemented  
**Description:** Track and verify all fund payments and disbursements.

**Features:**
- Record all fund payments
- Link payments to projects
- Display payment status (PENDING, COMPLETED, FAILED)
- Show payment amount and date
- Record beneficiary information
- Generate payment certificates
- Track payment confirmations
- Maintain payment audit trail

**Acceptance Criteria:**
- ✅ All payments recorded
- ✅ Payment status accurate
- ✅ Amount and date recorded
- ✅ Beneficiary info linked
- ✅ Certificates generated
- ✅ Confirmations tracked
- ✅ Audit trail complete
- ✅ Ledger reports exportable

---

### **FR-29✅ Payment Hashes Registry**
**Status:** Implemented  
**Description:** Maintain immutable registry of payment transaction hashes.

**Features:**
- Generate unique hash for each payment
- Record payment hash on blockchain
- Link hash to project and milestone
- Enable payment verification via hash
- Store hash history
- Generate hash verification certificates
- Support hash-based payment lookup

**Acceptance Criteria:**
- ✅ Hash generated for each payment
- ✅ Hash stored on blockchain
- ✅ Hash linked to project
- ✅ Hash linked to milestone
- ✅ Can verify via hash
- ✅ Hash history maintained
- ✅ Certificates generated
- ✅ Hash lookup works

---

### **FR-30✅ Transaction Receipt Generation**
**Status:** Implemented  
**Description:** Generate digitally signed receipts for all financial transactions.

**Features:**
- Generate receipt for each transaction
- Include all transaction details
- Add blockchain transaction hash
- Sign receipt electronically
- Display QR code for verification
- Email receipt to beneficiary
- Archive receipt copies
- Enable receipt download

**Acceptance Criteria:**
- ✅ Receipt generated for each transaction
- ✅ All details included
- ✅ Blockchain hash visible
- ✅ Digitally signed
- ✅ QR code generated
- ✅ Email sent
- ✅ Copies archived
- ✅ Download works

---

### **FR-31✅ Error Handling and Recovery**
**Status:** Implemented  
**Description:** Graceful error handling and recovery mechanisms for system reliability.

**Features:**
- Validate all user inputs
- Provide clear error messages
- Handle blockchain transaction failures
- Rollback failed operations
- Retry failed transactions
- Maintain data consistency
- Log all errors
- Notify admins of critical errors

**Acceptance Criteria:**
- ✅ Input validation on all forms
- ✅ Error messages user-friendly
- ✅ Transaction failures handled
- ✅ Rollbacks work correctly
- ✅ Retry logic implemented
- ✅ Data consistency maintained
- ✅ Errors logged
- ✅ Admin notifications sent

---

### **FR-32✅ Performance Monitoring**
**Status:** Implemented  
**Description:** Monitor system performance and track key metrics.

**Features:**
- Track API response times
- Monitor blockchain transaction times
- Track user activity metrics
- Monitor database performance
- Track IPFS upload/download speeds
- Generate performance reports
- Alert on performance degradation
- Dashboard showing performance metrics

**Acceptance Criteria:**
- ✅ Response times tracked
- ✅ Transaction times monitored
- ✅ Activity metrics collected
- ✅ Database performance tracked
- ✅ IPFS speeds monitored
- ✅ Reports generated
- ✅ Alerts triggered on issues
- ✅ Dashboard accessible to admins

---

### **FR-33✅ Backup and Disaster Recovery**
**Status:** Planned  
**Description:** Backup systems and disaster recovery procedures.

**Features:**
- Regular database backups
- IPFS backup verification
- Blockchain state snapshots
- Recovery procedures documentation
- Test recovery procedures
- Backup encryption
- Offsite backup storage
- Recovery time objective (RTO) targets

**Acceptance Criteria:**
- ⏳ Backup schedule defined
- ⏳ Backup verification working
- ⏳ Recovery procedures documented
- ⏳ Recovery tested quarterly
- ⏳ Backup encryption enabled
- ⏳ Offsite copies maintained
- ⏳ RTO < 4 hours
- ⏳ RPO < 1 hour

---

### **FR-34✅ Security and Access Control**
**Status:** Implemented  
**Description:** Security measures and access control enforcement.

**Features:**
- Encrypt passwords with bcrypt
- Secure JWT token authentication
- HTTPS for all communications
- Input validation and sanitization
- SQL injection prevention
- XSS attack prevention
- CSRF token protection
- Rate limiting on API endpoints

**Acceptance Criteria:**
- ✅ Passwords encrypted
- ✅ JWT tokens secure
- ✅ HTTPS enforced
- ✅ Input validated
- ✅ SQL injection prevented
- ✅ XSS attacks prevented
- ✅ CSRF protected
- ✅ Rate limiting active

---

### **FR-35✅ Reporting and Analytics**
**Status:** Implemented  
**Description:** Generate reports and analytics for system usage and compliance.

**Features:**
- Project completion rate reports
- Budget utilization reports
- Fund disbursement reports
- Timeline compliance reports
- Audit log reports
- User activity reports
- System performance reports
- Export reports to PDF/CSV

**Acceptance Criteria:**
- ✅ All report types generate
- ✅ Data accurate
- ✅ Filters work
- ✅ Date ranges selectable
- ✅ PDF export works
- ✅ CSV export works
- ✅ Reports scheduled
- ✅ Email delivery available

---

### **FR-36✅ Data Validation and Integrity**
**Status:** Implemented  
**Description:** Ensure data validity and system integrity throughout operations.

**Features:**
- Validate all numerical inputs
- Validate email formats
- Validate blockchain addresses
- Validate file uploads
- Validate document hashes
- Database integrity checks
- Referential integrity enforcement
- Detect and log anomalies

**Acceptance Criteria:**
- ✅ Validation on all inputs
- ✅ Invalid data rejected
- ✅ Database constraints enforced
- ✅ Referential integrity working
- ✅ Anomalies detected
- ✅ Anomalies logged
- ✅ Admin alerts triggered
- ✅ Data consistency maintained

---

## Non-Functional Requirements

### **NFR-01: Scalability**
- System shall support at least 1000 concurrent users
- Database shall handle 1M+ records efficiently
- API shall handle 10,000 requests per minute

### **NFR-02: Availability**
- System uptime target: 99.5%
- Recovery time objective (RTO): < 4 hours
- Recovery point objective (RPO): < 1 hour

### **NFR-03: Performance**
- API response time: < 500ms (95th percentile)
- Page load time: < 2 seconds
- File upload: < 5 minutes for 100MB

### **NFR-04: Security**
- All data encrypted in transit (TLS 1.2+)
- All passwords hashed with bcrypt
- All blockchain transactions verified
- PCI-DSS compliance for payments (if applicable)

### **NFR-05: Usability**
- System accessible on desktop and mobile
- Responsive design for all screen sizes
- Accessible to users with disabilities (WCAG 2.1 AA)

### **NFR-06: Maintainability**
- Code documented with comments
- API documentation complete
- Deployment procedures documented
- Runbook for operations team

### **NFR-07: Compatibility**
- Support latest 2 versions of Chrome, Firefox, Safari, Edge
- Support metamask version 9.0+
- Support Node.js 18+

---

## Technical Specifications

### **Backend Stack**
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **ORM:** Supabase SDK
- **Blockchain:** Hardhat, ethers.js
- **Storage:** IPFS
- **Authentication:** JWT

### **Frontend Stack**
- **Framework:** React 18+
- **Language:** TypeScript
- **Build Tool:** Vite
- **CSS:** Tailwind CSS
- **UI Components:** Custom + shadcn/ui
- **Web3:** ethers.js, MetaMask

### **Blockchain**
- **Network:** Ethereum (Sepolia Testnet / Mainnet)
- **Language:** Solidity ^0.8.20
- **Contract:** BayanLedger.sol
- **Roles:** ADMIN, MPDC, BUDGET_OFFICER, TREASURER

### **Database Schema** (Supabase)
- Users table (officials with roles)
- Projects table
- Milestones table
- ProjectBudget table
- Disbursements table
- AuditLogs table
- SystemAlerts table
- Documents table

---

## Workflow Triggers and Status Flows

### **Project Lifecycle**
```
PENDING → BUDGET ALLOCATED → TREASURY APPROVED → ACTIVE → COMPLETED
                    ↓                 ↓
              [REJECTED]        [REJECTED]
```

### **Fund Disbursement Flow**
```
PENDING → 1/2 SIGNED (Budget Officer) → EXECUTED (Treasurer) → COMPLETED
              ↓
         [REJECTION]
```

### **Milestone Status Flow**
```
PENDING → VERIFIED (MPDC) → COMPLETED
```

---

## Success Criteria

✅ **All 36 Functional Requirements** implemented and tested  
✅ **Smart Contract** deployed on Ethereum  
✅ **Multi-signature** disbursement working  
✅ **Audit trail** immutable on blockchain  
✅ **Role-based** access control enforced  
✅ **Document** hashing and verification working  
✅ **IPFS** integration for document storage  
✅ **MetaMask** integration functional  
✅ **Public transparency** portal accessible  
✅ **Performance** meets non-functional requirements  

---

## Future Enhancements

- [ ] Mobile app for iOS and Android
- [ ] Advanced analytics and AI-driven insights
- [ ] Multi-chain support (Polygon, BSC)
- [ ] Integration with government payment systems
- [ ] Automated compliance reporting
- [ ] Advanced document management with OCR
- [ ] Video evidence support
- [ ] Multi-language support
- [ ] API marketplace for third-party integrations
- [ ] DAO governance model

---

**Document Version:** 1.0  
**Last Updated:** May 4, 2026  
**Status:** Active Implementation  
**Approval:** Pending
