import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    status: {
      type: String,
      enum: ["planning", "active", "on_hold", "completed"],
      default: "active",
      index: true,
    },
    startDate: Date,
    endDate: Date,
    // employeeIds assigned to this project
    members: { type: [Number], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);
