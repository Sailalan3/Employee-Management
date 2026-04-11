import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { endpoints } from "../services/api.js";
import { formatCurrency } from "../utils/format.js";
import { toast } from "../utils/toast.js";

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function Payroll() {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      const [p, e] = await Promise.all([
        endpoints.listPayroll({ period }),
        endpoints.listEmployees(),
      ]);
      setRecords(p.data.records || []);
      setEmployees(e.data.employees || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load");
    }
  };

  useEffect(() => {
    load();
  }, [period]);

  const totals = useMemo(() => {
    return records.reduce(
      (acc, r) => {
        acc.base += r.baseSalary;
        acc.overtime += r.overtimePay;
        acc.bonuses += r.bonuses;
        acc.deductions += r.deductions;
        acc.net += r.netPay;
        return acc;
      },
      { base: 0, overtime: 0, bonuses: 0, deductions: 0, net: 0 }
    );
  }, [records]);

  const byDept = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const emp = employees.find((e) => e.employeeId === r.employeeId);
      const dept = emp?.department || "Unknown";
      map.set(dept, (map.get(dept) || 0) + r.netPay);
    }
    return [...map.entries()].map(([department, netPay]) => ({ department, netPay }));
  }, [records, employees]);

  const setStatus = async (id, status) => {
    try {
      await endpoints.setPayrollStatus(id, status);
      toast.success(`Marked as ${status}`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        subtitle={`Period ${period} · ${records.length} records`}
        actions={
          <>
            <input
              type="month"
              className="input !w-auto"
              value={period}
              onChange={(e) => setPeriod(e.target.value || currentPeriod())}
            />
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              + Add entry
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Base" value={formatCurrency(totals.base)} />
        <Kpi label="Overtime" value={formatCurrency(totals.overtime)} />
        <Kpi label="Bonuses" value={formatCurrency(totals.bonuses)} />
        <Kpi label="Deductions" value={formatCurrency(totals.deductions)} />
        <Kpi label="Net payout" value={formatCurrency(totals.net)} accent />
      </div>

      <div className="glass p-5">
        <div className="kpi-label mb-3">By department</div>
        <div className="h-56">
          {byDept.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="department" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  formatter={(v) => formatCurrency(v)}
                  contentStyle={{
                    background: "rgba(15,15,28,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="netPay" fill="#ec4899" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full grid place-items-center text-slate-500 text-sm">
              No payroll for this period.
            </div>
          )}
        </div>
      </div>

      <div className="glass overflow-hidden">
        {records.length === 0 ? (
          <EmptyState title="No payroll records" hint="Add one to get started." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-right">Base</th>
                <th className="px-4 py-3 text-right">OT ($)</th>
                <th className="px-4 py-3 text-right">Bonus</th>
                <th className="px-4 py-3 text-right">Deduct</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const emp = employees.find((e) => e.employeeId === r.employeeId);
                return (
                  <tr key={r._id} className="table-row">
                    <td className="px-4 py-3">
                      {emp?.name || `#${r.employeeId}`}
                      <div className="text-[11px] text-slate-500">
                        {emp?.department || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(r.baseSalary)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(r.overtimePay)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(r.bonuses)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(r.deductions)}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(r.netPay)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "draft" && (
                        <button
                          className="btn-ghost !py-1 !px-2 text-xs"
                          onClick={() => setStatus(r._id, "approved")}
                        >
                          Approve
                        </button>
                      )}
                      {r.status === "approved" && (
                        <button
                          className="btn-primary !py-1 !px-2 text-xs"
                          onClick={() => setStatus(r._id, "paid")}
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <PayrollModal
          employees={employees}
          defaultPeriod={period}
          onCancel={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

const Kpi = ({ label, value, accent }) => (
  <div className={`glass p-4 ${accent ? "shadow-glow" : ""}`}>
    <div className="kpi-label">{label}</div>
    <div className={`text-xl font-semibold mt-1 ${accent ? "text-white" : "text-slate-200"}`}>
      {value}
    </div>
  </div>
);

function PayrollModal({ employees, defaultPeriod, onCancel, onCreated }) {
  const [form, setForm] = useState({
    employeeId: "",
    period: defaultPeriod,
    baseSalary: 0,
    overtimeHours: 0,
    overtimePay: 0,
    bonuses: 0,
    deductions: 0,
    status: "draft",
  });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.employeeId) {
      toast.error("Pick an employee");
      return;
    }
    try {
      await endpoints.upsertPayroll({
        ...form,
        employeeId: Number(form.employeeId),
      });
      toast.success("Payroll saved");
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="glass-strong w-full max-w-lg p-6 animate-fade-in">
        <h2 className="text-lg font-semibold mb-4">New payroll entry</h2>
        <div className="grid grid-cols-2 gap-3">
          <select className="input col-span-2" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required>
            <option value="">Choose employee…</option>
            {employees.map((emp) => (
              <option key={emp.employeeId} value={emp.employeeId}>
                #{emp.employeeId} · {emp.name || "—"} ({emp.department})
              </option>
            ))}
          </select>
          <input type="month" className="input" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required />
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {["draft", "approved", "paid"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <NumInput label="Base salary" value={form.baseSalary} onChange={(v) => setForm({ ...form, baseSalary: v })} />
          <NumInput label="Overtime hours" value={form.overtimeHours} onChange={(v) => setForm({ ...form, overtimeHours: v })} />
          <NumInput label="Overtime pay" value={form.overtimePay} onChange={(v) => setForm({ ...form, overtimePay: v })} />
          <NumInput label="Bonuses" value={form.bonuses} onChange={(v) => setForm({ ...form, bonuses: v })} />
          <NumInput label="Deductions" value={form.deductions} onChange={(v) => setForm({ ...form, deductions: v })} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}

const NumInput = ({ label, value, onChange }) => (
  <label className="block">
    <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{label}</div>
    <input
      type="number"
      step="any"
      className="input"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  </label>
);
