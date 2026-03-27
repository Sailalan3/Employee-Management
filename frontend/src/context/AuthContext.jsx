import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { endpoints } from "../services/api.js";

const AuthContext = createContext(null);

// Decode the JWT payload without an external dep — we trust it because the
// backend verifies on every request anyway. Only used for UI affordances
// (role gating, showing the user's email in the navbar).
const decodeJwt = (token) => {
  if (!token) return null;
  try {
    const [, payload] = token.split(".");
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("jwt"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  const persist = (newToken, newUser) => {
    if (newToken) {
      localStorage.setItem("jwt", newToken);
      localStorage.setItem("user", JSON.stringify(newUser));
    } else {
      localStorage.removeItem("jwt");
      localStorage.removeItem("user");
    }
    setToken(newToken || null);
    setUser(newUser || null);
  };

  const logout = useCallback(() => {
    persist(null, null);
    setError("");
  }, []);

  // Auto-logout on 401 from any API call
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    setSigningIn(true);
    setError("");
    try {
      const { data } = await endpoints.login(email, password);
      persist(data.token, data.user);
      return { ok: true, user: data.user };
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Login failed";
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setSigningIn(false);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await endpoints.me();
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
      return data.user;
    } catch {
      return null;
    }
  }, []);

  const jwtPayload = useMemo(() => decodeJwt(token), [token]);
  const role = user?.role || jwtPayload?.role || null;
  const employeeId = user?.employeeId ?? jwtPayload?.employeeId ?? null;

  const value = useMemo(
    () => ({
      token,
      user,
      role,
      employeeId,
      signingIn,
      error,
      isAuthenticated: !!token,
      isHR: role === "hr",
      isEmployee: role === "employee",
      mustChangePassword: !!user?.mustChangePassword,
      login,
      logout,
      refreshMe,
      setUser: (u) => {
        setUser(u);
        if (u) localStorage.setItem("user", JSON.stringify(u));
      },
    }),
    [token, user, role, employeeId, signingIn, error, login, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
