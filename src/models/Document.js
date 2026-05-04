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
        "Drinking_Water",
        "Sewage_Treatment",
        "Storm_Water",
        "Used_Water",
        "River_Front",
        "Soil_Testing",
        "Transport_Sector",
        "Housing_&_Slum"

      ],
      required: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
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
