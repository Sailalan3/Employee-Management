import Payroll from "../models/Payroll.js";

const calcNet = ({ baseSalary = 0, overtimePay = 0, bonuses = 0, deductions = 0 }) =>
  Number(baseSalary) + Number(overtimePay) + Number(bonuses) - Number(deductions);

export const list = async (req, res, next) => {
  try {
    const { period, employeeId, status } = req.query;
    const query = {};
    if (period) query.period = period;
    if (employeeId) query.employeeId = Number(employeeId);
    if (status) query.status = status;
    const records = await Payroll.find(query).sort({ period: -1, employeeId: 1 });
    res.json({ records });
  } catch (err) {
    next(err);
  }
};

export const upsert = async (req, res, next) => {
  try {
    const {
      employeeId,
      period,
      baseSalary,
      overtimeHours,
      overtimePay,
      bonuses,
      deductions,
      status,
      notes,
    } = req.body || {};

    if (!employeeId || !period || baseSalary === undefined) {
      return res
        .status(400)
        .json({ error: "employeeId, period, baseSalary are required" });
    }

    const netPay = calcNet({ baseSalary, overtimePay, bonuses, deductions });
    const doc = await Payroll.findOneAndUpdate(
      { employeeId: Number(employeeId), period },
      {
        $set: {
          employeeId: Number(employeeId),
          period,
          baseSalary: Number(baseSalary),
          overtimeHours: Number(overtimeHours || 0),
          overtimePay: Number(overtimePay || 0),
          bonuses: Number(bonuses || 0),
          deductions: Number(deductions || 0),
          netPay,
          status: status || "draft",
          notes,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ payroll: doc });
  } catch (err) {
    next(err);
  }
};

export const setStatus = async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!["draft", "approved", "paid"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const doc = await Payroll.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Payroll record not found" });
    res.json({ payroll: doc });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const doc = await Payroll.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Payroll record not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
