import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", index: true },
    // assignee is identified by on-chain employeeId
    assigneeId: { type: Number, index: true },
    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "done"],
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    dueDate: Date,
    estimatedHours: { type: Number, default: 0 },
    actualHours: { type: Number, default: 0 },
    completedAt: Date,
    // walletAddress of the creator (from JWT)
    createdBy: String,
  },
  { timestamps: true }
);

export default mongoose.model("Task", taskSchema);
