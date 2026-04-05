import Leave from "../models/Leave.js";
import {
  resolveCallerEmployee,
  requireCallerEmployee,
} from "../services/identityService.js";

const daysBetween = (start, end) => {
  const ms = new Date(end) - new Date(start);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
};

export const list = async (req, res, next) => {
  try {
    const { status, employeeId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (employeeId) query.employeeId = Number(employeeId);
    const records = await Leave.find(query).sort({ createdAt: -1 });
    res.json({ records });
  } catch (err) {
    next(err);
  }
};

export const myLeaves = async (req, res, next) => {
  try {
    const me = await resolveCallerEmployee(req);
    if (!me) return res.json({ records: [] });
    const records = await Leave.find({ employeeId: me.employeeId }).sort({
      createdAt: -1,
    });
    res.json({ records });
  } catch (err) {
    next(err);
  }
};

export const request = async (req, res, next) => {
  try {
    const me = await requireCallerEmployee(req);
    const { type, startDate, endDate, reason } = req.body || {};
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    const doc = await Leave.create({
      employeeId: me.employeeId,
      type: type || "vacation",
      startDate,
      endDate,
      days: daysBetween(startDate, endDate),
      reason,
      status: "pending",
    });
    res.status(201).json({ leave: doc });
  } catch (err) {
    next(err);
  }
};

const decide = (decision) => async (req, res, next) => {
  try {
    const { note } = req.body || {};
    const doc = await Leave.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: decision,
          decidedBy: req.user?.walletAddress,
          decidedAt: new Date(),
          decisionNote: note,
        },
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Leave request not found" });
    res.json({ leave: doc });
  } catch (err) {
    next(err);
  }
};

export const approve = decide("approved");
export const reject = decide("rejected");

export const cancel = async (req, res, next) => {
  try {
    const me = await requireCallerEmployee(req);
    const doc = await Leave.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Leave request not found" });
    if (doc.employeeId !== me.employeeId) {
      return res.status(403).json({ error: "Can only cancel your own requests" });
    }
    if (doc.status !== "pending") {
      return res.status(409).json({ error: "Only pending requests can be cancelled" });
    }
    doc.status = "cancelled";
    await doc.save();
    res.json({ leave: doc });
  } catch (err) {
    next(err);
  }
};
