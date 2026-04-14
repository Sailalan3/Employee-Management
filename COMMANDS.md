# Commands Reference

Every command you need to run, test, or debug this project. Copy-paste ready.

---

## 1. One-time setup

```bash
# From the repo root:

# 1) Blockchain (Truffle + Ganache)
cd blockchain
npm install
# Start Ganache UI/CLI on http://127.0.0.1:7545 with chain id 1337 first, then:
npx truffle migrate --reset

# 2) Backend
cd ../backend
npm install
cp .env.example .env          # edit: DEPLOYER_PRIVATE_KEY, JWT_SECRET

# 3) Frontend
cd ../frontend
npm install
```

### Required `.env` (backend)

```env
MONGO_URI=mongodb://127.0.0.1:27017/employeeDapp
GANACHE_RPC_URL=http://127.0.0.1:7545
# Ganache UI defaults to 5777; Ganache CLI defaults to 1337. Match whichever you run.
GANACHE_CHAIN_ID=5777
DEPLOYER_PRIVATE_KEY=0x<your-ganache-account-0-key>

# Pin the deployed contract. If unset, the backend falls back to whatever
# address Truffle last wrote into blockchain/build/contracts/EmployeeRegistry.json,
# which changes every time you run `truffle migrate --reset`.
CONTRACT_ADDRESS=0x<deployed-address>

JWT_SECRET=<any-long-random-string>
JWT_EXPIRES_IN=7d
PORT=3010

# Optional
RPC_TIMEOUT_MS=60000
POLL_INTERVAL_MS=250
HR_SEED_EMAIL=bsailalan@gmail.com
HR_SEED_PASSWORD=Sailalan@2003
```

---

## 2. Running the app (3 terminals)

```bash
# Terminal 1 — Ganache
# Open Ganache.app OR run:
# npx ganache --chain.chainId 1337 --port 7545

# Terminal 2 — backend
cd backend && npm start
# Expected:
#   MongoDB connected: mongodb://127.0.0.1:27017/employeeDapp
#   [seed] created HR account: bsailalan@gmail.com   (first run only)
#   [listener] subscribed to EmployeeRegistry events
#   Server running on http://localhost:3010

# Terminal 3 — frontend
cd frontend && npm run dev
# Opens http://localhost:5173
```

Sign in with `bsailalan@gmail.com` / `Sailalan@2003`.

---

## 3. Blockchain commands

```bash
cd blockchain
npx truffle migrate                 # deploy if no deployment exists for chain
npx truffle migrate --reset         # redeploy fresh (wipes contract state)
npx truffle test                    # run Solidity tests
npx truffle console --network development   # interactive REPL
```

---

## 4. Frontend commands

```bash
cd frontend
npm run dev         # Vite dev server with HMR
npm run build       # Production build → dist/
npm run preview     # Preview the production build locally
npm run lint        # ESLint
```

---

## 5. Backend smoke tests (curl)

```bash
# Health
curl http://localhost:3010/health

# HR login
TOKEN=$(curl -s -X POST http://localhost:3010/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bsailalan@gmail.com","password":"Sailalan@2003"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo $TOKEN

# Current user
curl -s http://localhost:3010/auth/me -H "Authorization: Bearer $TOKEN"

# Create employee (wallet auto-generated; loginPassword optional)
curl -s -X POST http://localhost:3010/employees/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Ada Lovelace",
    "email":"ada@example.com",
    "department":"Engineering",
    "role":"Staff Engineer",
    "loginPassword":"TempPass123"
  }'

# List employees
curl -s http://localhost:3010/employees | python3 -m json.tool

# Deactivate #1 (soft-deletes in Mongo if chain record is stale)
curl -s -X DELETE http://localhost:3010/employees/1 \
  -H "Authorization: Bearer $TOKEN"

# Employee login + forced password change
ETOKEN=$(curl -s -X POST http://localhost:3010/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"TempPass123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s -X POST http://localhost:3010/auth/change-password \
  -H "Authorization: Bearer $ETOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"NewSecretPw9"}'
```

---

## 6. Full API route table

### Auth

| Method | Path                    | Auth | Body / Query                                 |
|--------|-------------------------|------|----------------------------------------------|
| POST   | `/auth/login`           | —    | `{ email, password }`                        |
| GET    | `/auth/me`              | JWT  | —                                            |
| POST   | `/auth/change-password` | JWT  | `{ currentPassword?, newPassword }`          |

### Employees

| Method | Path                          | Auth | Body / Query                                   |
|--------|-------------------------------|------|------------------------------------------------|
| POST   | `/employees/create`           | JWT  | `{ name, email, department, role, walletAddress?, joinDate?, salary?, personal?, education?, documents?, loginPassword? }` |
| PUT    | `/employees/:id`              | JWT  | Any of the above fields (partial)              |
| DELETE | `/employees/:id`              | JWT  | —                                              |
| GET    | `/employees`                  | —    | —                                              |
| GET    | `/employees/:id`              | —    | —                                              |
| GET    | `/employees/department/:dept` | —    |                                                |
| GET    | `/employees/role/:role`       | —    |                                                |
| GET    | `/employees/sort/name`        | —    |                                                |

### Attendance

| Method | Path                          | Auth | Description                          |
|--------|-------------------------------|------|--------------------------------------|
| POST   | `/attendance/clock-in`        | JWT  | Mark start of workday                |
| POST   | `/attendance/clock-out`       | JWT  | Mark end                             |
| POST   | `/attendance/break/start`     | JWT  | Begin break                          |
| POST   | `/attendance/break/end`       | JWT  | End break                            |
| GET    | `/attendance/me`              | JWT  | Today's record                       |
| GET    | `/attendance/me/history?limit=30` | JWT | Own history                      |
| GET    | `/attendance?employeeId=&date=&from=&to=` | JWT | HR view                    |

### Projects / Tasks

| Method | Path              | Auth | Body                                                     |
|--------|-------------------|------|----------------------------------------------------------|
| GET    | `/projects`       | JWT  | —                                                        |
| POST   | `/projects`       | JWT  | `{ name, description?, status?, members?: number[] }`    |
| PUT    | `/projects/:id`   | JWT  | partial                                                  |
| DELETE | `/projects/:id`   | JWT  | —                                                        |
| GET    | `/tasks?status=&projectId=&assigneeId=` | JWT | —                              |
| POST   | `/tasks`          | JWT  | `{ title, projectId?, assigneeId?, status?, priority?, dueDate? }` |
| PUT    | `/tasks/:id`      | JWT  | partial                                                  |
| DELETE | `/tasks/:id`      | JWT  | —                                                        |

### Payroll

| Method | Path                       | Auth | Body                                         |
|--------|----------------------------|------|----------------------------------------------|
| GET    | `/payroll?period=YYYY-MM&employeeId=` | JWT | —                                 |
| POST   | `/payroll`                 | JWT  | `{ employeeId, period, baseSalary, bonuses?, deductions? }` |
| PUT    | `/payroll/:id/status`      | JWT  | `{ status: "draft" \| "approved" \| "paid" }`|
| DELETE | `/payroll/:id`             | JWT  | —                                            |

### Leaves

| Method | Path                   | Auth | Body                                              |
|--------|------------------------|------|---------------------------------------------------|
| GET    | `/leaves?status=`      | JWT  | HR sees all; employees see own                    |
| GET    | `/leaves/me`           | JWT  | —                                                 |
| POST   | `/leaves`              | JWT  | `{ type, startDate, endDate, reason? }`           |
| POST   | `/leaves/:id/approve`  | JWT  | `{ note? }`                                       |
| POST   | `/leaves/:id/reject`   | JWT  | `{ note? }`                                       |
| POST   | `/leaves/:id/cancel`   | JWT  | —                                                 |

### Reviews

| Method | Path                 | Auth | Body                                           |
|--------|----------------------|------|------------------------------------------------|
| GET    | `/reviews?employeeId=&period=` | JWT | —                                   |
| POST   | `/reviews`           | JWT  | `{ employeeId, period, rating, strengths?, improvements?, goals? }` |
| DELETE | `/reviews/:id`       | JWT  | —                                              |

### Analytics

| Method | Path                             | Auth | Description                      |
|--------|----------------------------------|------|----------------------------------|
| GET    | `/analytics/summary`             | JWT  | Headline KPIs                    |
| GET    | `/analytics/by-department`       | JWT  | Department counts                |
| GET    | `/analytics/weekly-hours`        | JWT  | Last 7 days of attendance hours  |
| GET    | `/analytics/productivity`        | JWT  | Completed tasks over 14 days     |
| GET    | `/analytics/recent-activity?limit=` | JWT | Recent on-chain events         |

### Logs

| Method | Path                      | Auth | Description                   |
|--------|---------------------------|------|-------------------------------|
| GET    | `/logs?event=&limit=&skip=` | JWT | Raw blockchain event log    |

---

## 7. Mongo utilities

```bash
# Open the DB
mongosh employeeDapp

# Quick counts
mongosh employeeDapp --quiet --eval 'printjson({
  users: db.users.countDocuments(),
  employees: db.employees.countDocuments(),
  logs: db.blockchainLogs.countDocuments()
})'

# Show indexes on users (look for legacy walletAddress_1)
mongosh employeeDapp --quiet --eval 'db.users.getIndexes()'

# Drop a legacy unique index if it's still around
mongosh employeeDapp --quiet --eval 'db.users.dropIndex("walletAddress_1")'

# Reset HR password manually
mongosh employeeDapp --quiet --eval '
  db.users.updateOne(
    { email: "bsailalan@gmail.com" },
    { $set: { mustChangePassword: true } }
  )
'
```

---

## 8. Diagnosing chain-state desync

If you see `missing revert data (action="estimateGas"…)` when acting on an employee, Mongo likely has rows that don't exist on the current contract deployment. Quick check:

```bash
cd backend
node --input-type=module -e "
import 'dotenv/config';
import {readContract} from './config/blockchain.js';
const count = await readContract.employeeCount();
console.log('on-chain employeeCount:', count.toString());
process.exit(0);
"
```

Compare with `db.employees.countDocuments()`. If the chain is lower than Mongo:

- The backend will now **soft-delete** stale rows when HR clicks Deactivate (you'll see "Employee #N marked inactive (chain out of sync)").
- Or re-run migrations and re-seed manually: `cd blockchain && npx truffle migrate --reset` then recreate employees through the UI.

---

## 9. Recovering from a stuck backend

```bash
# Kill any orphan node server.js
lsof -i :3010 -t | xargs -r kill -9

# Start fresh
cd backend && npm start
```

The startup routine now calls `wallet.reset()` automatically, so even if Ganache was restarted while the backend was down, the first write picks up the correct nonce.

---

## 10. Handy frontend checks

```bash
# Type + build check
cd frontend && npx vite build

# Lint
cd frontend && npm run lint
```
