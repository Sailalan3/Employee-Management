import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    employeeId: { type: Number, required: true, index: true },
    // review cycle, YYYY-Q1..Q4 or YYYY-H1/H2 — free-form string
    period: { type: String, required: true, index: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    strengths: String,
    improvements: String,
    feedback: String,
    goals: String,
    // walletAddress of reviewer
    reviewerAddress: String,
  },
  { timestamps: true }
);

reviewSchema.index({ employeeId: 1, period: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);
