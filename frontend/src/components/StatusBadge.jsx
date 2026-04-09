const MAP = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  working: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",

  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  draft: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  on_break: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  review: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  in_progress: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",

  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  cancelled: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  inactive: "bg-slate-500/20 text-slate-400 border-slate-500/30",

  todo: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  high: "bg-red-500/15 text-red-300 border-red-500/30",
  urgent: "bg-red-500/20 text-red-200 border-red-500/40",
  medium: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  low: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export default function StatusBadge({ status }) {
  const cls = MAP[status] || "bg-white/5 border-white/10 text-slate-300";
  const label = String(status || "—").replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] capitalize ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
