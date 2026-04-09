import { avatarGradient } from "../utils/format.js";

export default function Avatar({ address = "", name = "", size = 32, className = "" }) {
  const s = typeof size === "number" ? `${size}px` : size;
  const initials = (name || address || "?")
    .replace(/^0x/, "")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={`grid place-items-center rounded-full text-[10px] font-semibold text-white/90 shadow-inner ring-1 ring-white/10 ${className}`}
      style={{
        width: s,
        height: s,
        background: avatarGradient(address),
      }}
      title={address}
    >
      {initials}
    </div>
  );
}
