# Commands Reference

Every command you need to run, test, debug, and ship this project. Copy-paste ready.

---

## 1. One-time setup

```bash
# From the repo root:

# 1) Blockchain (Truffle + Ganache)
cd blockchain
npm install
cp .env.example .env                 # paste DEPLOYER_PRIVATE_KEY
# Start Ganache UI/CLI on http://127.0.0.1:7545 with chain id 1337 first, then:
npx truffle migrate --reset

# 2) Backend
cd ../backend
npm install
cp .env.example .env                 # edit: DEPLOYER_PRIVATE_KEY, CONTRACT_ADDRESS, JWT_SECRET

# 3) Frontend
cd ../frontend
npm install
cp .env.example .env                 # edit: VITE_CONTRACT_ADDRESS (same as backend)
```

### Required `.env` files

#### `backend/.env`

```env
PORT=3010

# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/employeeDapp

# Blockchain
GANACHE_RPC_URL=http://127.0.0.1:7545
GANACHE_CHAIN_ID=1337
DEPLOYER_PRIVATE_KEY=0x<paste_from_ganache>
CONTRACT_ADDRESS=0x<paste_after_migrate>
CONTRACT_ARTIFACT_PATH=../../blockchain/build/contracts/EmployeeRegistry.json

# Auth — generate with `openssl rand -hex 32`
JWT_SECRET=<long_random_string>
JWT_EXPIRES_IN=7d
NONCE_TTL_SECONDS=300
```

#### `frontend/.env`

```env
VITE_API_URL=http://localhost:3010
# IMPORTANT: 1337 (EIP-155 chainId) — what MetaMask sees.
# The backend's GANACHE_CHAIN_ID stays 5777 because that's how Truffle
# indexes its artifact. The browser always uses 1337.
VITE_CHAIN_ID=1337
VITE_NETWORK_NAME=Ganache Local
VITE_CONTRACT_ADDRESS=0x<same_as_backend>
VITE_DESIGN_API_KEY=
```

#### `blockchain/.env`

```env
GANACHE_RPC_URL=http://127.0.0.1:7545
GANACHE_CHAIN_ID=1337
DEPLOYER_PRIVATE_KEY=0x<same_as_backend>
```

---

## 2. Run the stack (dev)

```bash
# Terminal 1 — Ganache UI/CLI on :7545

# Terminal 2 — Backend
cd backend && npm start              # http://localhost:3010

# Terminal 3 — Frontend
cd frontend && npm run dev           # http://localhost:5173
```

### Health checks

```bash
curl -s http://localhost:3010/health
# → {"ok":true}

curl -s http://localhost:3010/employees/owner
# → {"address":"0x..."}    (the contract owner)
```

---

## 3. MetaMask setup

1. Install the MetaMask extension if you haven't.
2. **Add network**:
   - Network name: `Ganache Local`
   - RPC URL: `http://127.0.0.1:7545`
   - Chain ID: `1337`
   - Currency symbol: `ETH`
3. **Import account** using the private key from Ganache (the same account
   you put in `DEPLOYER_PRIVATE_KEY`). This account must be the contract
   owner.
4. In the app, click **Connect Wallet** in the navbar (HR-only). The dot
   next to the address tells you the state:
   - 🟢 **green** — connected, on chain 1337, address matches contract owner
   - 🟡 **amber** — connected but on the wrong chain (auto-switch will run)
   - 🔴 **red** — connected but not the contract owner (writes will revert)

---

## 4. Login

```bash
# Default seeded HR (override via HR_SEED_EMAIL / HR_SEED_PASSWORD)
EMAIL=bsailalan@gmail.com
PASS='Sailalan@2003'

curl -s -X POST http://localhost:3010/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
# → {"token":"eyJ...","user":{"id":"...","email":"...","role":"hr",...}}

# Save the token for subsequent calls
TOKEN=$(curl -s -X POST http://localhost:3010/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | jq -r .token)
```

### Change password (first-login flow)

```bash
curl -s -X POST http://localhost:3010/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"newPassword":"NewSecurePassword!23"}'
# `currentPassword` is required UNLESS the user has mustChangePassword=true
```

---

## 5. Employees

### List + read

```bash
# All
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/employees

# By id
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/employees/1

# Filter
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/employees/department/Engineering
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/employees/role/Engineer
```

### Create — backend-signed (no MetaMask)

```bash
curl -s -X POST http://localhost:3010/employees/create \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Asha Pillai",
    "email":"asha@example.com",
    "role":"Engineer",
    "department":"Engineering",
    "loginPassword":"Welcome@123"
  }'
```

### Create — MetaMask path (mirror)

The frontend handles this end-to-end. From a script (rare):

```bash
# 1. From the browser console, after MetaMask signs:
#    txHash = (await contract.createEmployee(...)).hash
#    receipt = await provider.waitForTransaction(txHash)
#    employeeId = parseEmployeeCreatedId(receipt)

# 2. POST to /employees/mirror with the verified data:
curl -s -X POST http://localhost:3010/employees/mirror \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "txHash":"0x...",
    "employeeId":42,
    "name":"Asha Pillai",
    "email":"asha@example.com",
    "role":"Engineer",
    "department":"Engineering",
    "wallet":"0x...",
    "loginPassword":"Welcome@123"
  }'
```

The backend re-fetches the receipt, asserts the `EmployeeCreated` event was
emitted from `CONTRACT_ADDRESS`, then writes Mongo.

### Deactivate

```bash
# Backend-signed
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:3010/employees/42

# MetaMask path (after frontend builds the tx and gets receipt)
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3010/employees/mirror/42?txHash=0x..."
```

---

## 6. Attendance

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3010/attendance/clock-in
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3010/attendance/break/start
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3010/attendance/break/end
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3010/attendance/clock-out

# Today's status
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/attendance/me

# Personal history
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/attendance/me/history

# HR — team-wide list (date filters)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3010/attendance?date=2026-04-28"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3010/attendance?from=2026-04-01&to=2026-04-28"
```

---

## 7. Leaves

```bash
# Employee — request
curl -s -X POST http://localhost:3010/leaves \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"type":"vacation","startDate":"2026-05-01","endDate":"2026-05-05","reason":"family trip"}'

# Employee — own list
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/leaves/me

# HR — all
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/leaves

# HR — approve / reject
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3010/leaves/<id>/approve
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3010/leaves/<id>/reject

# Employee — cancel own pending
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3010/leaves/<id>/cancel
```

---

## 8. Tasks, Projects, Payroll, Reviews, Analytics, Logs

```bash
# Tasks
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/tasks
curl -s -X POST http://localhost:3010/tasks \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Wire MetaMask","projectId":"...","assigneeId":42,"priority":"high"}'

# Projects
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/projects

# Payroll
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/payroll
curl -s -X POST http://localhost:3010/payroll/run \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"period":"2026-04","employeeId":42,"gross":5000,"deductions":500}'

# Reviews
curl -s -X POST http://localhost:3010/reviews \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"employeeId":42,"period":"2026-Q1","rating":4,"notes":"Great work"}'

# Analytics — dashboard summary
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/analytics/summary
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/analytics/by-department
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/analytics/weekly-hours
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/analytics/recent-activity

# Blockchain logs
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/logs
```

---

## 9. Smart contract (Truffle)

```bash
cd blockchain

# Compile
npx truffle compile

# Migrate (use --reset to redeploy from scratch)
npx truffle migrate --reset --network development

# Tests
npx truffle test

# Open a console connected to Ganache
npx truffle console --network development
> EmployeeRegistry.deployed().then(i => i.owner()).then(console.log)
```

**Pin the address** in `backend/.env` after a fresh migrate so the backend
doesn't drift:

```bash
# After `truffle migrate --reset`, copy the address from the output:
grep -A1 'EmployeeRegistry' build/contracts/EmployeeRegistry.json | head -5
# → set CONTRACT_ADDRESS=0x... in both backend/.env and frontend/.env
```

---

## 10. Database (Mongo)

```bash
# Connect with mongosh
mongosh mongodb://127.0.0.1:27017/employeeDapp

# Common queries
> db.employees.countDocuments()
> db.employees.find({ active: true }).limit(5).pretty()
> db.users.findOne({ email: "bsailalan@gmail.com" }, { passwordHash: 0 })
> db.blockchainLogs.find().sort({ blockNumber: -1 }).limit(5)
> db.attendances.find({ date: "2026-04-28" })
```

### Reset the database (dangerous)

```bash
mongosh mongodb://127.0.0.1:27017/employeeDapp --eval 'db.dropDatabase()'
# Backend reseeds the HR account on the next start.
```

---

## 11. Git & GitHub workflow

```bash
# Status & diff
git status -s
git diff --stat
git log --oneline -10

# Branches
git branch -a
git checkout main          # default
git checkout master        # release line

# Tags & releases
git tag -l                 # list local tags
git fetch --tags           # pull tags from origin
git checkout v1.0.0        # check out the v1.0 release

# View a release on GitHub
gh release view v1.0.0 --repo Sailalan3/Employee-Management
gh release list --repo Sailalan3/Employee-Management
```

### Cut a new release

```bash
# 1. Make sure master is at the commit you want to release
git checkout master
git log -1

# 2. Tag it
git tag -a v1.1.0 -m "v1.1.0 — short description"
git push origin v1.1.0

# 3. Create the GitHub Release page
gh release create v1.1.0 \
  --repo Sailalan3/Employee-Management \
  --title "v1.1.0" \
  --notes-file CHANGELOG.md
```

---

## 12. Troubleshooting

### Backend hangs at `node server.js` with no output

Stale or corrupted `node_modules`:

```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm start
```

### `EADDRINUSE: address already in use :::3010`

A previous backend is still alive:

```bash
lsof -i :3010 -t | xargs kill -9
cd backend && npm start
```

### MetaMask says "Could not add network — same RPC for chain 0x539"

Wrong chain ID in `frontend/.env`. Set `VITE_CHAIN_ID=1337`. Restart Vite.

### "Backend wallet is not the contract owner"

The wallet that signed the tx isn't the contract owner. Check MetaMask is on
the deployer account, or re-deploy the contract with the wallet you intend
to use.

### Mongo employee row is stale (refers to an employeeId that's not on-chain)

This happens after `truffle migrate --reset` without rebuilding Mongo. The
deactivate path will fall back to a Mongo-only soft delete with a warning.
To force a clean state:

```bash
mongosh mongodb://127.0.0.1:27017/employeeDapp --eval 'db.employees.deleteMany({})'
```

### Vite port in use

```bash
lsof -i :5173 -t | xargs kill -9
cd frontend && npm run dev
```

---

## 13. 3-minute demo voice-over

Use this when recording the 6-clip walkthrough.

| Clip          | Topic                                    | ~30 s of voice                                                                                                                                                                                                                                                       |
|---------------|------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 (1:10:42 AM)| Opening / HR login / dashboard           | "This is a hybrid Web3 employee management platform. The Ethereum smart contract is the source of truth for employee identity, MongoDB stores the rich profile data, and the React dashboard scopes access by role. I'm logging in as HR with email and password — the same account that owns the contract." |
| 2 (1:44:00 AM)| Connect wallet + register with MetaMask  | "First, I connect my MetaMask wallet — the green dot confirms my address matches the contract owner on Ganache. Now I register a new employee through the wizard. When I hit Create, MetaMask asks me to sign the transaction. Until I confirm here, nothing is written. The backend waits for the receipt, parses the EmployeeCreated event, and only then mirrors to MongoDB." |
| 3 (1:46:59 AM)| Employee logs in + clocks in             | "I sign out and log back in as the employee I just created. The system forces a password change on first login. Once inside, the employee sees a scoped dashboard. I clock in from the attendance page; the status flips to Working." |
| 4 (1:54:03 AM)| Leave request → HR approves              | "Still as the employee, I open the Leaves page and request time off. There's no approve button here — the role gate is enforced both server-side and in the UI. I sign back in as HR, see the pending request, and approve. The employee's view updates instantly." |
| 5 (2:01:50 AM)| Tasks, projects, payroll, reviews        | "The same role-aware pattern runs through the rest of the platform. Tasks live in a kanban. Projects track team members. Payroll handles monthly runs. Reviews are 360-style. Every action is filtered by who's logged in." |
| 6 (2:04:22 AM)| Blockchain activity / closing            | "Here's the audit trail. Every privileged write lands on the Blockchain Activity page with the transaction hash, block number, and parsed event. Clicking a hash opens it in Ganache. If MongoDB ever drifts, the chain is the source of recovery. That's the project — MongoDB for query speed, Ethereum for trust, MetaMask in the loop for every privileged write." |

---

## 14. Useful one-liners

```bash
# Watch all backend logs
tail -f /var/log/employee-dapp.log    # if you redirect

# Count commits per branch
git log master --oneline | wc -l
git log main --oneline | wc -l

# Compare master vs main
git log master..main --oneline | head -20

# Find any leftover .claude / AI artifacts
find . -maxdepth 5 \( -name '.claude' -o -name '.cursor' -o -name 'CLAUDE.md' \) -not -path '*/node_modules/*'

# Verify no .env files are tracked
git ls-files | grep -E '(^|/)\.env$' || echo "✓ no .env tracked"
```
