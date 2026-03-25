import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Toaster from "./components/Toaster.jsx";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Employees from "./pages/Employees.jsx";
import EmployeeDetail from "./pages/EmployeeDetail.jsx";
import Attendance from "./pages/Attendance.jsx";
import Tasks from "./pages/Tasks.jsx";
import Payroll from "./pages/Payroll.jsx";
import Leaves from "./pages/Leaves.jsx";
import Reviews from "./pages/Reviews.jsx";
import BlockchainActivity from "./pages/BlockchainActivity.jsx";
import Settings from "./pages/Settings.jsx";

// HR-only pages are wrapped in <ProtectedRoute roles={["hr"]}> so employees
// who type the URL directly get redirected home instead of hitting a 403.
const hrOnly = (el) => (
  <ProtectedRoute roles={["hr"]}>{el}</ProtectedRoute>
);

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="employees" element={hrOnly(<Employees />)} />
          <Route path="employees/:id" element={hrOnly(<EmployeeDetail />)} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="payroll" element={hrOnly(<Payroll />)} />
          <Route path="leaves" element={<Leaves />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="blockchain" element={hrOnly(<BlockchainActivity />)} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
