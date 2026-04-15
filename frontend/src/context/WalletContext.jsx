import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ethers } from "ethers";
import {
  CHAIN_ID,
  CHAIN_ID_HEX,
  CONTRACT_ADDRESS,
  NETWORK_NAME,
  RPC_URL,
  EMPLOYEE_REGISTRY_ABI,
  getBrowserProvider,
  getReadContract,
} from "../blockchain/contract.js";

// Exposes MetaMask state (connected account, chain, whether it's the contract
// owner) plus a helper that returns a write-enabled contract bound to the
// current signer. Use `getWriteContract()` at the moment of submitting a tx
// — it will ensure the correct chain first and pop the MetaMask confirmation.
const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const hasMetaMask =
    typeof window !== "undefined" && typeof window.ethereum !== "undefined";

  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [ownerAddress, setOwnerAddress] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const refreshOwner = useCallback(async () => {
    if (!CONTRACT_ADDRESS) return;
    try {
      // Use a browser provider if MetaMask is installed so we stay on the
      // same chain the user is currently looking at; otherwise fall back
      // to the configured JSON-RPC URL.
      const provider = hasMetaMask
        ? new ethers.BrowserProvider(window.ethereum)
        : new ethers.JsonRpcProvider(RPC_URL);
      const read = new ethers.Contract(
        CONTRACT_ADDRESS,
        EMPLOYEE_REGISTRY_ABI,
        provider
      );
      const ow = await read.owner();
      setOwnerAddress(ethers.getAddress(ow));
    } catch {
      setOwnerAddress(null);
    }
  }, [hasMetaMask]);

  const readState = useCallback(async () => {
    if (!hasMetaMask) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accs = await window.ethereum.request({ method: "eth_accounts" });
      setAccount(accs?.[0] ? ethers.getAddress(accs[0]) : null);
      const net = await provider.getNetwork();
      setChainId(Number(net.chainId));
    } catch {
      /* ignore */
    }
  }, [hasMetaMask]);

  // Ensure MetaMask is pointed at the project's chain. Add the network if the
  // user has never seen it before (4902 = unrecognized chain).
  const ensureChain = useCallback(async () => {
    if (!hasMetaMask) throw new Error("MetaMask is not installed");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const net = await provider.getNetwork();
    if (Number(net.chainId) === CHAIN_ID) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }],
      });
    } catch (err) {
      if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message || "")) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CHAIN_ID_HEX,
              chainName: NETWORK_NAME,
              rpcUrls: [RPC_URL],
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            },
          ],
        });
      } else {
        throw err;
      }
    }
  }, [hasMetaMask]);

  const connect = useCallback(async () => {
    if (!hasMetaMask) {
      setError("MetaMask is not installed. Install it from https://metamask.io");
      return { ok: false };
    }
    setConnecting(true);
    setError(null);
    try {
      await ensureChain();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accs = await provider.send("eth_requestAccounts", []);
      setAccount(accs[0] ? ethers.getAddress(accs[0]) : null);
      const net = await provider.getNetwork();
      setChainId(Number(net.chainId));
      await refreshOwner();
      return { ok: true };
    } catch (e) {
      const msg = e?.shortMessage || e?.message || "Failed to connect MetaMask";
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setConnecting(false);
    }
  }, [hasMetaMask, ensureChain, refreshOwner]);

  // Soft "disconnect" — we can't revoke permissions from the dapp side,
  // but we can forget our local cache. The user can fully disconnect from
  // MetaMask itself if they want.
  const disconnect = useCallback(() => setAccount(null), []);

  // Returns a contract bound to the current MetaMask signer. Call this right
  // before submitting a tx — it makes sure the user is on the correct chain,
  // then returns a contract instance whose writes will pop the confirmation.
  const getWriteContract = useCallback(async () => {
    if (!hasMetaMask) throw new Error("MetaMask is not installed");
    if (!CONTRACT_ADDRESS) throw new Error("VITE_CONTRACT_ADDRESS not set");
    await ensureChain();
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, EMPLOYEE_REGISTRY_ABI, signer);
  }, [hasMetaMask, ensureChain]);

  // Wire up MetaMask event listeners once.
  useEffect(() => {
    if (!hasMetaMask) return;
    readState();
    refreshOwner();
    const onAccounts = (accs) => {
      setAccount(accs?.[0] ? ethers.getAddress(accs[0]) : null);
    };
    const onChain = (cidHex) => {
      setChainId(parseInt(cidHex, 16));
      // owner() must be read from the current chain, refresh when it flips.
      refreshOwner();
    };
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [hasMetaMask, readState, refreshOwner]);

  const isOwner = useMemo(() => {
    if (!account || !ownerAddress) return false;
    return account.toLowerCase() === ownerAddress.toLowerCase();
  }, [account, ownerAddress]);

  const onRightChain = chainId === CHAIN_ID;

  const value = {
    hasMetaMask,
    account,
    chainId,
    onRightChain,
    ownerAddress,
    isOwner,
    connecting,
    error,
    connect,
    disconnect,
    ensureChain,
    getWriteContract,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within <WalletProvider>");
  }
  return ctx;
};
