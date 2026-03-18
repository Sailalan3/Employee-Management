import Attendance from "../models/Attendance.js";
import { requireCallerEmployee } from "../services/identityService.js";

const todayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const computeTotals = (record) => {
  const end = record.clockOut || new Date();
  const workedMs = end - record.clockIn;
  const breakMs = (record.breaks || []).reduce((sum, b) => {
    const bEnd = b.endAt || end;
    return sum + Math.max(0, bEnd - b.startAt);
  }, 0);
  record.breakMinutes = Math.round(breakMs / 60000);
  record.totalMinutes = Math.max(0, Math.round((workedMs - breakMs) / 60000));
};

export const clockIn = async (req, res, next) => {
  try {
    const employee = await requireCallerEmployee(req);
    const date = todayKey();

    const existing = await Attendance.findOne({
      employeeId: employee.employeeId,
      date,
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: "Already clocked in today", attendance: existing });
    }

    const doc = await Attendance.create({
      employeeId: employee.employeeId,
      date,
      clockIn: new Date(),
      status: "working",
    });
    res.status(201).json({ attendance: doc });
  } catch (err) {
    next(err);
  }
};

export const clockOut = async (req, res, next) => {
  try {
    const employee = await requireCallerEmployee(req);
    const date = todayKey();
    const record = await Attendance.findOne({
      employeeId: employee.employeeId,
      date,
    });
    if (!record) return res.status(404).json({ error: "Not clocked in today" });
    if (record.clockOut)
      return res.status(409).json({ error: "Already clocked out today" });

    // auto-close any open break
    const openBreak = record.breaks.find((b) => !b.endAt);
    if (openBreak) openBreak.endAt = new Date();

    record.clockOut = new Date();
    record.status = "completed";
    computeTotals(record);
    await record.save();
    res.json({ attendance: record });
  } catch (err) {
    next(err);
  }
};

export const startBreak = async (req, res, next) => {
  try {
    const employee = await requireCallerEmployee(req);
    const date = todayKey();
    const record = await Attendance.findOne({
      employeeId: employee.employeeId,
      date,
    });
    if (!record) return res.status(404).json({ error: "Not clocked in today" });
    if (record.clockOut)
      return res.status(409).json({ error: "Already clocked out today" });
    if (record.breaks.some((b) => !b.endAt))
      return res.status(409).json({ error: "A break is already open" });

    record.breaks.push({ startAt: new Date() });
    record.status = "on_break";
    await record.save();
    res.json({ attendance: record });
  } catch (err) {
    next(err);
  }
};

export const endBreak = async (req, res, next) => {
  try {
    const employee = await requireCallerEmployee(req);
    const date = todayKey();
    const record = await Attendance.findOne({
      employeeId: employee.employeeId,
      date,
    });
    if (!record) return res.status(404).json({ error: "Not clocked in today" });
    const openBreak = record.breaks.find((b) => !b.endAt);
    if (!openBreak) return res.status(409).json({ error: "No open break" });

    openBreak.endAt = new Date();
    record.status = "working";
    await record.save();
    res.json({ attendance: record });
  } catch (err) {
    next(err);
  }
};

export const myStatus = async (req, res, next) => {
  try {
    const employee = await requireCallerEmployee(req);
    const date = todayKey();
    const record = await Attendance.findOne({
      employeeId: employee.employeeId,
      date,
    });
    if (record && !record.clockOut) computeTotals(record);
    res.json({ attendance: record, date });
  } catch (err) {
    next(err);
  }
};

export const myHistory = async (req, res, next) => {
  try {
    const employee = await requireCallerEmployee(req);
    const limit = Math.min(Number(req.query.limit) || 30, 365);
    const records = await Attendance.find({ employeeId: employee.employeeId })
      .sort({ date: -1 })
      .limit(limit);
    res.json({ records });
  } catch (err) {
    next(err);
  }
};

export const listAll = async (req, res, next) => {
  try {
    const { from, to, employeeId } = req.query;
    const query = {};
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }
    if (employeeId) query.employeeId = Number(employeeId);
    const records = await Attendance.find(query)
      .sort({ date: -1, employeeId: 1 })
      .limit(1000);
    res.json({ records });
  } catch (err) {
    next(err);
  }
};
