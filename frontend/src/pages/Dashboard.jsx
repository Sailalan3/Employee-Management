import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { endpoints } from "../services/api.js";
import { formatDate, shortAddress } from "../utils/format.js";

const COLORS = ["#8b5cf6", "#6366f1", "#ec4899", "#22d3ee", "#10b981", "#f59e0b"];

const KpiCard = ({ label, value, accent }) => (
  <div className="glass p-5 flex flex-col justify-between min-h-[120px] relative overflow-hidden">
    <div
      className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-25 blur-2xl"
      style={{ background: accent }}
    />
    <div className="kpi-label">{label}</div>
    <div className="kpi-value mt-2">{value}</div>
  </div>
);

// Heuristic "AI" insights — no external LLM call. We read the summary + chart
// data and emit short readable bullets. Cheap, deterministic, works offline.
const generateInsights = ({ summary, byDept, weekly, productivity }) => {
  const out = [];
  if (summary) {
    const active = summary.activeToday || 0;
    const total = summary.totalEmployees || 0;
    if (total > 0) {
      const pct = Math.round((active / total) * 100);
      if (pct >= 75) {
        out.push(`Strong attendance: ${pct}% of the team is active today.`);
      } else if (pct < 40) {
        out.push(
          `Low attendance — only ${pct}% of the team has clocked in. Consider a nudge.`
        );
      } else {
        out.push(`${pct}% of the team is active today (${active} of ${total}).`);
      }
    }
    const tt = summary.tasksTotal || 0;
    const tc = summary.tasksCompleted || 0;
    if (tt > 0) {
      const pct = Math.round((tc / tt) * 100);
      out.push(
        pct >= 70
          ? `Task delivery is on track — ${pct}% completed.`
          : `Task completion at ${pct}% — ${tt - tc} still open.`
      );
    }
  }
  if (byDept?.length) {
    const biggest = [...byDept].sort((a, b) => b.count - a.count)[0];
    if (biggest) {
      out.push(
        `${biggest.department} is the largest department with ${biggest.count} ${
          biggest.count === 1 ? "person" : "people"
        }.`
      );
    }
  }
  if (weekly?.length >= 2) {
    const last = weekly[weekly.length - 1]?.hours || 0;
    const prev = weekly[weekly.length - 2]?.hours || 0;
    if (prev > 0) {
      const delta = Math.round(((last - prev) / prev) * 100);
      if (Math.abs(delta) >= 10) {
        out.push(
          delta > 0
            ? `Daily hours up ${delta}% vs yesterday — momentum is building.`
            : `Daily hours down ${Math.abs(delta)}% vs yesterday — worth checking in.`
        );
      }
    }
  }
  if (productivity?.length) {
    const total = productivity.reduce((s, r) => s + (r.completed || 0), 0);
    if (total > 0) {
      out.push(`${total} tasks completed in the last 14 days.`);
    }
  }
  if (!out.length) {
    out.push(
      "Not enough data yet — insights will appear as employees clock in and tasks move."
    );
  }
  return out.slice(0, 5);
};

export default function Dashboard() {
  const { isHR, user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [byDept, setByDept] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [productivity, setProductivity] = useState([]);
  const [activity, setActivity] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [s, d, w, p, a] = await Promise.all([
          endpoints.summary(),
          endpoints.byDepartment(),
          endpoints.weeklyHours(),
          endpoints.productivity(),
          endpoints.recentActivity(8),
        ]);
        setSummary(s.data);
        setByDept(d.data.rows || []);
        setWeekly(w.data.rows || []);
        setProductivity(p.data.rows || []);
        setActivity(a.data.logs || []);
      } catch (e) {
        setErr(e?.response?.data?.error || e.message);
      }
    })();
  }, []);

  const insights = useMemo(
    () => generateInsights({ summary, byDept, weekly, productivity }),
    [summary, byDept, weekly, productivity]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={isHR ? "Overview" : `Welcome back`}
        subtitle={
          isHR
            ? "Live snapshot from the chain + Mongo mirror"
            : user?.email
            ? `Signed in as ${user.email}`
            : "Your workspace at a glance"
        }
      />

      {err && (
        <div className="glass border-red-500/30 text-red-200 p-3 text-sm">{err}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Employees"
          value={summary?.totalEmployees ?? "—"}
          accent="radial-gradient(closest-side,#8b5cf6,transparent)"
        />
        <KpiCard
          label="Active Today"
          value={summary?.activeToday ?? "—"}
          accent="radial-gradient(closest-side,#22d3ee,transparent)"
        />
        <KpiCard
          label="Tasks Completed"
          value={`${summary?.tasksCompleted ?? 0} / ${summary?.tasksTotal ?? 0}`}
          accent="radial-gradient(closest-side,#10b981,transparent)"
        />
        <KpiCard
          label={isHR ? "Total Payroll" : "Open Leaves"}
          value={
            isHR
              ? `$${(summary?.totalPayroll || 0).toLocaleString()}`
              : summary?.pendingLeaves ?? "—"
          }
          accent="radial-gradient(closest-side,#ec4899,transparent)"
        />
      </div>

      {/* AI Insights — heuristic summary, no external call */}
      <div className="glass p-5 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-30 blur-3xl bg-grad-neon" />
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-grad-neon grid place-items-center text-sm">
            ✨
          </div>
          <div>
            <div className="kpi-label">AI Insights</div>
            <div className="text-sm text-white font-semibold">
              Generated from today's data
            </div>
          </div>
        </div>
        <ul className="space-y-2 relative">
          {insights.map((line, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-slate-200"
            >
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neon-violet shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="kpi-label">Weekly work hours</div>
              <div className="font-semibold">Last 7 days</div>
            </div>
          </div>
          <div className="h-64">
            {weekly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15,15,28,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="hours" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyHint text="No attendance data yet — employees haven't clocked in." />
            )}
          </div>
        </div>

        <div className="glass p-5">
          <div className="kpi-label mb-3">Employees by department</div>
          <div className="h-64">
            {byDept.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byDept}
                    dataKey="count"
                    nameKey="department"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {byDept.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15,15,28,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyHint text="No employees yet." />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass p-5 lg:col-span-2">
          <div className="kpi-label mb-3">Productivity trend · completed tasks</div>
          <div className="h-56">
            {productivity.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={productivity}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15,15,28,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#ec4899"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#ec4899" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyHint text="No completed tasks in the last 14 days." />
            )}
          </div>
        </div>

        <div className="glass p-5">
          <div className="kpi-label mb-3">Recent blockchain activity</div>
          {activity.length ? (
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {activity.map((log) => (
                <li
                  key={log._id}
                  className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-2.5"
                >
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-neon-violet animate-pulse-glow" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{log.eventName}</div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {shortAddress(log.txHash)} · block {log.blockNumber}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatDate(log.timestamp, true)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint text="No on-chain activity yet." />
          )}
        </div>
      </div>
    </div>
  );
}

const EmptyHint = ({ text }) => (
  <div className="h-full grid place-items-center text-sm text-slate-500">{text}</div>
);
