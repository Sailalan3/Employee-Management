export const shortAddress = (addr = "") =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

export const formatDate = (value, withTime = false) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (!withTime) return date;
  return `${date} · ${d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export const formatMinutes = (mins = 0) => {
  const h = Math.floor(mins / 60);
  const m = Math.max(0, Math.round(mins % 60));
  if (!h) return `${m}m`;
  return `${h}h ${m}m`;
};

export const formatCurrency = (n = 0, currency = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

// seed-based gradient from a wallet address for avatars
export const avatarGradient = (addr = "") => {
  if (!addr) return "linear-gradient(135deg,#6366f1,#ec4899)";
  const seed = parseInt(addr.slice(2, 10), 16) || 0;
  const hue1 = seed % 360;
  const hue2 = (seed * 7) % 360;
  return `linear-gradient(135deg, hsl(${hue1} 80% 55%), hsl(${hue2} 80% 55%))`;
};

export const toCSV = (rows, columns) => {
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const head = columns.map((c) => escape(c.header)).join(",");
  const body = rows
    .map((r) => columns.map((c) => escape(typeof c.value === "function" ? c.value(r) : r[c.value])).join(","))
    .join("\n");
  return `${head}\n${body}`;
};

export const downloadCSV = (filename, csv) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
