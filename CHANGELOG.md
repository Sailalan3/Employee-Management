# Changelog — Current Session

A flat record of every file touched in this development session, grouped by action. Use this alongside `README.md` (which has a per-file status table) and `COMMANDS.md` (runnable reference).

---

## Summary

| Action      | Count |
|-------------|-------|
| **Added**   | 46    |
| **Edited**  | 9     |
| **Deleted** | 1     |

Baseline before this session: a backend with wallet-signature auth, a single Employee/User model, and a contract deployed on Ganache. No frontend existed. No email/password login. No attendance/tasks/projects/payroll/leaves/reviews/analytics modules.

---

## Pre-existing (kept as-is)

These files existed before the session and were **not modified**:

### Blockchain
- `blockchain/contracts/EmployeeRegistry.sol`
- `blockchain/migrations/*`
- `blockchain/truffle-config.js`
- `blockchain/test/*`

### Backend
- `backend/package.json`, `backend/package-lock.json`
- `backend/config/db.js`
- `backend/models/BlockchainLog.js`
- `backend/controllers/employeeController.js`
- `backend/routes/employeeRoutes.js`
- `backend/listeners/employeeEvents.js`

---

## Edited

Files that existed before the session but were substantially rewritten.

### Backend

| File                                | What changed                                                                 |
|-------------------------------------|------------------------------------------------------------------------------|
| `backend/server.js`                 | Registers 8 new route groups; calls `seedHrUser()` and `wallet.reset()` on startup; centralised ethers error → friendly message translator. |
| `backend/config/blockchain.js`      | Wrapped RPC in `FetchRequest` with configurable 60s timeout; broadened `sendTx` retry detector to cover `underpriced` / `already known` / `replacement` errors. |
| `backend/middleware/auth.js`        | Rewritten for JWT payload `{ userId, email, role, employeeId }`; added `requireRole(...roles)` helper. |
| `backend/models/User.js`            | Replaced nonce/signature fields with `passwordHash`, `role` enum (`hr` / `employee`), `employeeId`, `mustChangePassword`. Legacy `walletAddress` kept optional for back-compat. |
| `backend/models/Employee.js`        | Added `personal` subdoc, `education[]`, `documents[]` (base64 data URLs), `joinDate`, `salary`. |
| `backend/services/authService.js`   | Rewritten for email/password flow: `loginWithPassword`, `changePassword` (skips current-pw check when `mustChangePassword`), `createEmployeeLogin`, `getUserById`, `sanitize`. |
| `backend/services/employeeService.js` | `createEmployee` now accepts `joinDate`, `salary`, `personal`, `education[]`, `documents[]`, `loginPassword` and optionally provisions a User via `createEmployeeLogin`. Auto-generates a random `walletAddress` when HR doesn't supply one. `deactivateEmployee` falls back to Mongo-only cleanup with a `warning` field when the chain row is missing / already inactive. |
| `backend/controllers/authController.js` | Replaced nonce/login handlers with `login`, `changePassword`, `me`.       |
| `backend/routes/authRoutes.js`      | Replaced nonce/login routes with `/login`, `/change-password`, `/me`.        |

### Root

| File        | What changed                                                          |
|-------------|-----------------------------------------------------------------------|
| `README.md` | Rewritten to describe the full stack, auth pivot, and file statuses. |

---

## Added

New files created in this session.

### Backend — infrastructure

- `backend/config/seed.js` — seeds the HR account on startup; drops the legacy unique `walletAddress` index if present.

### Backend — models (6 new)

- `backend/models/Attendance.js`
- `backend/models/Project.js`
- `backend/models/Task.js`
- `backend/models/Payroll.js`
- `backend/models/Leave.js`
- `backend/models/Review.js`

### Backend — services (1 new)

- `backend/services/identityService.js` — resolves the caller to an Employee record via JWT `employeeId` (wallet fallback for legacy tokens).

### Backend — controllers (8 new)

- `backend/controllers/attendanceController.js`
- `backend/controllers/projectController.js`
- `backend/controllers/taskController.js`
- `backend/controllers/payrollController.js`
- `backend/controllers/leaveController.js`
- `backend/controllers/reviewController.js`
- `backend/controllers/analyticsController.js`
- `backend/controllers/logController.js`

### Backend — routes (8 new)

- `backend/routes/attendanceRoutes.js`
- `backend/routes/projectRoutes.js`
- `backend/routes/taskRoutes.js`
- `backend/routes/payrollRoutes.js`
- `backend/routes/leaveRoutes.js`
- `backend/routes/reviewRoutes.js`
- `backend/routes/analyticsRoutes.js`
- `backend/routes/logRoutes.js`

### Frontend — full app scaffold (new)

- `frontend/index.html`
- `frontend/package.json`, `frontend/package-lock.json`
- `frontend/vite.config.js`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/eslint.config.js`
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/src/index.css`

### Frontend — context

- `frontend/src/context/AuthContext.jsx` — email/password login, JWT decoding, role exposure.

### Frontend — components

- `frontend/src/components/Layout.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/components/Avatar.jsx`
- `frontend/src/components/PageHeader.jsx`
- `frontend/src/components/ProgressModal.jsx`
- `frontend/src/components/EmptyState.jsx`
- `frontend/src/components/StatusBadge.jsx`
- `frontend/src/components/Toaster.jsx`

### Frontend — pages (10 new)

- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Employees.jsx`
- `frontend/src/pages/EmployeeDetail.jsx`
- `frontend/src/pages/Attendance.jsx`
- `frontend/src/pages/Tasks.jsx`
- `frontend/src/pages/Payroll.jsx`
- `frontend/src/pages/Leaves.jsx`
- `frontend/src/pages/Reviews.jsx`
- `frontend/src/pages/BlockchainActivity.jsx`
- `frontend/src/pages/Settings.jsx`

### Frontend — services / utils / blockchain helpers

- `frontend/src/services/api.js`
- `frontend/src/blockchain/contract.js`
- `frontend/src/utils/format.js`
- `frontend/src/utils/toast.js`

### Root

- `COMMANDS.md` — runnable command reference.
- `CHANGELOG.md` — this file.

---

## Deleted

| File                                     | Why |
|------------------------------------------|-----|
| `frontend/src/context/ThemeContext.jsx`  | Theme toggle was wired to a non-existent light-mode CSS (no `dark:` variants were authored). User reported "black and white page is not working." Removed the provider, the toggle button in Navbar, and the Settings theme row. |

---

## Notable behavioural changes (not file-level)

These affect runtime behaviour but don't change any single file on their own — worth calling out:

1. **Auth model pivoted from MetaMask signature → email + password.** Old `/auth/nonce` + signature login is gone. JWTs now carry `{ userId, email, role, employeeId }` instead of `{ walletAddress }`.
2. **HR is seeded on every backend start** (`bsailalan@gmail.com` / `Sailalan@2003`). If the user already exists, only the `role` is corrected to `hr`.
3. **Legacy `walletAddress_1` unique index** on the `users` collection is auto-dropped on startup — old deployments that had it would otherwise fail new employee-login provisioning with E11000.
4. **Wallet auto-generation.** HR never types 0x… addresses; the backend calls `ethers.Wallet.createRandom().address` when none is supplied.
5. **Graceful deactivate.** If the on-chain call reverts because the employee doesn't exist or is already inactive, the backend reads the chain state to confirm and falls back to a Mongo-only soft-delete. The response includes `warning: "…"`, which the UI surfaces as a toast.
6. **Nonce-safe restart.** `wallet.reset()` runs at startup. `sendTx` retries once on `underpriced` / `already known` in addition to plain `nonce` errors.
7. **Friendly error envelope.** The express error handler translates common ethers failure shapes to human-readable messages (`TIMEOUT`, `NETWORK_ERROR`, `EmployeeNotFound`, `EmployeeInactive`, `OwnableUnauthorizedAccount`, `insufficient funds`).
8. **Role-scoped frontend routing.** `/employees`, `/employees/:id`, `/payroll`, `/blockchain` are HR-only. Employees hitting those URLs redirect home. Sidebar hides those links entirely for employees.
9. **Notification bell is real.** Polls `/analytics/recent-activity` every 30s, stores a `lastSeen` timestamp in `localStorage`, shows an unread badge, and renders a dropdown of the last 8 on-chain events.
10. **AI Insights widget.** A heuristic, deterministic summary on the Dashboard (no external LLM call). Reads summary + chart data and emits up to 5 short bullets.

---

## Default credentials (set in this session)

| Role | Email                 | Password        |
|------|-----------------------|-----------------|
| HR   | `bsailalan@gmail.com` | `Sailalan@2003` |

Override via `HR_SEED_EMAIL` / `HR_SEED_PASSWORD` env vars.
