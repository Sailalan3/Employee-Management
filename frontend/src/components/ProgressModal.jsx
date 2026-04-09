export default function ProgressModal({ open, title = "Submitting transaction", hint }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm">
      <div className="glass-strong w-[360px] p-6 text-center animate-fade-in">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <div className="font-medium">{title}</div>
        {hint && <div className="mt-1 text-sm text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}
