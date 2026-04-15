import { ethers } from "ethers";

// Full ABI — enough for the frontend to both read and write via MetaMask.
// When HR signs through MetaMask, calls to createEmployee / updateEmployee /
// deactivateEmployee go straight from the browser to Ganache; the backend
// only gets involved afterwards to mirror the result into Mongo.
export const EMPLOYEE_REGISTRY_ABI = [
  // ---- Reads ----
  "function owner() view returns (address)",
  "function employeeCount() view returns (uint256)",
  "function getEmployee(uint256 employeeId) view returns (tuple(uint256 employeeId, string nameHash, string department, string role, address walletAddress, uint256 createdAt, bool isActive))",

  // ---- Writes (onlyOwner) ----
  "function createEmployee(string nameHash, string department, string role, address walletAddress) returns (uint256)",
  "function updateEmployee(uint256 employeeId, string nameHash, string department, string role, address walletAddress)",
  "function deactivateEmployee(uint256 employeeId)",

  // ---- Events ----
  "event EmployeeCreated(uint256 indexed employeeId, string nameHash, string department, string role, address indexed walletAddress, uint256 createdAt)",
  "event EmployeeUpdated(uint256 indexed employeeId, string nameHash, string department, string role, address indexed walletAddress)",
  "event EmployeeDeleted(uint256 indexed employeeId)",

  // ---- Custom errors ----
  "error EmployeeNotFound(uint256 employeeId)",
  "error EmployeeInactive(uint256 employeeId)",
  "error InvalidWallet()",
  "error OwnableUnauthorizedAccount(address account)",
];

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 5777);
export const NETWORK_NAME = import.meta.env.VITE_NETWORK_NAME || "Ganache Local";
export const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:7545";
export const CHAIN_ID_HEX = "0x" + CHAIN_ID.toString(16);

// Hash a name to match the backend's `hashName` — the on-chain field is
// declared `string` but we feed it a keccak256 hex digest for privacy.
export const keccakName = (name) =>
  ethers.keccak256(ethers.toUtf8Bytes(String(name || "")));

export const getBrowserProvider = () => {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return new ethers.BrowserProvider(window.ethereum);
};

export const getReadContract = (provider) => {
  if (!CONTRACT_ADDRESS) throw new Error("VITE_CONTRACT_ADDRESS not set");
  return new ethers.Contract(CONTRACT_ADDRESS, EMPLOYEE_REGISTRY_ABI, provider);
};

export const getWriteContract = (signer) => {
  if (!CONTRACT_ADDRESS) throw new Error("VITE_CONTRACT_ADDRESS not set");
  return new ethers.Contract(CONTRACT_ADDRESS, EMPLOYEE_REGISTRY_ABI, signer);
};

// Pull the employeeId out of a mined create tx's receipt.
export const parseEmployeeCreatedId = (receipt, iface) => {
  for (const log of receipt.logs || []) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "EmployeeCreated") {
        return Number(parsed.args.employeeId);
      }
    } catch {
      /* not our event */
    }
  }
  return null;
};

// Turn ethers/MetaMask errors into something humans can act on.
export const describeChainError = (err) => {
  if (!err) return "Unknown error";
  // User rejected in MetaMask popup
  if (err.code === 4001 || err.code === "ACTION_REJECTED") {
    return "Transaction rejected in MetaMask.";
  }
  const msg =
    err?.shortMessage ||
    err?.reason ||
    err?.data?.message ||
    err?.info?.error?.message ||
    err?.message ||
    "";
  if (/OwnableUnauthorizedAccount/i.test(msg)) {
    return "This MetaMask account is not the contract owner. Switch to the account that deployed the contract.";
  }
  if (/EmployeeNotFound/i.test(msg)) return "That employee doesn't exist on-chain.";
  if (/EmployeeInactive/i.test(msg)) return "That employee is already inactive.";
  if (/InvalidWallet/i.test(msg)) return "Wallet address is invalid.";
  if (/user rejected|user denied/i.test(msg)) return "Transaction rejected in MetaMask.";
  return msg || "Transaction failed";
};
