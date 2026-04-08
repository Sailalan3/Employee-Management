import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3010";

export const api = axios.create({ baseURL, timeout: 30_000 });

// Attach JWT from localStorage automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Surface 401s in a consistent shape so the AuthContext can react
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    return Promise.reject(err);
  }
);

// --- thin endpoint helpers ---
export const endpoints = {
  // auth (email + password)
  login: (email, password) => api.post("/auth/login", { email, password }),
  me: () => api.get("/auth/me"),
  changePassword: (currentPassword, newPassword) =>
    api.post("/auth/change-password", { currentPassword, newPassword }),

  // employees
  listEmployees: () => api.get("/employees"),
  getEmployee: (id) => api.get(`/employees/${id}`),
  createEmployee: (payload) => api.post("/employees/create", payload),
  updateEmployee: (id, payload) => api.put(`/employees/${id}`, payload),
  deleteEmployee: (id) => api.delete(`/employees/${id}`),
  // MetaMask-signed flow — frontend sends the tx, then asks backend to mirror
  mirrorCreateEmployee: (payload) => api.post("/employees/mirror", payload),
  mirrorUpdateEmployee: (id, payload) =>
    api.put(`/employees/mirror/${id}`, payload),
  mirrorDeleteEmployee: (id, txHash) =>
    api.delete(`/employees/mirror/${id}`, { params: { txHash } }),
  getContractOwner: () => api.get("/employees/owner"),

  // attendance
  clockIn: () => api.post("/attendance/clock-in"),
  clockOut: () => api.post("/attendance/clock-out"),
  startBreak: () => api.post("/attendance/break/start"),
  endBreak: () => api.post("/attendance/break/end"),
  myAttendance: () => api.get("/attendance/me"),
  myAttendanceHistory: (limit = 30) =>
    api.get("/attendance/me/history", { params: { limit } }),
  listAttendance: (params = {}) => api.get("/attendance", { params }),

  // projects / tasks
  listProjects: () => api.get("/projects"),
  createProject: (payload) => api.post("/projects", payload),
  updateProject: (id, payload) => api.put(`/projects/${id}`, payload),
  deleteProject: (id) => api.delete(`/projects/${id}`),

  listTasks: (params = {}) => api.get("/tasks", { params }),
  createTask: (payload) => api.post("/tasks", payload),
  updateTask: (id, payload) => api.put(`/tasks/${id}`, payload),
  deleteTask: (id) => api.delete(`/tasks/${id}`),

  // payroll
  listPayroll: (params = {}) => api.get("/payroll", { params }),
  upsertPayroll: (payload) => api.post("/payroll", payload),
  setPayrollStatus: (id, status) => api.put(`/payroll/${id}/status`, { status }),
  deletePayroll: (id) => api.delete(`/payroll/${id}`),

  // leaves
  listLeaves: (params = {}) => api.get("/leaves", { params }),
  myLeaves: () => api.get("/leaves/me"),
  requestLeave: (payload) => api.post("/leaves", payload),
  approveLeave: (id, note) => api.post(`/leaves/${id}/approve`, { note }),
  rejectLeave: (id, note) => api.post(`/leaves/${id}/reject`, { note }),
  cancelLeave: (id) => api.post(`/leaves/${id}/cancel`),

  // reviews
  listReviews: (params = {}) => api.get("/reviews", { params }),
  upsertReview: (payload) => api.post("/reviews", payload),
  deleteReview: (id) => api.delete(`/reviews/${id}`),

  // analytics
  summary: () => api.get("/analytics/summary"),
  byDepartment: () => api.get("/analytics/by-department"),
  weeklyHours: () => api.get("/analytics/weekly-hours"),
  productivity: () => api.get("/analytics/productivity"),
  recentActivity: (limit = 10) =>
    api.get("/analytics/recent-activity", { params: { limit } }),

  // blockchain logs
  listLogs: (params = {}) => api.get("/logs", { params }),
};

export default api;
