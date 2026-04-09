export default function EmptyState({ title = "Nothing here yet", hint, action }) {
  return (
    <div className="glass p-10 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-xl">
        ✨
      </div>
      <div className="text-lg font-medium">{title}</div>
      {hint && <div className="mt-1 text-sm text-slate-400">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
