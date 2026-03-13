import mongoose from "mongoose";

const blockchainLogSchema = new mongoose.Schema(
  {
    eventName: { type: String, index: true },
    txHash: { type: String, index: true },
    blockNumber: Number,
    logIndex: Number,
    payload: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

blockchainLogSchema.index({ txHash: 1, logIndex: 1 }, { unique: true });

export default mongoose.model("BlockchainLog", blockchainLogSchema);
