import { useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  CONTRACT_ADDRESS,
  CHAIN_ID,
  NETWORK_NAME,
} from "../blockchain/contract.js";
import { shortAddress } from "../utils/format.js";
import { toast } from "../utils/toast.js";
import { endpoints } from "../services/api.js";

export default function Settings() {
  const { user, role, logout, setUser, mustChangePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const copy = (v) => {
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    if (next.length < 6) return toast.error("New password must be at least 6 characters");
    if (next !== confirm) return toast.error("Passwords do not match");
    try {
      setSaving(true);
      const { data } = await endpoints.changePassword(current, next);
      setUser(data.user);
      toast.success("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Account and workspace information" />

      {mustChangePassword && (
        <div className="glass p-4 border border-amber-500/30 bg-amber-500/10 text-amber-100 text-sm">
          You're using a temporary password issued by HR. Please set a new one below.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass p-5">
          <div className="kpi-label mb-3">Account</div>
          <Row label="Email" value={user?.email || "—"} />
          <Row label="Role" value={role === "hr" ? "HR" : "Employee"} />
          {user?.employeeId != null && (
            <Row label="Employee ID" value={`#${user.employeeId}`} />
          )}
          <Row
            label="Action"
            action={
              <button className="btn-danger !py-1" onClick={logout}>
                Sign out
              </button>
            }
          />
        </div>

        <div className="glass p-5">
          <div className="kpi-label mb-3">Change password</div>
          <form onSubmit={onChangePassword} className="space-y-3">
            {!mustChangePassword && (
              <Field
                label="Current password"
                type="password"
                value={current}
                onChange={setCurrent}
                autoComplete="current-password"
                required
              />
            )}
            <Field
              label="New password"
              type="password"
              value={next}
              onChange={setNext}
              autoComplete="new-password"
              required
            />
            <Field
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full"
            >
              {saving ? "Saving…" : "Update password"}
            </button>
          </form>
        </div>

        <div className="glass p-5 md:col-span-2">
          <div className="kpi-label mb-3">Blockchain</div>
          <Row label="Network" value={NETWORK_NAME} />
          <Row label="Chain ID" value={CHAIN_ID} />
          <Row
            label="Contract"
            value={shortAddress(CONTRACT_ADDRESS)}
            action={
              <button className="btn-ghost !py-1" onClick={() => copy(CONTRACT_ADDRESS)}>
                Copy full
              </button>
            }
          />
          <Row label="API base" value={import.meta.env.VITE_API_URL || "—"} />
        </div>
      </div>

      <div className="glass p-5 text-xs text-slate-500 leading-relaxed">
        <div className="kpi-label mb-2">About</div>
        Employee Dashboard — workforce management with a Solidity registry on
        Ganache mirrored into MongoDB. HR creates employee accounts and issues
        initial credentials; employees can change their password from this page.
      </div>
    </div>
  );
}

const Row = ({ label, value, action }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
    <span className="text-sm text-slate-400">{label}</span>
    <span className="text-sm text-white font-mono">{value}</span>
    {action && <div className="ml-3">{action}</div>}
  </div>
);

const Field = ({ label, value, onChange, ...rest }) => (
  <label className="block">
    <span className="text-xs uppercase tracking-wider text-slate-400">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
      className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-neon-violet focus:ring-2 focus:ring-neon-violet/30"
    />
  </label>
);
