import mongoose from "mongoose";

const pinSchema = new mongoose.Schema(
  {
    pin: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Pin", pinSchema);
