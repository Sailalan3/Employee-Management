import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Clean email + password login. No brand chip, no wallet flow — per product spec
// the sign-in screen should show the form only.
export default function Login() {
  const { isAuthenticated, login, signingIn, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email.trim(), password);
    if (result.ok) navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="relative w-full max-w-md">
        {/* soft gradient glow behind the card */}
        <div className="absolute -inset-6 -z-10 bg-grad-neon rounded-3xl blur-3xl opacity-30" />

        <div className="glass-strong p-8 animate-fade-in">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-white">Sign in</h1>
            <p className="text-sm text-slate-400 mt-1">
              Enter your email and password to continue.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-slate-400">
                Email / Job holder ID
              </span>
              {/* Intentionally type="text" — some HR-issued accounts use short
                  IDs (e.g. "E0231") rather than full emails. The backend looks
                  the account up by lowercased+trimmed string, so we don't want
                  the browser to block submission on HTML5 email validation. */}
              <input
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com or your ID"
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-neon-violet focus:ring-2 focus:ring-neon-violet/30"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wider text-slate-400">
                Password
              </span>
              <div className="mt-1 relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-20 text-white placeholder-slate-500 focus:outline-none focus:border-neon-violet focus:ring-2 focus:ring-neon-violet/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-3 text-xs font-medium text-slate-400 hover:text-white"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={signingIn || !email || !password}
              className="btn-primary w-full"
            >
              {signingIn ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-xs text-slate-500 leading-relaxed">
            Don't have an account? Ask HR to create one for you. First-time users
            will be asked to change their password after signing in.
          </div>
        </div>
      </div>
    </div>
  );
}
