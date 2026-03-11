import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadArtifact = () => {
  const relPath =
    process.env.CONTRACT_ARTIFACT_PATH ||
    "../../blockchain/build/contracts/EmployeeRegistry.json";
  const absPath = path.resolve(__dirname, relPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(
      `Contract artifact not found at ${absPath}. Run \`truffle migrate\` in blockchain/ first.`
    );
  }

  return JSON.parse(fs.readFileSync(absPath, "utf8"));
};

const resolveContractAddress = (artifact) => {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;

  const chainId = process.env.GANACHE_CHAIN_ID || "1337";
  const network = artifact.networks?.[chainId];
  if (!network?.address) {
    throw new Error(
      `No deployed address for chain ${chainId} in artifact. Set CONTRACT_ADDRESS or re-run migrations.`
    );
  }
  return network.address;
};

const artifact = loadArtifact();
const rpcUrl = process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545";

// Wrap the URL in a FetchRequest so we can bump the HTTP timeout. Ganache is
// usually <1s but large payloads (e.g. documents-in-memo) or mining hiccups
// can push a single RPC call past the 5s ethers default. 60s is safe.
const fetchReq = new ethers.FetchRequest(rpcUrl);
fetchReq.timeout = Number(process.env.RPC_TIMEOUT_MS) || 60_000;

export const provider = new ethers.JsonRpcProvider(fetchReq);
provider.pollingInterval = Number(process.env.POLL_INTERVAL_MS) || 250;

if (!process.env.DEPLOYER_PRIVATE_KEY) {
  throw new Error("DEPLOYER_PRIVATE_KEY is required in .env");
}

const baseWallet = new ethers.Wallet(
  process.env.DEPLOYER_PRIVATE_KEY,
  provider
);

export const wallet = new ethers.NonceManager(baseWallet);

export const contractAddress = resolveContractAddress(artifact);

export const contract = new ethers.Contract(
  contractAddress,
  artifact.abi,
  wallet
);

export const readContract = new ethers.Contract(
  contractAddress,
  artifact.abi,
  provider
);

// Any error that suggests our cached nonce is out of sync with Ganache's tx
// pool — includes "transaction underpriced" (replacement same-nonce tx too
// cheap), "already known", "replacement transaction underpriced", and plain
// "nonce too low/high". All fixed the same way: wipe the NonceManager cache
// and retry once.
const isNonceDesyncError = (err) => {
  const msg =
    err?.info?.error?.message ||
    err?.error?.message ||
    err?.shortMessage ||
    err?.message ||
    "";
  return /nonce|underpriced|already known|replacement/i.test(msg);
};

export const sendTx = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    if (!isNonceDesyncError(err)) throw err;
    wallet.reset();
    return await fn();
  }
};
