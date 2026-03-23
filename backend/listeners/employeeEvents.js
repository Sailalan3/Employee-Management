import { provider, readContract } from "../config/blockchain.js";
import BlockchainLog from "../models/BlockchainLog.js";
import Employee from "../models/Employee.js";

const recordLog = async (eventName, log, payload) => {
  try {
    await BlockchainLog.create({
      eventName,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.index ?? log.logIndex,
      payload,
      timestamp: new Date(),
    });
  } catch (err) {
    if (err?.code !== 11000) {
      console.error(`[listener] failed to record ${eventName} log`, err);
    }
  }
};

// Wraps a handler so a thrown error (Mongo hiccup, bad payload, etc.) never
// propagates back to ethers and kills the subscription.
const safeHandler = (eventName, fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (err) {
    console.error(`[listener] ${eventName} handler error:`, err);
  }
};

const onEmployeeCreated = safeHandler(
  "EmployeeCreated",
  async (employeeId, nameHash, department, role, walletAddress, createdAt, event) => {
    const id = Number(employeeId);
    const payload = {
      employeeId: id,
      nameHash,
      department,
      role,
      walletAddress: walletAddress.toLowerCase(),
      createdAt: Number(createdAt),
    };

    await recordLog("EmployeeCreated", event.log, payload);

    await Employee.findOneAndUpdate(
      { employeeId: id },
      {
        $setOnInsert: {
          employeeId: id,
          department,
          role,
          walletAddress: walletAddress.toLowerCase(),
          isActive: true,
        },
        $set: { txHash: event.log.transactionHash },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    console.log(`[listener] EmployeeCreated id=${id} tx=${event.log.transactionHash}`);
  }
);

const onEmployeeUpdated = safeHandler(
  "EmployeeUpdated",
  async (employeeId, nameHash, department, role, walletAddress, event) => {
    const id = Number(employeeId);
    const payload = {
      employeeId: id,
      nameHash,
      department,
      role,
      walletAddress: walletAddress.toLowerCase(),
    };

    await recordLog("EmployeeUpdated", event.log, payload);

    await Employee.findOneAndUpdate(
      { employeeId: id },
      {
        $set: {
          department,
          role,
          walletAddress: walletAddress.toLowerCase(),
          txHash: event.log.transactionHash,
        },
      }
    );

    console.log(`[listener] EmployeeUpdated id=${id} tx=${event.log.transactionHash}`);
  }
);

const onEmployeeDeleted = safeHandler(
  "EmployeeDeleted",
  async (employeeId, event) => {
    const id = Number(employeeId);
    await recordLog("EmployeeDeleted", event.log, { employeeId: id });

    await Employee.findOneAndUpdate(
      { employeeId: id },
      { $set: { isActive: false, txHash: event.log.transactionHash } }
    );

    console.log(`[listener] EmployeeDeleted id=${id} tx=${event.log.transactionHash}`);
  }
);

export const startEventListener = async () => {
  readContract.on("EmployeeCreated", onEmployeeCreated);
  readContract.on("EmployeeUpdated", onEmployeeUpdated);
  readContract.on("EmployeeDeleted", onEmployeeDeleted);

  // Surface transport-level errors so the listener dying isn't silent.
  provider.on("error", (err) => {
    console.error("[listener] provider error:", err?.message || err);
  });

  // Also catch any unhandled rejection so a single bad event doesn't crash the process.
  process.on("unhandledRejection", (reason) => {
    console.error("[listener] unhandledRejection:", reason);
  });

  console.log("[listener] subscribed to EmployeeRegistry events");
};

export const stopEventListener = async () => {
  await readContract.removeAllListeners();
};
