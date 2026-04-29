# Employee Dashboard — Hybrid Web3 Workforce Management

[![Node](https://img.shields.io/badge/node-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Solidity](https://img.shields.io/badge/solidity-0.8.20-363636?logo=solidity)](https://soliditylang.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![Release](https://img.shields.io/badge/release-v1.0.0-success)](https://github.com/Sailalan3/Employee-Management/releases/tag/v1.0.0)

A full-stack employee management platform where the **Ethereum smart contract is the source of truth** for employee lifecycle events, **MongoDB is the query layer**, and a **React dashboard** gives HR and employees role-scoped access. HR signs every privileged write through MetaMask; the backend verifies the on-chain receipt before mirroring the change to MongoDB.

```
employee-management/
├── blockchain/    Truffle + Solidity 0.8.20 — EmployeeRegistry.sol, migrations, tests
├── backend/       Express + Mongoose + Ethers v6 — REST API, JWT, event listener
└── frontend/      React 19 + Vite + Tailwind — HR & Employee dashboard, MetaMask signing
```

---

## Table of Contents

1. [Highlights](#highlights)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [REST API](#rest-api)
6. [MetaMask Integration](#metamask-integration)
7. [Role-Based Access](#role-based-access)
8. [Project Layout](#project-layout)
9. [Default Credentials](#default-credentials)
10. [Branches & Releases](#branches--releases)
11. [Troubleshooting](#troubleshooting)
12. [License](#license)

---

## Highlights

- **Email + password auth** with bcrypt + JWT. Role embedded in the token (`hr` / `employee`).
- **Role-based access** enforced both server-side (`requireRole(...)` middleware) and client-side (`<ProtectedRoute roles={["hr"]} />`).
- **MetaMask in the loop** for every privileged write — create, update, deactivate. Backend `mirror` endpoints verify the receipt and parse the emitted event before touching Mongo.
- **Auto-provisioned wallets** — HR never types a 0x… address; a random wallet is generated server-side per employee.
- **Auto-provisioned logins** — HR sets an initial password in the create wizard; backend creates the `User` record with `mustChangePassword: true`.
- **Multi-step create wizard** — Core → Personal → Education → Documents (base64 data URLs).
- **AI Insights widget** — heuristic dashboard summary, no external LLM, deterministic from live metrics.
- **Real notification bell** polling on-chain activity, unread badge persisted in localStorage.
- **Graceful chain/Mongo desync recovery** — if a Mongo row references an employee that's no longer on-chain, deactivate falls back to a Mongo-only soft delete with a clear warning.
- **Nonce-safe restarts** — backend resets the `NonceManager` on startup and retries `transaction underpriced` / `already known` errors automatically.
- **Contract-address pinning** — `CONTRACT_ADDRESS` env override stops the backend from drifting between `truffle migrate` runs.
- **Friendly error translation** — raw ethers stack traces become messages like *"Backend wallet is not the contract owner"* or *"Blockchain timeout — is Ganache running?"*

---

## Architecture

```
  Browser (HR or Employee)
      │  email + password login (JWT)
      │  + MetaMask signing for HR writes
      ▼
 ┌───────────────┐    receipt     ┌──────────────────┐    event     ┌─────────────────────┐
 │  Express API  │ ◄──────────── │ EmployeeRegistry │ ───────────► │   Event listener    │
 │  + JWT        │   verify       │  (Ganache)       │              │  backend/listeners  │
 │  + bcrypt     │                │   Ownable        │              │   (idempotent)      │
 └──────┬────────┘                └──────────────────┘              └──────────┬──────────┘
        │ plaintext PII, attendance, payroll, etc.                             │ sync
        ▼                                                                      ▼
                       ┌────────────────────────────────────┐
                       │  MongoDB                           │
                       │   employees, users,                │
                       │   attendance, leaves, tasks,       │
                       │   projects, payroll, reviews,      │
                       │   blockchainLogs                   │
                       └────────────────────────────────────┘
```

- **Writes** — HR signs via MetaMask → tx mined → backend verifies receipt + parses `EmployeeCreated/Updated/Deleted` event → upserts Mongo. Plaintext `name`/`email` only in Mongo; chain stores `keccak256(name)`.
- **Reads** hit Mongo directly for query speed.
- **Listener** subscribes to contract events and replays them into `blockchainLogs` (idempotent via unique `(txHash, logIndex)` index).
- **Gas** is paid by the wallet that signs the tx. With MetaMask in the loop, that's the connected HR wallet (which must be the contract owner).

---

## Prerequisites

- **Node.js 18+**
- **MongoDB** running locally on `mongodb://127.0.0.1:27017`
- **Ganache** UI or CLI on `http://127.0.0.1:7545` (chain id `1337`)
- **MetaMask** extension installed in your browser, with the deployer account imported

---

## Quick Start

```bash
# 1. Deploy the contract
cd blockchain
npm install
cp .env.example .env       # paste your Ganache deployer private key
npx truffle migrate --reset

# 2. Backend
cd ../backend
npm install
cp .env.example .env       # fill DEPLOYER_PRIVATE_KEY, CONTRACT_ADDRESS, JWT_SECRET
npm start                  # http://localhost:3010

# 3. Frontend
cd ../frontend
npm install
cp .env.example .env       # paste VITE_CONTRACT_ADDRESS (same as backend)
npm run dev                # http://localhost:5173
```

Then in MetaMask: **Add network** → RPC `http://127.0.0.1:7545`, chain id `1337`. Import the deployer account using the private key from Ganache. Open `http://localhost:5173`, sign in as HR (`bsailalan@gmail.com` / `Sailalan@2003`), click **Connect Wallet** in the navbar — the green dot confirms the connected address matches the contract owner.

See **[COMMANDS.md](./COMMANDS.md)** for the full command reference and example API calls.

---

## REST API

All write routes require `Authorization: Bearer <jwt>`.

### Auth

| Method | Path                        | Auth | Description                                               |
|--------|-----------------------------|------|-----------------------------------------------------------|
| POST   | `/auth/login`               | —    | `{ email, password }` → `{ token, user }`                 |
| GET    | `/auth/me`                  | JWT  | Current user info                                         |
| POST   | `/auth/change-password`     | JWT  | `{ currentPassword?, newPassword }` — first-login skips current pw check via `mustChangePassword` |

### Employees

| Method | Path                            | Auth   | Description                                          |
|--------|---------------------------------|--------|------------------------------------------------------|
| GET    | `/employees`                    | JWT    | List all (HR sees full roster, employee sees self)   |
| GET    | `/employees/:id`                | JWT    | Get by `employeeId`                                  |
| GET    | `/employees/owner`              | —      | Returns the contract owner address (used by frontend)|
| GET    | `/employees/department/:dept`   | JWT    | Filter by department                                 |
| GET    | `/employees/role/:role`         | JWT    | Filter by role                                       |
| POST   | `/employees/create`             | JWT/HR | Backend-signed create (legacy / no-MetaMask path)    |
| POST   | `/employees/mirror`             | JWT/HR | **MetaMask path** — verifies tx receipt + emitted `EmployeeCreated` event, then mirrors to Mongo |
| PUT    | `/employees/:id`                | JWT/HR | Backend-signed update                                |
| PUT    | `/employees/mirror/:id`         | JWT/HR | **MetaMask path** — verifies receipt + `EmployeeUpdated` event |
| DELETE | `/employees/:id`                | JWT/HR | Deactivate (with stale-record fallback)              |
| DELETE | `/employees/mirror/:id`         | JWT/HR | **MetaMask path** — verifies receipt + `EmployeeDeleted` event |

### Attendance

| Method | Path                       | Auth   | Description                                  |
|--------|----------------------------|--------|----------------------------------------------|
| POST   | `/attendance/clock-in`     | JWT    | Open today's record                          |
| POST   | `/attendance/clock-out`    | JWT    | Close today's record                         |
| POST   | `/attendance/break/start`  | JWT    | Start a break                                |
| POST   | `/attendance/break/end`    | JWT    | End the open break                           |
| GET    | `/attendance/me`           | JWT    | Today's status for the logged-in user        |
| GET    | `/attendance/me/history`   | JWT    | Personal history                             |
| GET    | `/attendance`              | JWT/HR | Team-wide list (date / from-to filters)      |

### Leaves

| Method | Path                       | Auth        | Description                                 |
|--------|----------------------------|-------------|---------------------------------------------|
| GET    | `/leaves`                  | JWT/HR      | All leave records                           |
| GET    | `/leaves/me`               | JWT         | Own leave records                           |
| POST   | `/leaves`                  | JWT/Employee| Request leave (HR can't request)            |
| POST   | `/leaves/:id/approve`      | JWT/HR      | Approve a pending request                   |
| POST   | `/leaves/:id/reject`       | JWT/HR      | Reject a pending request                    |
| POST   | `/leaves/:id/cancel`       | JWT         | Cancel own pending request                  |

### Tasks, Projects, Payroll, Reviews, Analytics, Logs
See **[COMMANDS.md](./COMMANDS.md)** for the complete list with request/response examples.

---

## MetaMask Integration

### How a privileged write happens

```
1. HR clicks Create / Update / Deactivate in the UI
2. Frontend (WalletContext) checks MetaMask is unlocked,
   on chain 1337, and connected to the contract owner address
3. Frontend builds the tx via ethers.Contract(...).connect(signer)
4. MetaMask popup → HR signs
5. Frontend awaits the receipt
6. Frontend parses the EmployeeCreated/Updated/Deleted log
7. Frontend POSTs to /employees/mirror with { txHash, employeeId, ...data }
8. Backend re-fetches the receipt via its own JsonRpcProvider,
   verifies status === 1, log.address === CONTRACT_ADDRESS,
   and the parsed event matches the request body
9. Only then does the backend write to Mongo
```

This means an attacker who steals an HR JWT **cannot** fabricate Mongo rows without also paying gas on a real on-chain tx from the contract owner. The chain is the audit trail; Mongo is the query cache.

### Errors translated for the user

`describeChainError()` (in `frontend/src/blockchain/contract.js`) maps:

| Raw                                   | UI message                                                  |
|---------------------------------------|-------------------------------------------------------------|
| `4001 / ACTION_REJECTED`              | "You cancelled the MetaMask request."                       |
| `OwnableUnauthorizedAccount`          | "Connected wallet isn't the contract owner."                |
| `EmployeeNotFound`                    | "That employee doesn't exist on-chain (stale Mongo record)."|
| `EmployeeInactive`                    | "That employee is already inactive."                        |
| `4902 / unrecognized chain`           | Auto-fallback to `wallet_addEthereumChain`                  |
| `wrong network`                       | Auto-fallback to `wallet_switchEthereumChain`               |

---

## Role-Based Access

| Capability                   | Employee | HR  |
|------------------------------|:--------:|:---:|
| View own profile             | ✅       | ✅  |
| View full roster             | ❌       | ✅  |
| Clock in / out               | ✅       | ✅  |
| View own attendance          | ✅       | ✅  |
| View team attendance         | ❌       | ✅  |
| Request leave                | ✅       | ❌  |
| Cancel own leave             | ✅       | ❌  |
| Approve / reject leave       | ❌       | ✅  |
| Create / update / deactivate employee | ❌ | ✅ (with MetaMask) |
| View blockchain activity     | ✅       | ✅  |

Enforced at three layers: JWT payload (`role` claim), Express middleware (`requireRole(...)`), and React router (`<ProtectedRoute roles={["hr"]} />`). Removing any one layer still leaves the other two — defence in depth.

---

## Project Layout

```
employee-management/
├── blockchain/
│   ├── contracts/EmployeeRegistry.sol     Solidity source (Ownable, custom errors, events)
│   ├── migrations/1_deploy_*.js           Truffle migration
│   ├── test/EmployeeRegistry.test.js      Mocha + Chai contract tests
│   └── truffle-config.js                  solc 0.8.20, ganache @ 7545
│
├── backend/
│   ├── server.js                          Routes + friendly error middleware
│   ├── config/
│   │   ├── db.js                          mongoose.connect()
│   │   ├── blockchain.js                  ethers v6 wiring (FetchRequest, NonceManager, sendTx retry)
│   │   └── seed.js                        First-run HR seed
│   ├── middleware/auth.js                 JWT verify + requireRole(...)
│   ├── models/                            Employee, User, Attendance, Leave, Task, Project, Payroll, Review, BlockchainLog
│   ├── controllers/                       One per resource
│   ├── services/                          authService, employeeService (mirror with receipt verification), identityService
│   ├── routes/                            One file per resource
│   └── listeners/employeeEvents.js        EmployeeCreated/Updated/Deleted → blockchainLogs upsert
│
└── frontend/
    ├── index.html
    ├── vite.config.js, tailwind.config.js, postcss.config.js, eslint.config.js
    └── src/
        ├── main.jsx                       <AuthProvider><WalletProvider><App/></WalletProvider></AuthProvider>
        ├── App.jsx                        React Router v7 + ProtectedRoute gating
        ├── index.css                      Tailwind layers + glass utilities
        ├── blockchain/contract.js         ABI + describeChainError + parseEmployeeCreatedId
        ├── context/AuthContext.jsx        login/logout, JWT storage, role helpers
        ├── context/WalletContext.jsx      MetaMask connect, chain switch, isOwner
        ├── components/                    Layout, Navbar, Sidebar, ProtectedRoute, Avatar, StatusBadge, EmptyState, PageHeader, ProgressModal, Toaster
        ├── pages/                         Login, Dashboard, Employees, EmployeeDetail, Attendance, Leaves, Tasks, Projects (in Tasks), Payroll, Reviews, Settings, BlockchainActivity
        ├── services/api.js                axios + JWT interceptor + endpoint helpers
        └── utils/format.js, toast.js
```

---

## Default Credentials

| Role     | Email                 | Password         | Notes                                        |
|----------|-----------------------|------------------|----------------------------------------------|
| HR admin | `bsailalan@gmail.com` | `Sailalan@2003`  | Seeded on every backend start (idempotent)   |
| Employee | *(set by HR)*         | *(set by HR)*    | Forced to change on first login              |

Override the seed via env: `HR_SEED_EMAIL`, `HR_SEED_PASSWORD`. **Change before shipping.**

---

## Branches & Releases

| Ref           | Purpose                                                                 |
|---------------|-------------------------------------------------------------------------|
| `master`      | Stable release line — 45 commits ending at v1.0.0                       |
| `main`        | Active development — 100 commits (v1.0 + MetaMask integration, role hardening, UX polish) |
| `v1.0.0` tag  | First stable release ([release notes](https://github.com/Sailalan3/Employee-Management/releases/tag/v1.0.0)) |

Default branch is `main`. New work lands on `main`; release-worthy points get cherry-picked or merged into `master` and tagged.

---

## Troubleshooting

**"Could not add network that points to same RPC endpoint as existing network for chain 0x539"**
Wrong chain ID in frontend `.env`. Ganache reports `net_version=5777` but `chainId=1337`. Set `VITE_CHAIN_ID=1337`. Restart Vite.

**Backend hangs at `node server.js` with no output**
Stale or corrupted `node_modules`. Run `rm -rf backend/node_modules && cd backend && npm install`.

**`EADDRINUSE: address already in use :::3010`**
A previous backend is still alive. `lsof -i :3010 -t | xargs kill -9` then start again.

**`OwnableUnauthorizedAccount`**
The wallet signing the tx isn't the contract owner. Check MetaMask is on the deployer account, or re-deploy the contract with the wallet you intend to use.

**Mongo says employee was created, but writes from MetaMask still fail**
The Mongo row is stale from a previous `truffle migrate --reset`. Pin `CONTRACT_ADDRESS` in `backend/.env` to stop drift; the `mirror` deactivate path will fall back to a Mongo-only soft delete with a warning.

---

## License

MIT
