import Employee from "../models/Employee.js";
import * as employeeService from "../services/employeeService.js";

export const create = async (req, res, next) => {
  try {
    const result = await employeeService.createEmployee(req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const result = await employeeService.updateEmployee(
      req.params.id,
      req.body || {}
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const deactivate = async (req, res, next) => {
  try {
    const result = await employeeService.deactivateEmployee(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const list = async (_req, res, next) => {
  try {
    const employees = await Employee.find().sort({ employeeId: 1 });
    res.json({ employees });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "id must be a positive integer" });
    }
    const employee = await Employee.findOne({ employeeId: id });
    if (!employee) {
      return res.status(404).json({ error: `Employee ${id} not found` });
    }
    res.json({ employee });
  } catch (err) {
    next(err);
  }
};

export const listByDepartment = async (req, res, next) => {
  try {
    const employees = await Employee.find({
      department: req.params.dept,
    }).sort({ employeeId: 1 });
    res.json({ employees });
  } catch (err) {
    next(err);
  }
};

export const listByRole = async (req, res, next) => {
  try {
    const employees = await Employee.find({ role: req.params.role }).sort({
      employeeId: 1,
    });
    res.json({ employees });
  } catch (err) {
    next(err);
  }
};

export const listSortedByName = async (_req, res, next) => {
  try {
    const employees = await Employee.find().sort({
      name: 1,
      employeeId: 1,
    });
    res.json({ employees });
  } catch (err) {
    next(err);
  }
};

// -------- MetaMask-driven flow --------
// Frontend submitted the on-chain tx through MetaMask; backend verifies the
// receipt and mirrors to Mongo.

export const mirrorCreate = async (req, res, next) => {
  try {
    const result = await employeeService.mirrorCreate(req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const mirrorUpdate = async (req, res, next) => {
  try {
    const result = await employeeService.mirrorUpdate({
      ...(req.body || {}),
      employeeId: req.params.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const mirrorDeactivate = async (req, res, next) => {
  try {
    const txHash = (req.body && req.body.txHash) || req.query.txHash;
    const result = await employeeService.mirrorDeactivate({
      employeeId: req.params.id,
      txHash,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const ownerAddress = async (_req, res, next) => {
  try {
    const address = await employeeService.getContractOwner();
    res.json({ address });
  } catch (err) {
    next(err);
  }
};
