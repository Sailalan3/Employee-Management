import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Gate a route by auth status and (optionally) role. Unauthenticated users
// bounce to /login; authenticated users with the wrong role bounce to /.
export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />;
  return children;
}
