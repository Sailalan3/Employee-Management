import Employee from "../models/Employee.js";

// Resolve the caller to an Employee record. We prefer the JWT's employeeId (set when
// HR creates the account), and fall back to walletAddress lookup for legacy tokens.
export const resolveCallerEmployee = async (req) => {
  const id = req.user?.employeeId;
  if (id) {
    const emp = await Employee.findOne({ employeeId: Number(id) });
    if (emp) return emp;
  }
  const addr = req.user?.walletAddress;
  if (addr) {
    return Employee.findOne({ walletAddress: addr.toLowerCase() });
  }
  return null;
};

export const requireCallerEmployee = async (req) => {
  const employee = await resolveCallerEmployee(req);
  if (!employee) {
    const err = new Error(
      "No Employee record linked to your account — ask HR to set one up first"
    );
    err.status = 404;
    throw err;
  }
  return employee;
};
