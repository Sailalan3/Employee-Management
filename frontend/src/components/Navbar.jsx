import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useWallet } from "../context/WalletContext.jsx";
import { endpoints } from "../services/api.js";
import Avatar from "./Avatar.jsx";

// Shown next to each event. The backend stamps `type` as the Solidity event name.
const EVENT_EMOJI = {
  EmployeeCreated: "👤",
  EmployeeUpdated: "✏️",
  EmployeeDeactivated: "🚫",
};

const timeAgo = (iso) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const shortAddr = (addr) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

export default function Navbar() {
  const { user, role, logout } = useAuth();
  const {
    hasMetaMask,
    account,
    onRightChain,
    isOwner,
    connecting,
    connect,
  } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [lastSeen, setLastSeen] = useState(() =>
    Number(localStorage.getItem("notif:lastSeen") || 0)
  );
  const notifRef = useRef(null);

  // Poll recent activity every 30s so the bell badge stays roughly fresh.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingActivity(true);
        const { data } = await endpoints.recentActivity(8);
        if (!cancelled) setActivity(Array.isArray(data) ? data : data?.items || []);
      } catch {
        // silent — activity is non-critical
      } finally {
        if (!cancelled) setLoadingActivity(false);
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Close the notifications dropdown when clicking outside
  useEffect(() => {
    if (!notifOpen) return;
    const onClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [notifOpen]);

  const unreadCount = activity.filter(
    (a) => new Date(a.createdAt || a.timestamp || 0).getTime() > lastSeen
  ).length;

  const openNotif = () => {
    setNotifOpen((v) => {
      const next = !v;
      if (next) {
        const now = Date.now();
        localStorage.setItem("notif:lastSeen", String(now));
        setLastSeen(now);
      }
      return next;
    });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-900/70 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="lg:hidden h-8 w-8 rounded-lg bg-grad-neon grid place-items-center font-bold text-white text-sm">
            E
          </div>
          <div className="chip border-white/10 text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
            {role === "hr" ? "HR" : "Employee"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connect Wallet — HR-only; writes (create/update/deactivate)
              now go through MetaMask so HR must confirm every on-chain tx. */}
          {role === "hr" && (
            <>
              {!hasMetaMask ? (
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost !py-1.5 text-xs"
                  title="Install MetaMask to sign on-chain transactions"
                >
                  🦊 Install MetaMask
                </a>
              ) : !account ? (
                <button
                  onClick={connect}
                  disabled={connecting}
                  className="btn-primary !py-1.5 text-xs"
                >
                  {connecting ? "Connecting…" : "🦊 Connect Wallet"}
                </button>
              ) : (
                <div
                  className="chip border-white/10 text-slate-300 gap-2"
                  title={
                    !onRightChain
                      ? "Wrong network — click to switch"
                      : isOwner
                        ? "Connected as contract owner ✓"
                        : "Connected, but not the contract owner"
                  }
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      !onRightChain
                        ? "bg-amber-400"
                        : isOwner
                          ? "bg-emerald-400 animate-pulse-glow"
                          : "bg-red-400"
                    }`}
                  />
                  <span className="font-mono">{shortAddr(account)}</span>
                  {!onRightChain && (
                    <button
                      onClick={connect}
                      className="text-[10px] underline text-amber-300"
                    >
                      switch
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          <div className="relative" ref={notifRef}>
            <button
              onClick={openNotif}
              className="btn-ghost !px-2 !py-1.5"
              title="Notifications"
            >
              <span className="relative">
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 min-w-[16px] h-4 px-1 rounded-full bg-pink-500 text-[10px] font-semibold text-white grid place-items-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 glass-strong animate-fade-in overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="text-sm font-semibold text-white">
                    Recent activity
                  </div>
                  <div className="text-[11px] text-slate-500">
                    On-chain events · last 8
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {loadingActivity && activity.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-400 text-center">
                      Loading…
                    </div>
                  ) : activity.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-400 text-center">
                      No activity yet
                    </div>
                  ) : (
                    activity.map((a, i) => (
                      <div
                        key={a._id || a.txHash || i}
                        className="flex gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5"
                      >
                        <div className="text-lg leading-none pt-0.5">
                          {EVENT_EMOJI[a.type] || "⛓"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white truncate">
                            {a.type || "Event"}
                            {a.employeeId ? ` · #${a.employeeId}` : ""}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {timeAgo(a.createdAt || a.timestamp)}
                            {a.txHash ? ` · ${a.txHash.slice(0, 10)}…` : ""}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="btn-ghost !px-2 !py-1 flex items-center gap-2"
              title={user?.email || ""}
            >
              <Avatar address={user?.email || "user"} size={24} />
              <span className="text-xs max-w-[160px] truncate">
                {user?.email || "—"}
              </span>
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-44 glass-strong animate-fade-in overflow-hidden"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                  {role === "hr" ? "HR account" : "Employee account"}
                </div>
                <button
                  onClick={logout}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 text-red-300"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
