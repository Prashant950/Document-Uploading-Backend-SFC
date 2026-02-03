import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
    },
    pinHash: {
      type: String,
      default: null,
    },
    name: {
      type: String,
      required: true,
      default: "Admin",
    },
    orgId: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Admin", adminSchema);

