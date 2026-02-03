import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    docName: {
      type: String,
      required: true,
    },
    docKey: {
      type: String,
      enum: [
        "CLIENT_STRATEGY",
        "FINANCIAL_ADVISORY",
        "PROJECT_BLUEPRINT",
        "CONSULTANT_REPORT",
        "CONTRACT",
        "HR_RECORD",
        "OTHER",
      ],
      required: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    contentType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    orgId: {
      type: String,
      
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "uploadedByType",
      required: true,
    },
    uploadedByType: {
      type: String,
      enum: ["User", "Admin"],
      required: true,
    },
    isShared: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Document", documentSchema);
