import mongoose from "mongoose";

const pinSchema = new mongoose.Schema(
  {
    pinHash: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Pin", pinSchema);
