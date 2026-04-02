import mongoose from "mongoose";

const breakSchema = new mongoose.Schema(
  {
    startAt: { type: Date, required: true },
    endAt: Date,
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: { type: Number, required: true, index: true },
    // ISO date key (YYYY-MM-DD) — one attendance record per employee per day
    date: { type: String, required: true, index: true },
    clockIn: { type: Date, required: true },
    clockOut: Date,
    breaks: { type: [breakSchema], default: [] },
    // derived at clock-out / on read — kept as a cached field for fast analytics
    totalMinutes: { type: Number, default: 0 },
    breakMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["working", "on_break", "completed"],
      default: "working",
      index: true,
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
