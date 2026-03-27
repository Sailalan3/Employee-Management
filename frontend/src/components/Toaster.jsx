import { useEffect, useState } from "react";

const ICONS = {
  success: "✓",
  error: "!",
  info: "ℹ",
};

const COLORS = {
  success: "from-emerald-500/30 to-emerald-500/5 border-emerald-400/40",
  error: "from-red-500/30 to-red-500/5 border-red-400/40",
  info: "from-indigo-500/30 to-indigo-500/5 border-indigo-400/40",
};

export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const onToast = (e) => {
      const t = e.detail;
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 4200);
    };
    window.addEventListener("toast", onToast);
    return () => window.removeEventListener("toast", onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto animate-fade-in flex min-w-[280px] max-w-sm items-start gap-3 rounded-xl border bg-gradient-to-br ${COLORS[t.type]} p-3 backdrop-blur-xl shadow-card`}
        >
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 font-semibold">
            {ICONS[t.type]}
          </div>
          <div className="text-sm text-white/90 leading-snug">{t.message}</div>
        </div>
      ))}
    </div>
  );
}
