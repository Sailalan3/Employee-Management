import mongoose from "mongoose";

// Auth user record. Every person who can log into the dashboard has one.
//   role=hr       → admin access (creates employees, approves leaves, runs payroll)
//   role=employee → scoped access (own profile, attendance, tasks, leaves)
// Kept walletAddress / nonce fields optional for backward compat with the older
// wallet-signature flow, but primary login is email + password.
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["hr", "employee"],
      required: true,
      default: "employee",
      index: true,
    },
    employeeId: { type: Number, index: true },
    mustChangePassword: { type: Boolean, default: true },
    lastLoginAt: Date,

    // legacy, optional
    walletAddress: { type: String, lowercase: true },
    nonce: String,
    nonceExpiresAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
