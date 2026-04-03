import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || "7d";

const signToken = (user) =>
  jwt.sign(
    {
      userId: String(user._id),
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ?? null,
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );

export const sanitize = (user) => ({
  id: String(user._id),
  email: user.email,
  role: user.role,
  employeeId: user.employeeId ?? null,
  mustChangePassword: !!user.mustChangePassword,
  lastLoginAt: user.lastLoginAt,
});

const badRequest = (msg, status = 400) => {
  const err = new Error(msg);
  err.status = status;
  return err;
};

export const loginWithPassword = async (email, password) => {
  if (!email || !password) throw badRequest("email and password are required");
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) throw badRequest("Invalid email or password", 401);

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw badRequest("Invalid email or password", 401);

  user.lastLoginAt = new Date();
  await user.save();

  return { token: signToken(user), user: sanitize(user) };
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  if (!newPassword || newPassword.length < 6)
    throw badRequest("New password must be at least 6 characters");

  const user = await User.findById(userId);
  if (!user) throw badRequest("User not found", 404);

  // If this is the first-login forced-change flow, allow without current pw verification.
  if (!user.mustChangePassword) {
    if (!currentPassword) throw badRequest("Current password is required");
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw badRequest("Current password is incorrect", 401);
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  await user.save();
  return { user: sanitize(user) };
};

// Used by HR when creating an Employee — issues initial credentials.
export const createEmployeeLogin = async ({ email, password, employeeId }) => {
  if (!email || !password) throw badRequest("email and password are required");
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw badRequest("A user with that email already exists", 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    role: "employee",
    employeeId,
    mustChangePassword: true,
  });
  return sanitize(user);
};

export const getUserById = async (userId) => {
  const user = await User.findById(userId);
  return user ? sanitize(user) : null;
};
