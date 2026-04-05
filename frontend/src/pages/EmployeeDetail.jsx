import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Avatar from "../components/Avatar.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { endpoints } from "../services/api.js";
import { formatDate, shortAddress } from "../utils/format.js";
import { toast } from "../utils/toast.js";

// "Glowing Tabs" inspired by IMG_6350
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "reviews", label: "Reviews" },
  { key: "payroll", label: "Payroll" },
];

export default function EmployeeDetail() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [tab, setTab] = useState("overview");
  const [tasks, setTasks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [e, t, r, p] = await Promise.all([
          endpoints.getEmployee(id),
          endpoints.listTasks({ assigneeId: id }).catch(() => ({ data: { tasks: [] } })),
          endpoints.listReviews({ employeeId: id }).catch(() => ({ data: { records: [] } })),
          endpoints.listPayroll({ employeeId: id }).catch(() => ({ data: { records: [] } })),
        ]);
        setEmployee(e.data.employee);
        setTasks(t.data.tasks || []);
        setReviews(r.data.records || []);
        setPayroll(p.data.records || []);
      } catch (e) {
        setErr(e?.response?.data?.error || e.message);
      }
    })();
  }, [id]);

  if (err)
    return (
      <div className="glass p-5 text-red-200 border-red-500/30">
        {err} — <Link to="/employees" className="underline">back</Link>
      </div>
    );
  if (!employee) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee.name || `Employee #${employee.employeeId}`}
        subtitle={`${employee.department} · ${employee.role}`}
        actions={
          <Link to="/employees" className="btn-ghost">
            ← Back
          </Link>
        }
      />

      <div className="glass p-6 flex flex-wrap items-center gap-5">
        <Avatar address={employee.walletAddress} name={employee.name} size={64} />
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-semibold text-white">
              {employee.name || "Unnamed"}
            </span>
            <StatusBadge status={employee.isActive ? "active" : "inactive"} />
          </div>
          <div className="text-sm text-slate-400">{employee.email || "—"}</div>
          <div className="text-xs text-slate-500 font-mono mt-1">
            {shortAddress(employee.walletAddress)}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Tasks" value={tasks.length} />
          <Stat label="Reviews" value={reviews.length} />
          <Stat label="Pay periods" value={payroll.length} />
        </div>
      </div>

      <div className="flex items-center gap-1 glass p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab ${tab === t.key ? "tab-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab employee={employee} />}
      {tab === "tasks" && <TasksList tasks={tasks} />}
      {tab === "reviews" && <ReviewsList reviews={reviews} />}
      {tab === "payroll" && <PayrollList rows={payroll} />}
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="glass p-3 min-w-[80px]">
    <div className="text-lg font-semibold text-white">{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
  </div>
);

function OverviewTab({ employee }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="glass p-5 space-y-3">
        <div className="kpi-label">Employment info</div>
        <Row label="Department" value={employee.department} />
        <Row label="Role" value={employee.role} />
        <Row label="Joined" value={formatDate(employee.createdAt)} />
        <Row label="Last update" value={formatDate(employee.updatedAt)} />
      </div>
      <div className="glass p-5 space-y-3">
        <div className="kpi-label">On-chain identity</div>
        <Row label="Employee ID" value={`#${employee.employeeId}`} mono />
        <Row label="Wallet" value={employee.walletAddress} mono />
        <Row
          label="Last TxHash"
          value={employee.txHash ? shortAddress(employee.txHash) : "—"}
          mono
        />
      </div>
    </div>
  );
}

const Row = ({ label, value, mono }) => (
  <div className="flex justify-between gap-3 items-start">
    <div className="text-sm text-slate-400">{label}</div>
    <div className={`text-sm text-white text-right break-all ${mono ? "font-mono text-xs" : ""}`}>
      {value || "—"}
    </div>
  </div>
);

function TasksList({ tasks }) {
  if (!tasks.length) return <EmptyState title="No tasks assigned" />;
  return (
    <div className="glass divide-y divide-white/5">
      {tasks.map((t) => (
        <div key={t._id} className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-medium text-white">{t.title}</div>
            <div className="text-xs text-slate-500 truncate">
              {t.description || "—"}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={t.priority} />
            <StatusBadge status={t.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsList({ reviews }) {
  if (!reviews.length) return <EmptyState title="No reviews yet" />;
  return (
    <div className="grid gap-3">
      {reviews.map((r) => (
        <div key={r._id} className="glass p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Period {r.period}</div>
              <div className="text-xs text-slate-500">{formatDate(r.createdAt)}</div>
            </div>
            <div className="text-2xl">{"★".repeat(r.rating)}<span className="text-slate-600">{"★".repeat(5 - r.rating)}</span></div>
          </div>
          {r.feedback && <p className="mt-3 text-sm text-slate-300">{r.feedback}</p>}
        </div>
      ))}
    </div>
  );
}

function PayrollList({ rows }) {
  if (!rows.length) return <EmptyState title="No payroll records" />;
  return (
    <div className="glass overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-2 text-left">Period</th>
            <th className="px-4 py-2 text-right">Base</th>
            <th className="px-4 py-2 text-right">Overtime</th>
            <th className="px-4 py-2 text-right">Bonuses</th>
            <th className="px-4 py-2 text-right">Net</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id} className="table-row">
              <td className="px-4 py-2">{r.period}</td>
              <td className="px-4 py-2 text-right">${r.baseSalary.toLocaleString()}</td>
              <td className="px-4 py-2 text-right">${r.overtimePay.toLocaleString()}</td>
              <td className="px-4 py-2 text-right">${r.bonuses.toLocaleString()}</td>
              <td className="px-4 py-2 text-right font-semibold">${r.netPay.toLocaleString()}</td>
              <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
