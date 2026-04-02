import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
  {
    employeeId: { type: Number, required: true, index: true },
    // period in YYYY-MM format
    period: { type: String, required: true, index: true },
    baseSalary: { type: Number, required: true, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    bonuses: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "approved", "paid"],
      default: "draft",
      index: true,
    },
    notes: String,
  },
  { timestamps: true }
);

payrollSchema.index({ employeeId: 1, period: 1 }, { unique: true });

export default mongoose.model("Payroll", payrollSchema);
