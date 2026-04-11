import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { endpoints } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatDate } from "../utils/format.js";
import { toast } from "../utils/toast.js";

export default function Leaves() {
  const { role } = useAuth();
  return role === "hr" ? <HRLeaves /> : <EmployeeLeaves />;
}

// ---------- HR view ----------
// Sees all requests, can approve/reject. Cannot request leave — HR adjudicates,
// HR doesn't take leave through this app.
function HRLeaves() {
  const [tab, setTab] = useState("pending");
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);

  const load = async () => {
    try {
      const [all, emp] = await Promise.all([
        endpoints.listLeaves(),
        endpoints.listEmployees(),
      ]);
      setRecords(all.data.records || []);
      setEmployees(emp.data.employees || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load leaves");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pending = records.filter((r) => r.status === "pending");
  const approved = records.filter((r) => r.status === "approved");
  const rejected = records.filter((r) => r.status === "rejected");

  const decide = async (id, kind) => {
    try {
      const fn = kind === "approve" ? endpoints.approveLeave : endpoints.rejectLeave;
      await fn(id, "");
      toast.success(`Request ${kind}d`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  };

  const visible =
    tab === "pending" ? pending :
    tab === "approved" ? approved :
    tab === "rejected" ? rejected :
    records;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        subtitle={`${pending.length} pending · ${approved.length} approved · ${rejected.length} rejected`}
      />

      <div className="glass p-3 flex items-center gap-1 w-fit">
        {[
          { k: "pending", label: `Pending (${pending.length})` },
          { k: "approved", label: `Approved (${approved.length})` },
          { k: "rejected", label: `Rejected (${rejected.length})` },
          { k: "all", label: `All (${records.length})` },
        ].map((t) => (
          <button
            key={t.k}
            className={`tab ${tab === t.k ? "tab-active" : ""}`}
            onClick={() => setTab(t.k)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass overflow-hidden">
        {visible.length === 0 ? (
          <EmptyState
            title="No leave requests"
            hint={tab === "pending" ? "Nothing to review right now." : "Nothing here yet."}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Dates</th>
                <th className="px-4 py-3 text-right">Days</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const emp = employees.find((e) => e.employeeId === r.employeeId);
                return (
                  <tr key={r._id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="text-white">{emp?.name || `#${r.employeeId}`}</div>
                      {emp?.email && (
                        <div className="text-xs text-slate-500">{emp.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">{r.type}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatDate(r.startDate)} → {formatDate(r.endDate)}
                    </td>
                    <td className="px-4 py-3 text-right">{r.days}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-[280px] truncate">
                      {r.reason || "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn-ghost !py-1 !px-2 text-xs text-emerald-300"
                            onClick={() => decide(r._id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="btn-ghost !py-1 !px-2 text-xs text-red-300"
                            onClick={() => decide(r._id, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- Employee view ----------
// Only sees their own requests. Can request and cancel their own pending.
function EmployeeLeaves() {
  const [records, setRecords] = useState([]);
  const [showRequest, setShowRequest] = useState(false);

  const load = async () => {
    try {
      const me = await endpoints.myLeaves();
      setRecords(me.data.records || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load your leaves");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pending = records.filter((r) => r.status === "pending").length;
  const approved = records.filter((r) => r.status === "approved").length;

  const cancel = async (id) => {
    if (!confirm("Cancel this leave request?")) return;
    try {
      await endpoints.cancelLeave(id);
      toast.success("Request cancelled");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Leave"
        subtitle={`${pending} pending · ${approved} approved`}
        actions={
          <button className="btn-primary" onClick={() => setShowRequest(true)}>
            + Request leave
          </button>
        }
      />

      <div className="glass overflow-hidden">
        {records.length === 0 ? (
          <EmptyState
            title="No leave requests yet"
            hint="Request one above to get started."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Dates</th>
                <th className="px-4 py-3 text-right">Days</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id} className="table-row">
                  <td className="px-4 py-3 capitalize">{r.type}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatDate(r.startDate)} → {formatDate(r.endDate)}
                  </td>
                  <td className="px-4 py-3 text-right">{r.days}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-[280px] truncate">
                    {r.reason || "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "pending" ? (
                      <button
                        className="btn-ghost !py-1 !px-2 text-xs"
                        onClick={() => cancel(r._id)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showRequest && (
        <RequestModal
          onCancel={() => setShowRequest(false)}
          onCreated={async () => {
            setShowRequest(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function RequestModal({ onCancel, onCreated }) {
  const [form, setForm] = useState({
    type: "vacation",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate) return toast.error("Pick dates");
    try {
      await endpoints.requestLeave(form);
      toast.success("Leave requested — HR will review");
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="glass-strong w-full max-w-md p-6 animate-fade-in">
        <h2 className="text-lg font-semibold mb-4">Request leave</h2>
        <div className="space-y-3">
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {["vacation", "sick", "personal", "unpaid", "other"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            <input type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
          </div>
          <textarea className="input" rows="3" placeholder="Reason (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary">Request</button>
        </div>
      </form>
    </div>
  );
}
