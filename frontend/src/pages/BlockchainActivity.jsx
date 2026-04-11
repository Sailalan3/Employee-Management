import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { endpoints } from "../services/api.js";
import { formatDate, shortAddress } from "../utils/format.js";
import { toast } from "../utils/toast.js";

const EVENT_COLORS = {
  EmployeeCreated: "from-emerald-500/20 to-transparent border-emerald-500/30",
  EmployeeUpdated: "from-indigo-500/20 to-transparent border-indigo-500/30",
  EmployeeDeleted: "from-red-500/20 to-transparent border-red-500/30",
};

export default function BlockchainActivity() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await endpoints.listLogs({
          limit: 200,
          eventName: filter || undefined,
        });
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } catch (err) {
        toast.error(err?.response?.data?.error || "Failed to load logs");
      } finally {
        setLoading(false);
      }
    })();
  }, [filter]);

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blockchain Activity"
        subtitle={`${total} events mirrored from ${import.meta.env.VITE_NETWORK_NAME || "Ganache"}`}
      />

      <div className="glass p-3 flex items-center gap-2">
        <button
          className={`tab ${!filter ? "tab-active" : ""}`}
          onClick={() => setFilter("")}
        >
          All
        </button>
        {["EmployeeCreated", "EmployeeUpdated", "EmployeeDeleted"].map((e) => (
          <button
            key={e}
            className={`tab ${filter === e ? "tab-active" : ""}`}
            onClick={() => setFilter(e)}
          >
            {e}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass p-10 text-center text-slate-500">Loading logs…</div>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No events"
          hint="Create, update or deactivate an employee to see activity flow in."
        />
      ) : (
        <div className="glass overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">Employee ID</th>
                <th className="px-4 py-3 text-left">Tx Hash</th>
                <th className="px-4 py-3 text-right">Block</th>
                <th className="px-4 py-3 text-left">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="table-row">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-r px-2.5 py-0.5 text-[11px] ${
                        EVENT_COLORS[log.eventName] ||
                        "border-white/10 from-white/10 to-transparent"
                      }`}
                    >
                      {log.eventName}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    #{log.payload?.employeeId ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="font-mono text-xs text-slate-300 hover:text-white flex items-center gap-2"
                      onClick={() => copy(log.txHash)}
                      title={log.txHash}
                    >
                      {shortAddress(log.txHash)}
                      <span className="text-slate-500">⧉</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400">
                    {log.blockNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatDate(log.timestamp, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
