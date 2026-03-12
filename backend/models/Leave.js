import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    employeeId: { type: Number, required: true, index: true },
    type: {
      type: String,
      enum: ["sick", "vacation", "personal", "unpaid", "other"],
      default: "vacation",
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, default: 1 },
    reason: String,
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    decidedBy: String, // walletAddress of approver
    decidedAt: Date,
    decisionNote: String,
  },
  { timestamps: true }
);

export default mongoose.model("Leave", leaveSchema);
