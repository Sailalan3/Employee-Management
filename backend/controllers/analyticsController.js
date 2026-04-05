import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Task from "../models/Task.js";
import Payroll from "../models/Payroll.js";
import BlockchainLog from "../models/BlockchainLog.js";

const todayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const daysAgoKey = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const summary = async (_req, res, next) => {
  try {
    const today = todayKey();
    const [
      totalEmployees,
      activeEmployees,
      activeToday,
      tasksCompleted,
      tasksTotal,
      payrollAgg,
    ] = await Promise.all([
      Employee.countDocuments({}),
      Employee.countDocuments({ isActive: true }),
      Attendance.countDocuments({ date: today }),
      Task.countDocuments({ status: "done" }),
      Task.countDocuments({}),
      Payroll.aggregate([
        { $group: { _id: null, total: { $sum: "$netPay" } } },
      ]),
    ]);

    res.json({
      totalEmployees,
      activeEmployees,
      activeToday,
      tasksCompleted,
      tasksTotal,
      totalPayroll: payrollAgg[0]?.total || 0,
    });
  } catch (err) {
    next(err);
  }
};

export const byDepartment = async (_req, res, next) => {
  try {
    const rows = await Employee.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $project: { _id: 0, department: "$_id", count: 1 } },
      { $sort: { count: -1 } },
    ]);
    res.json({ rows });
  } catch (err) {
    next(err);
  }
};

export const weeklyHours = async (_req, res, next) => {
  try {
    const from = daysAgoKey(6);
    const rows = await Attendance.aggregate([
      { $match: { date: { $gte: from } } },
      {
        $group: {
          _id: "$date",
          totalMinutes: { $sum: "$totalMinutes" },
          sessions: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          hours: { $round: [{ $divide: ["$totalMinutes", 60] }, 2] },
          sessions: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);
    res.json({ rows });
  } catch (err) {
    next(err);
  }
};

export const productivityTrend = async (_req, res, next) => {
  try {
    // completions per day over last 14 days
    const from = new Date();
    from.setDate(from.getDate() - 13);
    from.setHours(0, 0, 0, 0);

    const rows = await Task.aggregate([
      { $match: { status: "done", completedAt: { $gte: from } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$completedAt" },
          },
          completed: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: "$_id", completed: 1 } },
      { $sort: { date: 1 } },
    ]);
    res.json({ rows });
  } catch (err) {
    next(err);
  }
};

export const recentActivity = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const logs = await BlockchainLog.find()
      .sort({ blockNumber: -1, logIndex: -1 })
      .limit(limit);
    res.json({ logs });
  } catch (err) {
    next(err);
  }
};
