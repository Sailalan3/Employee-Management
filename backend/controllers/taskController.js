import Task from "../models/Task.js";
import { resolveCallerEmployee } from "../services/identityService.js";

export const list = async (req, res, next) => {
  try {
    const { status, assigneeId, projectId, mine } = req.query;
    const query = {};
    if (status) query.status = status;
    if (assigneeId) query.assigneeId = Number(assigneeId);
    if (projectId) query.projectId = projectId;
    if (mine === "true" || mine === "1") {
      const me = await resolveCallerEmployee(req);
      if (!me) return res.json({ tasks: [] });
      query.assigneeId = me.employeeId;
    }
    const tasks = await Task.find(query).sort({ createdAt: -1 }).limit(500);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ task });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const {
      title,
      description,
      projectId,
      assigneeId,
      status,
      priority,
      dueDate,
      estimatedHours,
    } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });

    const doc = await Task.create({
      title,
      description,
      projectId: projectId || undefined,
      assigneeId: assigneeId !== undefined ? Number(assigneeId) : undefined,
      status: status || "todo",
      priority: priority || "medium",
      dueDate,
      estimatedHours: estimatedHours ?? 0,
      createdBy: req.user?.walletAddress,
    });
    res.status(201).json({ task: doc });
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const updates = {};
    const fields = [
      "title",
      "description",
      "projectId",
      "status",
      "priority",
      "dueDate",
      "estimatedHours",
      "actualHours",
    ];
    for (const key of fields) {
      if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.body?.assigneeId !== undefined) {
      updates.assigneeId =
        req.body.assigneeId === null ? null : Number(req.body.assigneeId);
    }
    if (updates.status === "done") updates.completedAt = new Date();

    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ task });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
