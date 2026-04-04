import { ethers } from "ethers";
import {
  contract,
  readContract,
  sendTx,
  provider,
  contractAddress,
} from "../config/blockchain.js";
import Employee from "../models/Employee.js";
import { createEmployeeLogin } from "./authService.js";

const hashName = (name) => ethers.keccak256(ethers.toUtf8Bytes(name));

const parseEmployeeId = (receipt, eventName) => {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === eventName) {
        return Number(parsed.args.employeeId);
      }
    } catch {
      // not one of our events — skip
    }
  }
  return null;
};

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const notFound = (message) => {
  const err = new Error(message);
  err.status = 404;
  return err;
};

export const createEmployee = async ({
  name,
  email,
  department,
  role,
  walletAddress,
  joinDate,
  salary,
  personal,
  education,
  documents,
  loginPassword, // optional — if provided, also provision a user login
}) => {
  if (!name || !email || !department || !role) {
    throw badRequest("name, email, department, and role are required");
  }
  // Wallet is auto-provisioned if HR didn't supply one — employees sign in with
  // email/password, so they never need the private key. The address is just an
  // on-chain identifier for the registry contract.
  let effectiveWallet = walletAddress;
  if (!effectiveWallet) {
    effectiveWallet = ethers.Wallet.createRandom().address;
  } else if (!ethers.isAddress(effectiveWallet)) {
    throw badRequest("walletAddress is not a valid Ethereum address");
  }

  const checksummed = ethers.getAddress(effectiveWallet);

  const tx = await sendTx(() =>
    contract.createEmployee(hashName(name), department, role, checksummed)
  );
  const receipt = await tx.wait();
  const employeeId = parseEmployeeId(receipt, "EmployeeCreated");

  if (employeeId === null) {
    throw new Error("EmployeeCreated event not found in receipt");
  }

  const doc = await Employee.findOneAndUpdate(
    { employeeId },
    {
      $set: {
        employeeId,
        name,
        email,
        department,
        role,
        walletAddress: checksummed.toLowerCase(),
        txHash: tx.hash,
        isActive: true,
        joinDate: joinDate || new Date(),
        salary: Number(salary) || 0,
        ...(personal ? { personal } : {}),
        ...(Array.isArray(education) ? { education } : {}),
        ...(Array.isArray(documents) ? { documents } : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Provision a user login if a password was supplied (HR-driven onboarding)
  let login = null;
  if (loginPassword) {
    try {
      login = await createEmployeeLogin({
        email,
        password: loginPassword,
        employeeId,
      });
    } catch (err) {
      // Don't fail the chain tx if login provisioning fails — surface it instead.
      login = { error: err.message };
    }
  }

  return { employee: doc, txHash: tx.hash, login };
};

export const updateEmployee = async (
  employeeId,
  { name, email, department, role, walletAddress }
) => {
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest("employeeId must be a positive integer");
  }

  const existing = await Employee.findOne({ employeeId: id });
  if (!existing) throw notFound(`Employee ${id} not found`);

  const nextName = name ?? existing.name;
  const nextEmail = email ?? existing.email;
  const nextDepartment = department ?? existing.department;
  const nextRole = role ?? existing.role;
  const nextWallet = walletAddress
    ? ethers.getAddress(walletAddress)
    : ethers.getAddress(existing.walletAddress);

  if (walletAddress && !ethers.isAddress(walletAddress)) {
    throw badRequest("walletAddress is not a valid Ethereum address");
  }

  const tx = await sendTx(() =>
    contract.updateEmployee(
      id,
      hashName(nextName),
      nextDepartment,
      nextRole,
      nextWallet
    )
  );
  await tx.wait();

  const doc = await Employee.findOneAndUpdate(
    { employeeId: id },
    {
      $set: {
        name: nextName,
        email: nextEmail,
        department: nextDepartment,
        role: nextRole,
        walletAddress: nextWallet.toLowerCase(),
        txHash: tx.hash,
      },
    },
    { new: true }
  );

  return { employee: doc, txHash: tx.hash };
};

const isCallException = (err) =>
  err?.code === "CALL_EXCEPTION" ||
  /call_exception|missing revert data|execution reverted/i.test(
    err?.shortMessage || err?.message || ""
  );

// Ganache doesn't always return the custom error name in estimateGas failures,
// so we probe chain state directly to figure out *why* the call would revert.
// Returns one of: "not-found", "inactive", null (unknown / other revert).
const diagnoseEmployeeState = async (id) => {
  try {
    const e = await readContract.getEmployee(id);
    if (!e.isActive) return "inactive";
    return null;
  } catch {
    // getEmployee reverts with EmployeeNotFound — the id isn't on chain at all
    return "not-found";
  }
};

export const deactivateEmployee = async (employeeId) => {
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest("employeeId must be a positive integer");
  }

  const existing = await Employee.findOne({ employeeId: id });
  if (!existing) throw notFound(`Employee ${id} not found`);

  // Happy path: deactivate on-chain, then mirror to Mongo.
  try {
    const tx = await sendTx(() => contract.deactivateEmployee(id));
    await tx.wait();
    const doc = await Employee.findOneAndUpdate(
      { employeeId: id },
      { $set: { isActive: false, txHash: tx.hash } },
      { new: true }
    );
    return { employee: doc, txHash: tx.hash };
  } catch (err) {
    // Stale-state recovery: Mongo has a record the chain doesn't recognise
    // (common after `truffle migrate --reset` or a Ganache wipe). Rather than
    // parsing ethers' error text, we read the chain directly to figure out why
    // the call reverted and fall back to a Mongo-only cleanup when safe.
    if (isCallException(err)) {
      const state = await diagnoseEmployeeState(id);
      if (state === "not-found" || state === "inactive") {
        const doc = await Employee.findOneAndUpdate(
          { employeeId: id },
          { $set: { isActive: false } },
          { new: true }
        );
        return {
          employee: doc,
          txHash: null,
          warning:
            state === "not-found"
              ? "Employee didn't exist on-chain (stale record from a previous deployment). Mirror marked inactive."
              : "Employee was already inactive on-chain. Mirror updated.",
        };
      }
    }
    throw err;
  }
};

export const getEmployeeOnChain = async (employeeId) => {
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest("employeeId must be a positive integer");
  }
  return readContract.getEmployee(id);
};

// -------- MetaMask-driven flow --------
//
// When HR signs the on-chain tx in MetaMask directly (instead of having the
// backend sign with DEPLOYER_PRIVATE_KEY), the frontend submits the tx, waits
// for mining, and then calls these "mirror" endpoints with the resulting
// txHash. We verify the receipt on-chain (so HR can't fabricate rows without
// actually paying gas) and then write the Mongo mirror + provision a login.

const fetchVerifiedReceipt = async (txHash) => {
  if (!txHash || typeof txHash !== "string") {
    throw badRequest("txHash is required");
  }
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    throw badRequest("Transaction not found on-chain (not mined yet?)");
  }
  if (receipt.status !== 1) {
    throw badRequest("Transaction reverted on-chain");
  }
  return receipt;
};

// Scan a receipt's logs for an event emitted by our contract with a matching
// employeeId. Returns the parsed log on match, null otherwise.
const findEventForEmployee = (receipt, eventName, employeeId) => {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
    try {
      const parsed = contract.interface.parseLog(log);
      if (
        parsed?.name === eventName &&
        Number(parsed.args.employeeId) === Number(employeeId)
      ) {
        return parsed;
      }
    } catch {
      /* not one of ours */
    }
  }
  return null;
};

export const mirrorCreate = async ({
  txHash,
  employeeId,
  name,
  email,
  department,
  role,
  walletAddress,
  joinDate,
  salary,
  personal,
  education,
  documents,
  loginPassword,
}) => {
  if (!name || !email || !department || !role) {
    throw badRequest("name, email, department, and role are required");
  }
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    throw badRequest("walletAddress (the one passed to the contract) is required");
  }
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest("employeeId must be a positive integer");
  }

  const receipt = await fetchVerifiedReceipt(txHash);
  const evt = findEventForEmployee(receipt, "EmployeeCreated", id);
  if (!evt) {
    throw badRequest(
      `Transaction ${txHash} did not emit EmployeeCreated(${id}) from ${contractAddress}`
    );
  }

  const checksummed = ethers.getAddress(walletAddress);

  const doc = await Employee.findOneAndUpdate(
    { employeeId: id },
    {
      $set: {
        employeeId: id,
        name,
        email,
        department,
        role,
        walletAddress: checksummed.toLowerCase(),
        txHash,
        isActive: true,
        joinDate: joinDate || new Date(),
        salary: Number(salary) || 0,
        ...(personal ? { personal } : {}),
        ...(Array.isArray(education) ? { education } : {}),
        ...(Array.isArray(documents) ? { documents } : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let login = null;
  if (loginPassword) {
    try {
      login = await createEmployeeLogin({
        email,
        password: loginPassword,
        employeeId: id,
      });
    } catch (err) {
      login = { error: err.message };
    }
  }

  return { employee: doc, txHash, login };
};

export const mirrorDeactivate = async ({ employeeId, txHash }) => {
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest("employeeId must be a positive integer");
  }
  const receipt = await fetchVerifiedReceipt(txHash);
  const evt = findEventForEmployee(receipt, "EmployeeDeleted", id);
  if (!evt) {
    throw badRequest(
      `Transaction ${txHash} did not emit EmployeeDeleted(${id}) from ${contractAddress}`
    );
  }

  const doc = await Employee.findOneAndUpdate(
    { employeeId: id },
    { $set: { isActive: false, txHash } },
    { new: true }
  );
  if (!doc) throw notFound(`Employee ${id} not found`);
  return { employee: doc, txHash };
};

export const mirrorUpdate = async ({
  txHash,
  employeeId,
  name,
  email,
  department,
  role,
  walletAddress,
}) => {
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest("employeeId must be a positive integer");
  }
  const receipt = await fetchVerifiedReceipt(txHash);
  const evt = findEventForEmployee(receipt, "EmployeeUpdated", id);
  if (!evt) {
    throw badRequest(
      `Transaction ${txHash} did not emit EmployeeUpdated(${id}) from ${contractAddress}`
    );
  }

  const existing = await Employee.findOne({ employeeId: id });
  if (!existing) throw notFound(`Employee ${id} not found`);

  const doc = await Employee.findOneAndUpdate(
    { employeeId: id },
    {
      $set: {
        name: name ?? existing.name,
        email: email ?? existing.email,
        department: department ?? existing.department,
        role: role ?? existing.role,
        walletAddress: walletAddress
          ? ethers.getAddress(walletAddress).toLowerCase()
          : existing.walletAddress,
        txHash,
      },
    },
    { new: true }
  );
  return { employee: doc, txHash };
};

// Expose the contract owner address so the frontend can warn HR when their
// connected MetaMask account won't be able to sign writes.
export const getContractOwner = async () => {
  try {
    return await readContract.owner();
  } catch (err) {
    // If the ABI we have locally doesn't include owner() for some reason
    return null;
  }
};
