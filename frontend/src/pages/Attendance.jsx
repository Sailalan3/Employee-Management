import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { endpoints } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatMinutes, formatDate } from "../utils/format.js";
import { toast } from "../utils/toast.js";

export default function Attendance() {
  const { role } = useAuth();
  return role === "hr" ? <HRAttendance /> : <EmployeeAttendance />;
}

// --------- helpers shared across views ---------
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtMs = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const justTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// ====================================================================
// HR view: team-wide attendance for a given date.
// ====================================================================
function HRAttendance() {
  const [date, setDate] = useState(todayISO());
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async (isoDate) => {
    setLoading(true);
    try {
      const [att, emp] = await Promise.all([
        endpoints.listAttendance({ date: isoDate, from: isoDate, to: isoDate }),
        endpoints.listEmployees(),
      ]);
      setRecords(att.data.records || []);
      setEmployees(emp.data.employees || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(date);
  }, [date]);

  // Join attendance rows with employee details so HR sees names, not just IDs.
  const rows = useMemo(() => {
    const byId = new Map(employees.map((e) => [e.employeeId, e]));
    const joined = records.map((r) => ({
      ...r,
      employee: byId.get(r.employeeId) || null,
    }));
    // Employees with no attendance row for this date — surface as "Not clocked in"
    const clockedIds = new Set(records.map((r) => r.employeeId));
    const missing = employees
      .filter((e) => e.isActive !== false && !clockedIds.has(e.employeeId))
      .map((e) => ({
        _id: `missing-${e.employeeId}`,
        employeeId: e.employeeId,
        employee: e,
        status: "not_clocked_in",
      }));
    return [...joined, ...missing].sort(
      (a, b) => (b.clockIn ? 1 : 0) - (a.clockIn ? 1 : 0)
    );
  }, [records, employees]);

  const stats = useMemo(() => {
    const present = records.length;
    const completed = records.filter((r) => r.clockOut).length;
    const working = records.filter(
      (r) => !r.clockOut && r.status !== "on_break"
    ).length;
    const onBreak = records.filter((r) => r.status === "on_break").length;
    const totalMin = records.reduce((s, r) => s + (r.totalMinutes || 0), 0);
    return { present, completed, working, onBreak, totalMin };
  }, [records]);

  const isToday = date === todayISO();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Attendance"
        subtitle={
          isToday
            ? "Who's clocked in today"
            : `Attendance on ${formatDate(date)}`
        }
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input !py-1.5"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
            {!isToday && (
              <button
                className="btn-ghost !py-1.5 text-xs"
                onClick={() => setDate(todayISO())}
              >
                Today
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Present" value={stats.present} hint={`of ${employees.filter((e) => e.isActive !== false).length} active`} />
        <Kpi label="Working now" value={stats.working} hint="not on break" />
        <Kpi label="On break" value={stats.onBreak} />
        <Kpi label="Total worked" value={formatMinutes(stats.totalMin)} hint="team · today" />
      </div>

      <div className="glass overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No records for this date"
            hint="Pick a different day or check back later."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Employee</th>
                <th className="px-5 py-3 text-left">Department</th>
                <th className="px-5 py-3 text-left">Clock in</th>
                <th className="px-5 py-3 text-left">Clock out</th>
                <th className="px-5 py-3 text-right">Worked</th>
                <th className="px-5 py-3 text-right">Break</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="table-row">
                  <td className="px-5 py-3">
                    <div className="text-white">
                      {r.employee?.name || `#${r.employeeId}`}
                    </div>
                    {r.employee?.email && (
                      <div className="text-xs text-slate-500">{r.employee.email}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {r.employee?.department || "—"}
                  </td>
                  <td className="px-5 py-3">{justTime(r.clockIn)}</td>
                  <td className="px-5 py-3">{justTime(r.clockOut)}</td>
                  <td className="px-5 py-3 text-right">
                    {r.totalMinutes != null ? formatMinutes(r.totalMinutes) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-500">
                    {r.breakMinutes != null ? formatMinutes(r.breakMinutes) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={r.status || "not_clocked_in"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const Kpi = ({ label, value, hint }) => (
  <div className="glass p-4">
    <div className="kpi-label">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-white tabular-nums">
      {value}
    </div>
    {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
  </div>
);

// ====================================================================
// Employee view: the existing personal clock-in / clock-out UI.
// ====================================================================
const useLiveTimer = (record) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!record || record.clockOut) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [record]);
  if (!record) return { workedMs: 0, breakMs: 0 };
  const end = record.clockOut ? new Date(record.clockOut).getTime() : now;
  const workedMs = end - new Date(record.clockIn).getTime();
  const breakMs = (record.breaks || []).reduce((s, b) => {
    const bEnd = b.endAt ? new Date(b.endAt).getTime() : end;
    return s + Math.max(0, bEnd - new Date(b.startAt).getTime());
  }, 0);
  return { workedMs, breakMs, activeMs: Math.max(0, workedMs - breakMs) };
};

function EmployeeAttendance() {
  const [record, setRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const timer = useLiveTimer(record);

  const load = async () => {
    try {
      const [me, h] = await Promise.all([
        endpoints.myAttendance(),
        endpoints.myAttendanceHistory(14),
      ]);
      setRecord(me.data.attendance);
      setHistory(h.data.records || []);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (fn, successMsg) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const onBreak = record?.status === "on_break";
  const working = record && !record.clockOut && !onBreak;
  const completed = record?.clockOut;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle="Track your working time — breaks are excluded from total hours."
      />

      {err && (
        <div className="glass border-red-500/30 text-red-200 p-3 text-sm">{err}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-strong lg:col-span-2 p-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-grad-neon opacity-20 blur-3xl" />
          <div className="kpi-label mb-1">Today</div>
          <div className="text-5xl font-semibold tracking-tight text-white tabular-nums">
            {fmtMs(timer.activeMs || 0)}
          </div>
          <div className="mt-2 text-sm text-slate-400">
            {record ? (
              <>
                Clocked in at {formatDate(record.clockIn, true)} ·{" "}
                <span className="text-slate-300">Break: {fmtMs(timer.breakMs || 0)}</span>
              </>
            ) : (
              "Not clocked in yet."
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {!record && (
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() => act(() => endpoints.clockIn(), "Clocked in ✓")}
              >
                ▶ Clock In
              </button>
            )}
            {working && (
              <>
                <button
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => act(() => endpoints.startBreak(), "Break started")}
                >
                  ⏸ Start Break
                </button>
                <button
                  className="btn-danger"
                  disabled={busy}
                  onClick={() => act(() => endpoints.clockOut(), "Clocked out ✓")}
                >
                  ⏹ Clock Out
                </button>
              </>
            )}
            {onBreak && (
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() => act(() => endpoints.endBreak(), "Break ended")}
              >
                ▶ End Break
              </button>
            )}
            {completed && (
              <span className="chip">Day completed — come back tomorrow 🌙</span>
            )}
            {record && <StatusBadge status={record.status} />}
          </div>
        </div>

        <div className="glass p-5">
          <div className="kpi-label mb-3">This week</div>
          <Summary history={history} />
        </div>
      </div>

      <div className="glass overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 kpi-label">
          Recent history
        </div>
        {history.length === 0 ? (
          <EmptyState title="No history yet" hint="Clock in once to see it here." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-2 text-left">Date</th>
                <th className="px-5 py-2 text-left">Clock in</th>
                <th className="px-5 py-2 text-left">Clock out</th>
                <th className="px-5 py-2 text-right">Worked</th>
                <th className="px-5 py-2 text-right">Break</th>
                <th className="px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r._id} className="table-row">
                  <td className="px-5 py-2">{r.date}</td>
                  <td className="px-5 py-2">
                    {formatDate(r.clockIn, true).split(" · ")[1] || "—"}
                  </td>
                  <td className="px-5 py-2">
                    {r.clockOut
                      ? formatDate(r.clockOut, true).split(" · ")[1]
                      : "—"}
                  </td>
                  <td className="px-5 py-2 text-right">{formatMinutes(r.totalMinutes)}</td>
                  <td className="px-5 py-2 text-right text-slate-500">
                    {formatMinutes(r.breakMinutes)}
                  </td>
                  <td className="px-5 py-2"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Summary({ history }) {
  const last7 = history.slice(0, 7);
  const totalMin = last7.reduce((s, r) => s + (r.totalMinutes || 0), 0);
  const days = last7.length;
  const avg = days ? Math.round(totalMin / days) : 0;

  return (
    <div className="space-y-3">
      <Row label="Days tracked" value={`${days}`} />
      <Row label="Total worked" value={formatMinutes(totalMin)} />
      <Row label="Daily avg" value={formatMinutes(avg)} />
      <div className="grid grid-cols-7 gap-1 mt-4">
        {last7
          .slice()
          .reverse()
          .map((r) => (
            <div
              key={r._id}
              className="h-10 rounded-md"
              title={`${r.date} · ${formatMinutes(r.totalMinutes)}`}
              style={{
                background: `linear-gradient(180deg,#8b5cf6 ${Math.min(
                  100,
                  (r.totalMinutes / 480) * 100
                )}%, rgba(255,255,255,0.05) 0%)`,
              }}
            />
          ))}
      </div>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between text-sm">
    <span className="text-slate-400">{label}</span>
    <span className="text-white">{value}</span>
  </div>
);
