import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: String,
      required: true,
    },
    otp: {
      type: String,
      required: false,
      default: null,
    },
    otpHash: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ["user_registration", "user_access_request", "admin_access", "document_share", "user_login"],
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
    orgId: {
      type: String,
      default: null,
    },
    verificationSid: {
      type: String,
      default: null,
    },
    requestedMobile: {
  type: String,
  default: null,
},

  },
  { timestamps: true }
);

// Index for faster queries
otpSchema.index({ mobileNumber: 1, type: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("OTP", otpSchema);

