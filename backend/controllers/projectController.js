import Project from "../models/Project.js";
import Task from "../models/Task.js";

export const list = async (_req, res, next) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json({ projects });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const tasks = await Task.find({ projectId: project._id }).sort({ createdAt: -1 });
    res.json({ project, tasks });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const { name, description, startDate, endDate, members, status } = req.body || {};
    if (!name) return res.status(400).json({ error: "name is required" });
    const doc = await Project.create({
      name,
      description,
      startDate,
      endDate,
      members: Array.isArray(members) ? members.map(Number) : [],
      status: status || "active",
    });
    res.status(201).json({ project: doc });
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const updates = {};
    for (const key of ["name", "description", "startDate", "endDate", "status"]) {
      if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    }
    if (Array.isArray(req.body?.members)) updates.members = req.body.members.map(Number);

    const project = await Project.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({ project });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    await Task.deleteMany({ projectId: project._id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
