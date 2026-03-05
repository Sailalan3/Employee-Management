# Employee Dashboard — Hybrid Web3 Workforce Management

A full-stack employee management platform where the **Ethereum smart contract is the source of truth** for employee lifecycle events, **MongoDB is the query layer**, and the **React dashboard** gives HR and employees role-scoped access with email/password login. HR can register employees, capture personal/education/document records, and issue initial login credentials. Employees sign in, change their password, and see a scoped view of the workspace.

```
employee-management/
├── blockchain/    Truffle project — EmployeeRegistry.sol, migrations, tests
├── backend/       Express + Mongoose + Ethers — REST API, JWT, event sync
└── frontend/      React + Vite + Tailwind — HR & Employee dashboard
```

---

## Highlights

- **Email/password auth** with bcrypt + JWT (replaced the old MetaMask signature flow).
- **Role-based access** — `hr` vs `employee` — enforced both in routes (`requireRole`) and in the frontend router.
- **Seeded HR account** so the dashboard is usable out of the box (`bsailalan@gmail.com` / `Sailalan@2003` — change before shipping).
- **Auto-provisioned wallets** — HR never types a 0x… address. Each new employee gets a random wallet generated server-side and recorded on-chain.
- **Auto-provisioned logins** — when HR supplies an initial password in the Create Employee wizard, a `User` record is created in the same call with `mustChangePassword: true`.
- **Multi-step create wizard** — Core → Personal → Education → Documents. Files are stored as base64 data URLs on the employee doc.
- **AI Insights widget** — heuristic dashboard summary (no external LLM). Uses live metrics to generate short, deterministic bullets.
- **Real notification bell** — polls recent on-chain activity, keeps an unread badge in localStorage.
- **Graceful chain desync recovery** — if MongoDB has stale rows from a prior Ganache deployment, deactivate falls back to Mongo-only cleanup with a clear warning instead of a raw revert.
- **Nonce-safe restarts** — the backend resets the NonceManager on startup and retries `underpriced` / `already known` errors automatically.

---

## Architecture

```
  Browser (HR / Employee)
      │  email + password
      ▼
 ┌───────────────┐          ┌──────────────────┐        ┌─────────────────────┐
 │  Express API  │  tx      │ EmployeeRegistry │ event  │   Event listener    │
 │  + JWT        │ ───────► │  (Ganache)       │ ─────► │  backend/listeners  │
 │  + bcrypt     │          │                  │        │                     │
 └──────┬────────┘          └──────────────────┘        └──────────┬──────────┘
        │ plaintext PII, auth users, attendance, payroll, etc.    │ sync
        ▼                                                          ▼
                       ┌──────────────────────────────┐
                       │  MongoDB (employees, users,  │
                       │  attendance, tasks, leaves,  │
                       │  reviews, payroll,           │
                       │  projects, blockchainLogs)   │
                       └──────────────────────────────┘
```

- **Writes** go through Express → signed tx from backend wallet → receipt → Mongo upsert. Plaintext `name` / `email` only in Mongo; chain stores `keccak256(name)`.
- **Reads** hit Mongo directly.
- **Listener** subscribes to `EmployeeCreated / EmployeeUpdated / EmployeeDeleted` and replays into `blockchainLogs` (idempotent via unique `(txHash, logIndex)`).
- **Gas** is paid by the backend wallet (`DEPLOYER_PRIVATE_KEY`). Contract uses `Ownable`, so only that wallet can mutate state.

---

## Prerequisites

- Node.js 18+
- MongoDB running locally (`mongodb://127.0.0.1:27017`)
- Ganache UI or CLI on `http://127.0.0.1:7545` (chain id `1337`)

---

## Quick start

```bash
# 1. deploy contract
cd blockchain
npm install
npx truffle migrate --reset

# 2. backend
cd ../backend
npm install
cp .env.example .env   # fill in DEPLOYER_PRIVATE_KEY + JWT_SECRET
npm start              # http://localhost:3010

# 3. frontend
cd ../frontend
npm install
npm run dev            # http://localhost:5173
```

Log in as HR with the seeded credentials, or any employee you've created through the UI. See `COMMANDS.md` for the full set of commands and example API calls.

---

## REST API

All write routes require `Authorization: Bearer <jwt>`.

### Auth (email/password)

| Method | Path                      | Auth | Description                                       |
|--------|---------------------------|------|---------------------------------------------------|
| POST   | `/auth/login`             | —    | `{ email, password }` → `{ token, user }`         |
| GET    | `/auth/me`                | JWT  | Current user info                                  |
| POST   | `/auth/change-password`   | JWT  | `{ currentPassword?, newPassword }` — skips current pw check if `mustChangePassword` is true |

### Employees (HR)

| Method | Path                          | Auth | Description                                |
|--------|-------------------------------|------|--------------------------------------------|
| POST   | `/employees/create`           | JWT  | Create employee on-chain + Mongo; optionally issue login |
| PUT    | `/employees/:id`              | JWT  | Update employee                            |
| DELETE | `/employees/:id`              | JWT  | Deactivate (with stale-record fallback)    |
| GET    | `/employees`                  | —    | List all                                   |
| GET    | `/employees/:id`              | —    | Get by employeeId                          |
| GET    | `/employees/department/:dept` | —    | Filter by department                       |
| GET    | `/employees/role/:role`       | —    | Filter by role                             |
| GET    | `/employees/sort/name`        | —    | List sorted by name                        |

### Attendance, Tasks, Projects, Payroll, Leaves, Reviews, Analytics, Logs
See `COMMANDS.md` for a complete route table with examples.

---

## File-by-file status

Legend: **[Existing]** file existed before this session, **[Edited]** existed but was rewritten / modified, **[Added]** created in this session, **[Deleted]** removed in this session.

### `blockchain/`

| File                                          | Status     | Notes |
|-----------------------------------------------|------------|-------|
| `contracts/EmployeeRegistry.sol`              | [Existing] | Untouched — still the single source of truth for employee lifecycle. |
| `migrations/*`, `truffle-config.js`, `test/*` | [Existing] | Untouched. |

### `backend/`

| File                                    | Status     | Notes |
|-----------------------------------------|------------|-------|
| `server.js`                             | [Edited]   | Mounts 10 route groups (added 8 new ones), runs HR seed, resets NonceManager on startup, translates ethers errors to friendly messages. |
| `config/db.js`                          | [Existing] | Unchanged. |
| `config/blockchain.js`                  | [Edited]   | Wrapped RPC in `FetchRequest` with 60s timeout; broadened `sendTx` retry to cover `underpriced` / `already known`. |
| `config/seed.js`                        | [Added]    | Seeds HR account on startup; drops legacy unique `walletAddress` index. |
| `middleware/auth.js`                    | [Edited]   | Rewritten for email/password JWTs; added `requireRole(...)` helper. |
| `models/User.js`                        | [Edited]   | Replaced nonce/signature fields with `passwordHash`, `role`, `employeeId`, `mustChangePassword`. |
| `models/Employee.js`                    | [Edited]   | Added `personal`, `education[]`, `documents[]`, `joinDate`, `salary`. |
| `models/BlockchainLog.js`               | [Existing] | Unchanged. |
| `models/Attendance.js`                  | [Added]    | Clock in / out / break with `unique(employeeId, date)`. |
| `models/Project.js`                     | [Added]    | Name, status, member list. |
| `models/Task.js`                        | [Added]    | Title, projectId, assigneeId, status, priority. |
| `models/Payroll.js`                     | [Added]    | Per-employee period with `unique(employeeId, period)`. |
| `models/Leave.js`                       | [Added]    | Request/approve/reject/cancel. |
| `models/Review.js`                      | [Added]    | Per-employee periodic review with 1–5 rating. |
| `services/authService.js`               | [Edited]   | Rewritten — `loginWithPassword`, `changePassword`, `createEmployeeLogin`, `getUserById`, `sanitize`. |
| `services/employeeService.js`           | [Edited]   | Accepts rich profile fields + `loginPassword`; auto-generates wallet if missing; graceful deactivate fallback when chain row is stale. |
| `services/identityService.js`           | [Added]    | Resolves the caller to an Employee record via JWT `employeeId` (falls back to wallet for legacy tokens). |
| `controllers/authController.js`         | [Edited]   | Now exposes `login`, `changePassword`, `me`. |
| `controllers/employeeController.js`     | [Existing] | Unchanged (service-layer changes flow through). |
| `controllers/attendanceController.js`   | [Added]    | Clock-in/out, breaks, list by date range. |
| `controllers/projectController.js`      | [Added]    | Project CRUD + member management. |
| `controllers/taskController.js`         | [Added]    | Task CRUD with status filters. |
| `controllers/payrollController.js`      | [Added]    | Compute/upsert period payroll, status transitions. |
| `controllers/leaveController.js`        | [Added]    | Request, approve, reject, cancel. |
| `controllers/reviewController.js`       | [Added]    | Periodic performance reviews. |
| `controllers/analyticsController.js`    | [Added]    | `/summary`, `/by-department`, `/weekly-hours`, `/productivity`, `/recent-activity`. |
| `controllers/logController.js`          | [Added]    | List blockchain events. |
| `routes/authRoutes.js`                  | [Edited]   | `/login`, `/change-password`, `/me`. |
| `routes/employeeRoutes.js`              | [Existing] | Unchanged. |
| `routes/attendanceRoutes.js`            | [Added]    | |
| `routes/projectRoutes.js`               | [Added]    | |
| `routes/taskRoutes.js`                  | [Added]    | |
| `routes/payrollRoutes.js`               | [Added]    | |
| `routes/leaveRoutes.js`                 | [Added]    | |
| `routes/reviewRoutes.js`                | [Added]    | |
| `routes/analyticsRoutes.js`             | [Added]    | |
| `routes/logRoutes.js`                   | [Added]    | |
| `listeners/employeeEvents.js`           | [Existing] | Unchanged. |

### `frontend/` (all new in this session unless noted)

| File                                    | Status   | Notes |
|-----------------------------------------|----------|-------|
| `index.html`                            | [Added]  | Title = "Employee Dashboard". |
| `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `eslint.config.js` | [Added] | |
| `src/main.jsx`                          | [Added]  | Renders `AuthProvider` → `App`. |
| `src/App.jsx`                           | [Added]  | Router with HR-only route gating via `ProtectedRoute roles={["hr"]}`. |
| `src/index.css`                         | [Added]  | Global styles + glassmorphism utilities. |
| `src/context/AuthContext.jsx`           | [Added]  | Email/password login, JWT decoding for role, `isHR`/`isEmployee`/`mustChangePassword`. |
| `src/context/ThemeContext.jsx`          | [Deleted]| Removed — toggle was broken (no light-mode CSS variants). |
| `src/components/Layout.jsx`             | [Added]  | Shell with Sidebar + Navbar + `<Outlet />`. |
| `src/components/Sidebar.jsx`            | [Added]  | Role-filtered nav, rebranded to "Employee Dashboard". |
| `src/components/Navbar.jsx`             | [Added]  | Live notification bell (polls `/analytics/recent-activity`), email identity, sign-out. |
| `src/components/ProtectedRoute.jsx`     | [Added]  | Gates by auth + optional role list. |
| `src/components/Avatar.jsx`, `PageHeader.jsx`, `ProgressModal.jsx`, `EmptyState.jsx`, `StatusBadge.jsx`, `Toaster.jsx` | [Added] | Small reusable UI. |
| `src/pages/Login.jsx`                   | [Added]  | Clean email + password form; no branding chip. |
| `src/pages/Dashboard.jsx`               | [Added]  | KPIs, charts, AI Insights widget, recent on-chain activity. |
| `src/pages/Employees.jsx`               | [Added]  | Table + multi-step Create wizard (Core + Login / Personal / Education / Documents). |
| `src/pages/EmployeeDetail.jsx`          | [Added]  | Per-employee profile view. |
| `src/pages/Attendance.jsx`              | [Added]  | Clock in / out / break UI + history table. |
| `src/pages/Tasks.jsx`                   | [Added]  | Kanban-ish task board + project management. |
| `src/pages/Payroll.jsx`                 | [Added]  | Period upsert, status transitions. |
| `src/pages/Leaves.jsx`                  | [Added]  | Request / approve / reject / cancel. |
| `src/pages/Reviews.jsx`                 | [Added]  | Periodic review upsert with rating. |
| `src/pages/BlockchainActivity.jsx`      | [Added]  | Event log viewer. |
| `src/pages/Settings.jsx`                | [Added]  | Account info + Change Password card. |
| `src/services/api.js`                   | [Added]  | Axios client + JWT interceptor + typed endpoint helpers. |
| `src/blockchain/contract.js`            | [Added]  | Constants (`CONTRACT_ADDRESS`, `CHAIN_ID`, `NETWORK_NAME`) surfaced in Settings. |
| `src/utils/format.js`, `toast.js`       | [Added]  | |

### Root

| File          | Status     | Notes |
|---------------|------------|-------|
| `README.md`   | [Edited]   | You are here. |
| `COMMANDS.md` | [Added]    | Runnable command reference. |
| `CHANGELOG.md`| [Added]    | Session-level summary of additions / edits / deletes. |

---

## Default credentials

| Role      | Email                     | Password        | Notes                        |
|-----------|---------------------------|-----------------|------------------------------|
| HR admin  | `bsailalan@gmail.com`     | `Sailalan@2003` | Seeded on every backend start|
| Employee  | *(set by HR in wizard)*   | *(set by HR)*   | Forced to change on first login |

Override via env: `HR_SEED_EMAIL`, `HR_SEED_PASSWORD`.

---

## License

MIT
