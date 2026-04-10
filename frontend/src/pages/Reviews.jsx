import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { endpoints } from "../services/api.js";
import { formatDate } from "../utils/format.js";
import { toast } from "../utils/toast.js";

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      const [r, e] = await Promise.all([
        endpoints.listReviews(),
        endpoints.listEmployees(),
      ]);
      setReviews(r.data.records || []);
      setEmployees(e.data.employees || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const avgByEmployee = useMemo(() => {
    const map = new Map();
    for (const r of reviews) {
      const arr = map.get(r.employeeId) || [];
      arr.push(r.rating);
      map.set(r.employeeId, arr);
    }
    return map;
  }, [reviews]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Reviews"
        subtitle={`${reviews.length} reviews on record`}
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + New review
          </button>
        }
      />

      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet" hint="Add a review to get started." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {reviews.map((r) => {
            const emp = employees.find((e) => e.employeeId === r.employeeId);
            const avgArr = avgByEmployee.get(r.employeeId) || [];
            const avg = avgArr.length
              ? (avgArr.reduce((a, b) => a + b, 0) / avgArr.length).toFixed(1)
              : "—";
            return (
              <div key={r._id} className="glass p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-white">
                      {emp?.name || `#${r.employeeId}`}
                    </div>
                    <div className="text-xs text-slate-500">
                      Period {r.period} · avg {avg}★
                    </div>
                  </div>
                  <div className="text-xl tracking-wider">
                    <span>{"★".repeat(r.rating)}</span>
                    <span className="text-slate-600">{"★".repeat(5 - r.rating)}</span>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  {r.strengths && <Line label="Strengths" value={r.strengths} />}
                  {r.improvements && <Line label="Improvements" value={r.improvements} />}
                  {r.feedback && <Line label="Feedback" value={r.feedback} />}
                  {r.goals && <Line label="Goals" value={r.goals} />}
                </dl>
                <div className="mt-3 text-[11px] text-slate-500">
                  Reviewed {formatDate(r.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <ReviewModal
          employees={employees}
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

const Line = ({ label, value }) => (
  <div>
    <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
    <dd className="text-slate-300 mt-0.5">{value}</dd>
  </div>
);

function ReviewModal({ employees, onCancel, onCreated }) {
  const [form, setForm] = useState({
    employeeId: "",
    period: `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
    rating: 4,
    strengths: "",
    improvements: "",
    feedback: "",
    goals: "",
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.employeeId) return toast.error("Pick an employee");
    try {
      await endpoints.upsertReview({
        ...form,
        employeeId: Number(form.employeeId),
        rating: Number(form.rating),
      });
      toast.success("Review saved");
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="glass-strong w-full max-w-lg p-6 animate-fade-in">
        <h2 className="text-lg font-semibold mb-4">New review</h2>
        <div className="space-y-3">
          <select className="input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required>
            <option value="">Choose employee…</option>
            {employees.map((emp) => (
              <option key={emp.employeeId} value={emp.employeeId}>
                #{emp.employeeId} · {emp.name || "—"}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Period (e.g. 2026-Q1)" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Rating</span>
              <input type="range" min="1" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} className="flex-1" />
              <span className="w-8 text-right">{form.rating}★</span>
            </div>
          </div>
          <textarea className="input" rows="2" placeholder="Strengths" value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
          <textarea className="input" rows="2" placeholder="Areas to improve" value={form.improvements} onChange={(e) => setForm({ ...form, improvements: e.target.value })} />
          <textarea className="input" rows="2" placeholder="Feedback" value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} />
          <textarea className="input" rows="2" placeholder="Goals for next period" value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
