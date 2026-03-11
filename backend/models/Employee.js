import mongoose from "mongoose";

// Off-chain mirror of the EmployeeRegistry contract, plus richer profile data
// that doesn't belong on chain (PII, education records, uploaded documents).
const documentSchema = new mongoose.Schema(
  {
    name: String,
    // base64 data URL — fine for small files. For production swap for S3/IPFS refs.
    dataUrl: String,
    mimeType: String,
    sizeBytes: Number,
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const educationSchema = new mongoose.Schema(
  {
    degree: String, // e.g. "B.Tech", "MBA"
    field: String, // e.g. "Computer Science"
    institution: String,
    year: Number,
    grade: String, // e.g. "8.5 CGPA" or "First Class"
  },
  { _id: true }
);

const personalSchema = new mongoose.Schema(
  {
    dateOfBirth: Date,
    gender: String,
    phone: String,
    address: String,
    emergencyContactName: String,
    emergencyContactPhone: String,
    nationality: String,
    bio: String,
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: Number, unique: true, index: true },
    name: String,
    email: String,
    department: { type: String, index: true },
    role: { type: String, index: true },
    walletAddress: { type: String, lowercase: true, index: true },
    txHash: String,
    isActive: { type: Boolean, default: true, index: true },
    joinDate: Date,
    salary: { type: Number, default: 0 },

    personal: personalSchema,
    education: { type: [educationSchema], default: [] },
    documents: { type: [documentSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Employee", employeeSchema);
