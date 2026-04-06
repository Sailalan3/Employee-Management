import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import logRoutes from "./routes/logRoutes.js";
import { startEventListener } from "./listeners/employeeEvents.js";
import { seedHrUser } from "./config/seed.js";
import { wallet } from "./config/blockchain.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/employees", employeeRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/projects", projectRoutes);
app.use("/tasks", taskRoutes);
app.use("/payroll", payrollRoutes);
app.use("/leaves", leaveRoutes);
app.use("/reviews", reviewRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/logs", logRoutes);

// Translate common ethers failure shapes into readable messages before the
// response goes out. Frontends get something like "Blockchain timeout — is
// Ganache running?" instead of a raw stack trace.
const friendlyMessage = (err) => {
  const raw =
    err?.info?.error?.message ||
    err?.error?.message ||
    err?.shortMessage ||
    err?.reason ||
    err?.message ||
    "";
  if (err?.code === "TIMEOUT" || /request timeout/i.test(raw)) {
    return "Blockchain request timed out. Is Ganache running at the configured RPC URL?";
  }
  if (err?.code === "NETWORK_ERROR" || /ECONNREFUSED|failed to detect network/i.test(raw)) {
    return "Can't reach the blockchain RPC. Is Ganache running?";
  }
  if (/EmployeeNotFound/i.test(raw)) {
    return "That employee doesn't exist on-chain (stale record from a previous deployment).";
  }
  if (/EmployeeInactive/i.test(raw)) {
    return "That employee is already inactive on-chain.";
  }
  if (/OwnableUnauthorizedAccount/i.test(raw)) {
    return "Backend wallet is not the contract owner. Re-deploy or rotate DEPLOYER_PRIVATE_KEY.";
  }
  if (/insufficient funds/i.test(raw)) {
    return "Backend wallet is out of ETH. Fund it from Ganache.";
  }
  return err.message || "Internal server error";
};

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: friendlyMessage(err) });
});

const PORT = Number(process.env.PORT) || 3010;

const start = async () => {
  await connectDB();
  await seedHrUser();
  // Ganache is ephemeral — if it was restarted while we were down, our cached
  // nonce is stale and the first tx will fail with "transaction underpriced"
  // or "already known". Wipe it so ethers asks Ganache for the current nonce
  // on the next send.
  wallet.reset();
  await startEventListener();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
