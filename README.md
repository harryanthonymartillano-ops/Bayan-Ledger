# BAYANLEDGER: Blockchain-Based Municipal Budget Transparency, Milestone Tracking, and Tamper-Proof Audit System for Sta. Cruz, Laguna

> **Undergraduate Capstone Research Repository — College of Computer Studies**  
> **Laguna State Polytechnic University, Santa Cruz Main Campus**  
> **Submitted for Academic Evaluation & Archiving to:** `teamccs-git`

[![LSPU CCS](https://img.shields.io/badge/LSPU-College%20of%20Computer%20Studies-blue.svg)](https://lspu.edu.ph/)
[![Capstone Research](https://img.shields.io/badge/Research-Civic--Tech%20%26%20Blockchain-06b6d4.svg)]()
[![Ethereum Sepolia](https://img.shields.io/badge/Network-Ethereum%20Sepolia%20Testnet-627eea.svg)](https://sepolia.etherscan.io/address/0x4db61F54B5d9620E15462D2f360F6236b28961F5)
[![Solidity](https://img.shields.io/badge/Smart%20Contract-Solidity%20%5E0.8.20-363636.svg)]()
[![ISO/IEC 25010](https://img.shields.io/badge/Evaluation-ISO%2FIEC%2025010%20(4.55%2F5.00)-10b981.svg)]()
[![Black-Box Testing](https://img.shields.io/badge/Testing-100%25%20Pass%20(225%2F225)-emerald.svg)]()

---

## 🏛️ Research Context & Project Abstract

In Philippine local government units (LGUs), municipal budgeting and public capital outlay administration have historically operated on isolated spreadsheets, paper vouchers, manual milestone certificates, and fragmented departmental registries. In the **Municipality of Santa Cruz, Laguna**, this conventional administrative arrangement has led to procurement bottlenecks, delayed contractor milestone liquidations, vulnerability to phantom or ghost infrastructure projects, and a systemic absence of real-time fiscal accountability for ordinary constituents and state oversight bodies such as the Commission on Audit (COA).

**BayanLedger** is a decentralized municipal governance, budget transparency, and milestone verification platform developed specifically for Santa Cruz, Laguna. The system implements a **multi-gate verification pipeline** enforcing strict institutional role separation across the **Municipal Planning and Development Coordinator (MPDC)**, **Municipal Budget Officer**, and **Municipal Treasurer**. Capital works milestones are cryptographically bound using **SHA-256 document hashing** and verified on an autonomous **Ethereum Sepolia smart contract** (`StaCruzChain.sol`), releasing funds only upon empirical inspection proof and maintaining an automated tamper-detection daemon that reconciles off-chain database records against on-chain block states.

### 🔒 Academic Showcase & Data Privacy Notice
In compliance with the **Data Privacy Act of 2012 (Republic Act No. 10173)**, municipal non-disclosure parameters, and academic research guidelines:
- This research repository utilizes **sanitized demonstration datasets** covering the **26 barangays of Santa Cruz, Laguna**, simulated municipal infrastructure projects, realistic capital appropriations, and synthetic contractor accounts.
- Proprietary local government private credentials, live administrative passkeys, and direct internal database credentials have been excluded and decoupled via environment variable templates (`.env.example`).
- The **`BayanLedger-Pages/`** directory contains the **official GitHub Pages research repository website** structured strictly in accordance with the **LSPU CCS Research Repository Submission Specification**.
- The full system source code, Solidity smart contract, Express REST API, and Supabase relational schema are organized for reproducible academic evaluation and audit verification.

---

## 🏗️ High-Level System Architecture

BayanLedger is engineered following a decoupled four-tier architecture combining modern web interfaces, an authenticated REST API layer, relational persistence, and a public Ethereum blockchain trust anchor.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         BAYANLEDGER SYSTEM ARCHITECTURE                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────┐   ┌────────────────────────┐   ┌─────────────────┐│
│  │ Citizen Public Portal │   │ LGU Admin Command Ctr  │   │  GitHub Pages   ││
│  │ (React 19 / Vite)     │   │ (MPDC, Budget, Treas.) │   │ Research Portal ││
│  │                       │   │                        │   │ (BayanLedger-   ││
│  │ • Budget Allocation   │   │ • Project Pipeline     │   │  Pages)         ││
│  │ • Project Timeline    │   │ • Multi-Gate Approvals │   │ • Manuscript Doc││
│  │ • Milestone Photo Log │   │ • SARO / NCA Allocator │   │ • ISO/IEC 25010 ││
│  │ • Transaction Receipt │   │ • Proof Verification   │   │ • Architecture  ││
│  │ • Citizen Feedback    │   │ • Discrepancy Alerts   │   │ • Live Demo Link││
│  └───────────┬───────────┘   └───────────┬────────────┘   └─────────────────┘│
│              │                           │                                   │
│              └─────────────┬─────────────┘                                   │
│                            │ HTTPS / REST (JWT + RBAC)                       │
│                            ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                BAYANLEDGER CORE BACKEND API (Express · :5000)          │  │
│  │                                                                        │  │
│  │  API Routers & Services:                                               │  │
│  │  • auth (JWT authentication, role verification, session security)      │  │
│  │  • projects (capital works lifecycle across Sta. Cruz 26 barangays)    │  │
│  │  • milestones (25%, 50%, 75%, 100% inspection deliverables & photos)   │  │
│  │  • saro (Gate 1 budget allotment allocation & obligations)             │  │
│  │  • nca (Gate 2 cash allocation disbursement authorizations)            │  │
│  │  • audit (tamper detection daemon, cryptographic log receipts)         │  │
│  │  • blockchain (Sepolia RPC provider, ethers.js smart contract sync)    │  │
│  │                                                                        │  │
│  │  Security & Verification Middleware:                                   │  │
│  │  • Role-Based Access Control (Admin, MPDC, Budget Officer, Treasurer)  │  │
│  │  • SHA-256 Document & Photo Checksum Hasher                            │  │
│  │  • Rate Limiter, CORS Allowlist, Strict Security Headers               │  │
│  │                                                                        │  │
│  │  Automated Daemons:                                                    │  │
│  │  • Discrepancy Reconciliation Daemon (DB vs. Sepolia block comparison) │  │
│  │  • Milestone Expiry & Stale Project Scanner                            │  │
│  └────────────────────────────┬───────────────────────────────────────────┘  │
│                               │                                              │
│               ┌───────────────┴───────────────┐                              │
│               ▼                               ▼                              │
│  ┌─────────────────────────┐     ┌────────────────────────────────────────┐  │
│  │ Supabase PostgreSQL DB  │     │ Ethereum Sepolia Blockchain Trust Layer│  │
│  │                         │     │                                        │  │
│  │ • Structured Relational │     │ • StaCruzChain.sol Smart Contract      │  │
│  │   Project Data          │     │ • Multi-Sig Gate State Machine         │  │
│  │ • 26 Sta. Cruz Barangays│     │ • Immutable Milestone Release Engine   │  │
│  │ • User Accounts & Roles │     │ • Cryptographic Event Logs & Receipts  │  │
│  │ • Document Metadata     │     │ • Zero-Downtime Decentralized Explorer │  │
│  │ • Storage Buckets       │     │ • Verified: 0x4db6...61F5              │  │
│  └─────────────────────────┘     └────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    DEPLOYMENT & HOSTING TOPOLOGY                       │  │
│  │                                                                        │  │
│  │  Frontend & Admin ──── Vercel (Production Web Application)             │  │
│  │  Backend API ───────── Node.js Express Server                          │  │
│  │  Database & Storage ── Supabase (PostgreSQL with TLS)                  │  │
│  │  Smart Contract ────── Ethereum Sepolia Testnet (Etherscan Verified)   │  │
│  │  Research Site ─────── GitHub Pages (BayanLedger-Pages)                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Multi-Gate Approval Workflow & Role Segregation

BayanLedger eliminates single-point administrative vulnerabilities by enforcing the **Three-Gate Principle** mandated by Philippine public auditing standards:

| Phase / Gate | Institutional Actor | System Scope & Function | On-Chain / Database Enforcement |
| :--- | :--- | :--- | :--- |
| **Phase 1: Project Initialization** | **MPDC (Planning)** | Creates capital project profile, sets budgetary cost ceiling, defines 4 milestone tranches (25%, 50%, 75%, 100%), and links contractor details. | Generates unique UUID and initial database record with `MPDC_APPROVED` state. |
| **Gate 1: SARO Allotment** | **Budget Officer** | Validates appropriation against municipal investment plans, assigns **Special Allotment Release Order (SARO)** reference, and commits funds. | Binds official SARO number; changes project state to `SARO_OBLIGATED` on-chain. |
| **Gate 2: NCA Cash Release** | **Municipal Treasurer** | Certifies cash availability, issues **Notice of Cash Allocation (NCA)** reference, and authorizes treasury disbursement escrow. | Unlocks smart contract disbursement escrow on Sepolia testnet. |
| **Phase 2: Milestone Verification** | **MPDC & Contractor** | Contractor submits deliverables; MPDC inspects physical site, validates completion, and uploads geotagged inspection evidence photos. | Hashes photo proofs (SHA-256); contract validates inspection and auto-releases milestone payout. |
| **Continuous Surveillance** | **Tamper Detection Daemon** | Continuous automated background service comparing relational database rows against immutable Sepolia blocks. | Flags any unauthorized row modifications, status alterations, or backdated allocations with prominent visual warnings. |

---

## 🛡️ Multi-Tier Verification & Storage Strategy

| Storage Tier | Technology | Storage Scope | Cryptographic & Integrity Guarantees |
| :--- | :--- | :--- | :--- |
| **Primary Relational DB** | Supabase (PostgreSQL 15) | Relational project records, user identities, roles, session tokens, barangay classifications. | Row-Level Security (RLS), TLS-pinned encrypted connections, automated point-in-time recovery. |
| **Decentralized Trust Anchor** | Ethereum Sepolia Testnet | Smart contract state machine, milestone approvals, cryptographic payment receipts, block timestamps. | Immutable Keccak-256 hashing, multi-sig consensus, irreversible on-chain public block logs. |
| **Document & Evidence Vault** | Supabase Public Storage | High-resolution on-site engineering inspection photographs, milestone accomplishment certificates. | SHA-256 checksum fingerprint computed upon upload and stored permanently on-chain. |
| **Integrity Surveillance Daemon** | Node.js Worker Service | Automated reconciliation comparing relational table records with Sepolia block logs. | Triggers instant alert flags (`TAMPERED` status) upon detecting off-chain data discrepancies. |

---

## 📁 Repository Structure

```
BayanLedger/
├── BayanLedger-Pages/                  # OFFICIAL GITHUB PAGES RESEARCH WEBSITE (LSPU CCS FORMAT)
│   ├── index.html                      # Complete research website with Obsidian Civic-Tech theme
│   ├── assets/
│   │   ├── css/style.css               # Design tokens, Tugon-style dashboard layout, lightbox modal
│   │   ├── js/config.js                # Centralized live URL endpoints and deliverable links
│   │   ├── js/main.js                  # Lightbox dialog controller, scroll spy, dynamic link binder
│   │   └── img/                        # Authentic system screenshots & architecture diagrams
│   │       ├── dashboard.webp          # Real-Time Budget Transparency Dashboard
│   │       ├── ledger.webp             # Tamper-Proof Budget Ledger
│   │       ├── milestone.webp          # Milestone Progress & Proof Verification
│   │       ├── audit-trail.webp        # Digital Audit Trail & Tamper Detection
│   │       ├── citizen-portal.webp     # Citizen Monitoring & Feedback Portal
│   │       ├── alerts.webp             # Transaction Alerts & Exception Monitoring
│   │       └── architecture.webp       # Multilayered System Architecture Diagram
│   └── README.md                       # Research portal overview & deployment instructions
│
├── contracts/                          # SMART CONTRACT INFRASTRUCTURE (SOLIDITY & HARDHAT)
│   ├── StaCruzChain.sol                # Core municipal budget escrow & multi-sig smart contract
│   └── test/                           # Smart contract test suite (milestone release, gate locks)
│
├── backend/                            # REST API SERVER (NODE.JS & EXPRESS)
│   ├── src/
│   │   ├── controllers/                # Project, milestone, SARO, NCA, and audit controllers
│   │   ├── middleware/                 # JWT authentication, RBAC validators, SHA-256 hasher
│   │   ├── routes/                     # Express REST endpoint routers
│   │   ├── services/                   # Blockchain sync service (ethers.js), tamper surveillance
│   │   └── utils/                      # Supabase client, cryptographic utilities
│   ├── supabase/
│   │   └── schema.sql                  # PostgreSQL relational schema, tables, views, and RLS policies
│   ├── package.json                    # Backend dependencies
│   └── .env.example                    # Backend environment configuration template
│
├── src/                                # FRONTEND PRODUCTION APPLICATION (REACT 19 & VITE)
│   ├── components/                     # Modular UI components (Dashboard, Ledger, Portal, Modals)
│   │   ├── admin/                      # MPDC, Budget Officer, and Treasurer operational canvases
│   │   ├── citizen/                    # Public project catalog, barangay filters, feedback forms
│   │   └── shared/                     # Navigation, metric cards, status badges, hash viewer
│   ├── contracts/                      # ABI definitions and contract interfaces
│   ├── services/                       # API clients, Supabase SDK integration, Web3 providers
│   ├── App.tsx                         # Core application router and state management
│   ├── main.tsx                        # React application bootstrap
│   ├── package.json                    # Frontend dependencies
│   └── vite.config.ts                  # Vite build and bundling configuration
│
├── hardhat.config.cjs                  # Hardhat configuration (Solidity compiler, Sepolia network)
└── README.md                           # Comprehensive thesis research repository documentation
```

---

## 🚀 Quick Execution Guide

### 1. Research Website (GitHub Pages)
The research portal is self-contained and requires no build tooling. Open `BayanLedger-Pages/index.html` directly in any modern browser, or launch a local web server:
```bash
cd BayanLedger-Pages
python -m http.server 8080
# Access locally: http://localhost:8080
```

### 2. Smart Contract Compilation & Testing
The smart contract subsystem is built using Hardhat and Solidity `^0.8.20`:
```bash
# Navigate to smart contract root
npm install

# Compile Solidity contracts
npx hardhat compile

# Run automated smart contract test suite
npx hardhat test
```

### 3. Backend REST API Server Setup
The backend API requires Node.js (v18+) and connects to Supabase PostgreSQL:
```bash
cd backend
npm install

# Configure environment variables
cp .env.example .env
# Update .env with your Supabase URL, Service Role Key, and Sepolia RPC URL

# Execute database schema migration in Supabase SQL Editor:
# backend/supabase/schema.sql

# Start development API server (runs on port 5000)
npm run dev
# Healthcheck: http://localhost:5000/api/health
```

### 4. Frontend Application (Citizen Portal & Admin Dashboard)
The React 19 web application is bundled using Vite:
```bash
# In the project root
npm install

# Configure frontend environment variables
cp .env.example .env
# Set VITE_API_URL=http://localhost:5000 and VITE_CONTRACT_ADDRESS=0x4db61F54B5d9620E15462D2f360F6236b28961F5

# Launch Vite development server (runs on port 3000 / 5173)
npm run dev
# Open in browser: http://localhost:5173
```

---

## 📊 Summary of Research Findings & Empirical Evaluation

System functionality and software quality were rigorously measured through dual evaluation frameworks: **Black-Box Functional Testing** across 225 test cases by 15 independent IT specialists, followed by empirical end-user evaluation using the **ISO/IEC 25010 Software Product Quality Model** with **429 municipal respondents**.

### 1. Black-Box Functional Testing Results

| Test Suite / Functional Module | Evaluated Test Cases | Passed Cases | Failures | Pass Rate | Evaluation Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Module 01: Authentication & Role-Based Access Control** | 25 | 25 | 0 | 100% | **Passed (Zero Defects)** |
| **Module 02: Capital Project Planning & MPDC Lifecycle** | 35 | 35 | 0 | 100% | **Passed (Zero Defects)** |
| **Module 03: Gate 1 Budget Allocation & SARO Registration** | 30 | 30 | 0 | 100% | **Passed (Zero Defects)** |
| **Module 04: Gate 2 Treasury Cash Release & NCA Validation** | 30 | 30 | 0 | 100% | **Passed (Zero Defects)** |
| **Module 05: Milestone Proof Inspection & Photo Checksums** | 40 | 40 | 0 | 100% | **Passed (Zero Defects)** |
| **Module 06: Sepolia Smart Contract Tranche Execution** | 35 | 35 | 0 | 100% | **Passed (Zero Defects)** |
| **Module 07: Automated Database-Ledger Tamper Detection** | 15 | 15 | 0 | 100% | **Passed (Zero Defects)** |
| **Module 08: Citizen Transparency Portal & Feedback Engine** | 15 | 15 | 0 | 100% | **Passed (Zero Defects)** |
| **Comprehensive Total** | **225** | **225** | **0** | **100%** | **Fully Verified** |

### 2. ISO/IEC 25010 Software Quality Evaluation Results

Evaluated across **429 respondents** (399 Santa Cruz citizens and 30 LGU municipal personnel) utilizing a 5-point Likert scale (4.21–5.00 = Strongly Agree):

| ISO/IEC 25010 Quality Characteristic | Citizen Evaluators (N=399) | LGU Staff (N=30) | Overall Weighted Mean | Verbal Interpretation |
| :--- | :---: | :---: | :---: | :---: |
| **Functional Suitability** | 4.57 | 4.60 | **4.58** | Strongly Agree |
| **Performance Efficiency** | 4.51 | 4.53 | **4.52** | Strongly Agree |
| **Compatibility** | 4.53 | 4.55 | **4.54** | Strongly Agree |
| **Usability** | 4.56 | 4.57 | **4.56** | Strongly Agree |
| **Reliability** | 4.52 | 4.55 | **4.53** | Strongly Agree |
| **Security** | 4.58 | 4.62 | **4.59** | Strongly Agree |
| **Maintainability** | 4.50 | 4.53 | **4.51** | Strongly Agree |
| **Portability** | 4.56 | 4.59 | **4.57** | Strongly Agree |
| **Composite Grand Mean** | **4.54** | **4.57** | **4.55** | **Strongly Agree** |

---

## 👥 Research Proponents & Advisory

This capstone research project was conceived, designed, developed, and evaluated by undergraduate researchers at the **College of Computer Studies, Laguna State Polytechnic University (Santa Cruz Main Campus)**:

- **Research Proponents:**
  - **Jazaira M. Alias** — Researcher *(BSIT)*
  - **Harry Anthony A. Martillano** — Researcher *(BSIT)*
  - **Arianna C. Surbano** — Researcher *(BSIT)*
- **Thesis / Capstone Adviser:**
  - **Mia V. Villarica, DIT** — *Associate Dean, College of Computer Studies*
- **Institutional Department:**
  - *College of Computer Studies, Laguna State Polytechnic University*  
  - *Santa Cruz Main Campus, Santa Cruz, Laguna, Philippines*

---

## 🔗 Official Project Links & Deliverables

| Deliverable | Platform / Explorer | Direct URL |
| :--- | :--- | :--- |
| **Live Production Web Application** | Production Domain | [https://bayanledger.live](https://bayanledger.live) |
| **Official GitHub Research Repository** | GitHub (`teamccs-git`) | [https://github.com/harryanthonymartillano-ops/Bayan-Ledger](https://github.com/harryanthonymartillano-ops/Bayan-Ledger) |
| **System Demonstration Recording** | Google Drive Archive | [Google Drive Folder](https://drive.google.com/drive/folders/1B2VHdQdO4AMj5giAhAHvdBhdN18uMksj?usp=drive_link) |
| **Smart Contract Explorer** | Etherscan (Sepolia) | [`0x4db61F54B5d9620E15462D2f360F6236b28961F5`](https://sepolia.etherscan.io/address/0x4db61F54B5d9620E15462D2f360F6236b28961F5) |
| **Evaluation Submission Account** | GitHub Account | `teamccs-git` |
