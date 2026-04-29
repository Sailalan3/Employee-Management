# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — `main` branch

Active development continuing past v1.0. Adds MetaMask in the loop for every
privileged write, splits role-aware pages into HR / Employee variants, and
hardens both backend and frontend against common chain failure modes.

### Added
- **Frontend MetaMask integration**
  - `frontend/src/blockchain/contract.js` — full ABI, `keccakName()`,
    `parseEmployeeCreatedId()`, `describeChainError()` for user-friendly
    translation of `ACTION_REJECTED`, `OwnableUnauthorizedAccount`,
    `EmployeeNotFound`, etc.
  - `frontend/src/context/WalletContext.jsx` — exposes
    `hasMetaMask`, `account`, `chainId`, `onRightChain`, `ownerAddress`,
    `isOwner`, `connect`, `ensureChain`, `getWriteContract`. Handles
    `wallet_switchEthereumChain` with `4902` fallback to
    `wallet_addEthereumChain`.
  - HR-only **Connect Wallet** button in the Navbar with a colour-coded
    status dot (green = owner, amber = wrong chain, red = not owner).
  - MetaMask signing required on Employee create / update / deactivate.
  - Preflight wallet readiness check before opening the MetaMask popup.
  - Random wallet generation client-side as a deployer fallback when
    HR doesn't supply a 0x… address.
- **Backend mirror endpoints with on-chain receipt verification**
  - `GET  /employees/owner` — returns the contract owner address.
  - `POST /employees/mirror` — verifies tx receipt, parses
    `EmployeeCreated` event from `log.address === CONTRACT_ADDRESS`,
    asserts `Number(parsed.args.employeeId) === payload.employeeId`,
    only then writes Mongo.
  - `PUT  /employees/mirror/:id` — same flow for `EmployeeUpdated`.
  - `DELETE /employees/mirror/:id` — same flow for `EmployeeDeleted`,
    with stale-Mongo-row fallback.
- **Role-aware page splits**
  - `Leaves.jsx` → `HRLeaves` (pending / approved / rejected / all
    tabs, no Request button) + `EmployeeLeaves` (request + cancel only,
    no Approve / Reject).
  - `Attendance.jsx` → HR team-view (date picker, KPIs, joined roster
    with `Not clocked in` rows for absent employees) + Employee
    personal-view (clock in/out + breaks).
- **UX polish**
  - Notification bell with unread badge persisted in localStorage.
  - AI Insights widget — heuristic, deterministic, no external LLM.
  - Glassmorphism design system across cards and modals.
  - Animated metric tiles on the dashboard.
  - `ProgressModal` wired into employee writes for tx-pending feedback.
- **Tooling**
  - Smoke test for `/health` endpoint.
  - 3-minute demo script + voice-over notes (in `COMMANDS.md`).

### Changed
- **Role gates** (defence in depth — backend AND frontend)
  - `requireRole("hr")` on `/leaves/:id/approve` and `/leaves/:id/reject`.
  - `requireRole("employee")` on `POST /leaves` (HR adjudicates,
    doesn't request).
  - `requireRole("hr")` on team-wide `/attendance`.
  - `requireRole("hr")` on all `/employees/mirror/*` endpoints.
  - Frontend hides Approve / Reject buttons from non-HR users and the
    "Request leave" button from HR.
- **Friendly error translation**
  - Backend `friendlyMessage()` middleware translates ethers errors
    (`TIMEOUT`, `NETWORK_ERROR`, `EmployeeNotFound`, `EmployeeInactive`,
    `OwnableUnauthorizedAccount`, `insufficient funds`) into messages
    the frontend can show as a toast.
- **Contract-address pinning**
  - Backend honours `CONTRACT_ADDRESS` env override, stopping the
    silent drift between `truffle migrate --reset` runs.
- **Chain ID correction**
  - `VITE_CHAIN_ID` set to `1337` (EIP-155) to match what MetaMask sees.
    Ganache's `net_version` is still `5777` for Truffle's artifact key,
    but the browser always uses `1337`.
- **Route ordering**
  - `GET /employees/owner` declared before `GET /employees/:id` so it
    isn't shadowed by the wildcard.

### Fixed
- MetaMask user rejection (`4001` / `ACTION_REJECTED`) no longer crashes
  the page — toast + return to form.
- Wrong-chain detection auto-switches via `wallet_switchEthereumChain`,
  with `4902` fallback to `wallet_addEthereumChain`.
- Stale Mongo rows from a prior Ganache deployment now soft-delete with a
  warning instead of throwing a raw `EmployeeNotFound` revert.
- Ethers HTTP timeout raised to 60 s (configurable via `RPC_TIMEOUT_MS`)
  to handle large document payloads on slow Ganache instances.
- `transaction underpriced` and `already known` errors trigger
  `NonceManager.reset()` and a single retry.
- MongoDB transient disconnect handled with auto-reconnect; backend
  exits cleanly if the initial connect fails.

### Refactored
- `sendTx()` helper extracted in `config/blockchain.js` to centralise
  the nonce-desync retry logic.
- All endpoint definitions centralised in `frontend/src/services/api.js`.
- Friendly-message helper extracted into reusable middleware.

### Style
- Backend and frontend formatted with consistent quoting and indent.

### Docs
- README v2 with badges, MetaMask integration section, full REST table,
  role matrix, branches & releases, and troubleshooting.
- COMMANDS.md expanded with MetaMask setup, GitHub workflow, and a
  3-minute demo voice-over guide.

---

## [1.0.0] — 2026-04-14 · `master` branch / `v1.0.0` tag

First stable release.

### Added
- **Smart contract** — `EmployeeRegistry.sol` (Solidity 0.8.20, Ownable,
  custom errors, `EmployeeCreated`, `EmployeeUpdated`, `EmployeeDeleted`
  events). Deployment migration. Mocha + Chai test suite.
- **Backend** — Express + Mongoose + Ethers v6:
  - JWT auth (`bcrypt` password hashing, `requireRole(...)` middleware).
  - Models: Employee, User, Attendance, Leave, Task, Project, Payroll,
    Review, BlockchainLog.
  - Controllers + routes for all resources.
  - HR seeding script — first-run admin account.
  - Event listener subscribing to `EmployeeCreated/Updated/Deleted`,
    upserting into `blockchainLogs` (idempotent via unique
    `(txHash, logIndex)` index).
  - Friendly error middleware translating ethers errors into UI strings.
- **Frontend** — React 19 + Vite + Tailwind:
  - Auth flow (Login, Change Password, mustChangePassword on first login).
  - Dashboard with KPI tiles, AI Insights widget, recent on-chain activity.
  - Employees page with multi-step Create wizard (Core → Personal →
    Education → Documents).
  - Attendance, Leaves, Tasks, Projects (in Tasks), Payroll, Reviews,
    Settings, Blockchain Activity pages.
  - Reusable components: Layout, Navbar, Sidebar, ProtectedRoute, Avatar,
    StatusBadge, EmptyState, PageHeader, ProgressModal, Toaster.
  - axios client with JWT interceptor and typed endpoint helpers.
- **Documentation** — README with architecture diagram, COMMANDS reference,
  initial CHANGELOG.

### Removed
- Legacy SQLite prototype (`database.sqlite`, `index.js`, baseline
  `lib/`, `models/`, root `package.json`) — replaced by the new stack.

---

## [0.0.1] — 2025-02-14 · baseline

Initial fork from
[hrishikesh1997/Employee-Management](https://github.com/hrishikesh1997/Employee-Management).

### Pre-existing
- README placeholder.
- SQLite-based Node prototype (later removed in 1.0.0).

---

## Branch Map

```
v1.0.0 tag (release)
   │
   ▼
master ──●──●──●──●── ... ──●  (45 commits, baseline → v1.0.0)
                            │
                            └─ branched into ─┐
                                              ▼
                              main ──●──●── ... ──●  (100 commits, v1.0.0 + ongoing)
```

- **master** — release line. Stable cuts; tagged.
- **main** — active development. Default branch on GitHub.
- New work lands on `main`. Release-worthy points are merged or
  cherry-picked into `master` and tagged.

---

## Versioning policy

- **MAJOR** — incompatible API changes (e.g. JWT payload shape change,
  contract ABI break).
- **MINOR** — backward-compatible feature additions (e.g. a new endpoint,
  a new page).
- **PATCH** — backward-compatible bug fixes and polish.

Unreleased changes accumulate under `[Unreleased]`. When cutting a
release, that section becomes the next version heading and a fresh
`[Unreleased]` is opened above it.
