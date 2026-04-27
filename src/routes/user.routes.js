import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import OTP from "../models/OTP.js";
import Notification from "../models/Notification.js";
import Admin from "../models/Admin.js";
import { config } from "../config/config.js";
import { sendOTP, verifyOTP, normalizeNumber } from "../utils/otpGenerator.js";
import { userMiddleware, adminAuth, authMiddleware } from "../middleware/auth.js";


const router = express.Router();
const ADMIN_MOBILE = config.adminMobile;
// Normalized admin mobile for consistent comparisons
const ADMIN_MOBILE_NORMALIZED = ADMIN_MOBILE ? normalizeNumber(ADMIN_MOBILE) : null;

const ensureAdminMobileConfigured = (res) => {
  if (!ADMIN_MOBILE) {
    res
      .status(500)
      .json({ message: "Admin mobile number is not configured" });
    return false;
  }
  return true;
};

router.post("/UserProfile", async (req, res) => {
  try {
    const { name, mobileNumber } = req.body;

    if (!name || !mobileNumber) {
      return res.status(400).json({
        message: "Name and mobile number required",
      });
    }

    const normalizedMobile = normalizeNumber(mobileNumber);

    // 🔍 FIND USER
    let user = await User.findOne({ mobileNumber: normalizedMobile });

    // 🔥 CREATE USER IF NOT EXISTS
    if (!user) {
      user = await User.create({
        name,
        mobileNumber: normalizedMobile,
        role: "user",
        isVerified: true,
        isApproved: false,
        approvalRequestedAt: new Date(),
      });
    } else {
      // UPDATE NAME IF EXISTS
      user.name = name;
      user.approvalRequestedAt = new Date();
      await user.save();
    }

    // 🔔 ADMIN NOTIFICATION
    const admin = await Admin.findOne();
    if (admin) {
      await Notification.create({
        adminId: admin._id,
        userId: user._id,
        type: "approval_request",
        name: user.name,
        mobileNumber: user.mobileNumber,
        status: "PENDING",
        message: `Approval request from ${user.name} and Mobile Number ${user.mobileNumber}`,
      });
    }

    return res.json({
      success: true,
      message: "Profile submitted. Waiting for approval",
      user: {
        id: user._id,
        name: user.name,
        mobileNumber: user.mobileNumber,
        isApproved: user.isApproved,
      },
    });
  } catch (err) {
    console.error("❌ USER PROFILE ERROR:", err);
    return res.status(500).json({
      message: "Server error",
    });
  }
});

router.get("/me/status", userMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "isApproved pinHash orgId role"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      isApproved: user.isApproved,
      pinCreated: !!user.pinHash,
      orgId: user.orgId || null,
      nextStep: !user.isApproved
        ? "waiting_approval"
        : !user.pinHash
        ? "create_pin"
        : "confirm_pin",
    });
  } catch (error) {
    console.error("Approval status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/user-create-pin", userMiddleware, async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || pin.length !== 4) {
      return res.status(400).json({ message: "Invalid PIN" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.pinHash) {
      return res.status(400).json({ message: "PIN already set" });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    user.pinHash = pinHash;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: "user", orgId: user.orgId || null },
      config.jwtSecret,
      { expiresIn: "30d" }
    );

    return res.status(200).json({
      success: true,
      message: "PIN created successfully",
      token,
    });
  } catch (error) {
    console.error("User create PIN error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/user-confirm-pin", userMiddleware, async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || pin.length !== 4) {
      return res.status(400).json({ message: "PIN must be 4 digits" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.pinHash) {
      return res.status(400).json({ message: "PIN not created yet" });
    }

    const isMatch = await bcrypt.compare(pin, user.pinHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect PIN" });
    }

    const token = jwt.sign(
      { userId: user._id, role: "user", orgId: user.orgId || null },
      config.jwtSecret,
      { expiresIn: "30d" }
    );

    return res.status(200).json({
      success: true,
      message: "PIN confirmed successfully",
      token,
    });
  } catch (error) {
    console.error("User confirm PIN error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/user-forgot-pin", userMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.pinHash) {
      return res.status(400).json({ message: "PIN not created yet" });
    }

    user.pinHash = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "PIN reset successfully. Please create a new PIN.",
    });
  } catch (error) {
    console.error("User forgot PIN error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


    

// router.post("/share-document/:documentId", userMiddleware, async (req, res) => {
//   try {
//     if (!ensureAdminMobileConfigured(res)) return;

//     const { documentId } = req.params;
//     const { shareOTP } = req.body;

//     const user = await User.findById(req.userId);
//     if (!user || !user.isApproved) {
//       return res.status(403).json({ message: "User not approved" });
//     }

//     // Verify share OTP
//     const otpRecord = await OTP.findOne({
//       mobileNumber: ADMIN_MOBILE,
//       otp: shareOTP,
//       type: "document_share",
//       documentId,
//       isVerified: false,
//       expiresAt: { $gt: new Date() },
//     });

//     if (!otpRecord) {
//       return res.status(400).json({ message: "Invalid or expired OTP" });
//     }

//     // Mark OTP as verified
//     otpRecord.isVerified = true;
//     await otpRecord.save();

//     // Mark document as shared
//     const Document = (await import("../models/Document.js")).default;
//     const document = await Document.findById(documentId);
//     if (!document) {
//       return res.status(404).json({ message: "Document not found" });
//     }

//     document.isShared = true;
//     await document.save();

//     res.status(200).json({
//       success: true,
//       message: "Document shared successfully",
//     });
//   } catch (error) {
//     console.error("Share document error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Request share OTP for document
// router.post("/request-share-otp/:documentId", userMiddleware, async (req, res) => {
//   try {
//     if (!ensureAdminMobileConfigured(res)) return;

//     const { documentId } = req.params;

//     const user = await User.findById(req.userId);
//     if (!user || !user.isApproved) {
//       return res.status(403).json({ message: "User not approved" });
//     }

//     const Document = (await import("../models/Document.js")).default;
//     const document = await Document.findById(documentId);
//     if (!document) {
//       return res.status(404).json({ message: "Document not found" });
//     }

//     // Generate OTP for admin
//     const shareOTP = generateOTP();
//     await OTP.create({
//       mobileNumber: ADMIN_MOBILE,
//       otp: shareOTP,
//       type: "document_share",
//       documentId,
//     });

//     // Send OTP to admin
//     await sendOTP(ADMIN_MOBILE, shareOTP, "document_share");

//     res.status(200).json({
//       success: true,
//       message: "Share OTP sent to admin",
//     });
//   } catch (error) {
//     console.error("Request share OTP error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });




export default router;

// --- User document endpoints (view, list, share) ---
// List shared documents for the logged-in user
router.get("/documents", userMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.orgId) {
      return res.status(403).json({ message: "User not approved or no orgId" });
    }

    const documents = await (await import("../models/Document.js")).default.find({
      orgId: user.orgId,
      isShared: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, documents });
  } catch (err) {
    console.error("Get user documents error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// View shared document
router.get("/view/:id", userMiddleware, async (req, res) => {
  try {
    const Document = (await import("../models/Document.js")).default;
    const user = await User.findById(req.userId);

    if (!user || !user.orgId) {
      return res.status(403).json({ message: "User not approved or no orgId" });
    }

    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Invalid document id" });

    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (!doc.isShared || String(doc.orgId) !== String(user.orgId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const mongoose = await import("mongoose");
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "documents" });

    if (doc.fileSize) res.setHeader("Content-Length", String(doc.fileSize));
    res.setHeader("Content-Type", doc.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalName}"`);

    const fileId = mongoose.Types.ObjectId.isValid(doc.fileId)
      ? mongoose.Types.ObjectId(doc.fileId)
      : doc.fileId;

    const stream = bucket.openDownloadStream(fileId);
    stream.on("error", (err) => {
      console.error("User GridFS stream error:", err);
      if (!res.headersSent) return res.status(404).end("File not found");
    });
    stream.pipe(res);
  } catch (err) {
    console.error("User view error:", err);
    return res.status(500).json({ message: "View failed" });
  }
 });

// Request share OTP (sends OTP to admin)
router.post("/request-share-otp/:documentId", userMiddleware, async (req, res) => {
  try {
    if (!ensureAdminMobileConfigured(res)) return;

    const { documentId } = req.params;
    const user = await User.findById(req.userId);
    if (!user || !user.isApproved) return res.status(403).json({ message: "User not approved" });

    const Document = (await import("../models/Document.js")).default;
    const document = await Document.findById(documentId);
    if (!document) return res.status(404).json({ message: "Document not found" });
    if (String(document.orgId) !== String(user.orgId)) return res.status(403).json({ message: "Access denied" });

    const shareOTP = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({
      mobileNumber: ADMIN_MOBILE,
      otp: shareOTP,
      type: "document_share",
      documentId,
      orgId: user.orgId,
      userId: user._id,
      isVerified: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendOTP(ADMIN_MOBILE, shareOTP, "document_share");

    return res.status(200).json({ success: true, message: "Share OTP sent to admin" });
  } catch (err) {
    console.error("Request share OTP error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Confirm share with OTP (user provides OTP received from admin)
router.post("/share-document/:documentId", userMiddleware, async (req, res) => {
  try {
    if (!ensureAdminMobileConfigured(res)) return;

    const { documentId } = req.params;
    const { shareOTP } = req.body;

    const user = await User.findById(req.userId);
    if (!user || !user.isApproved) return res.status(403).json({ message: "User not approved" });

    const otpRecord = await OTP.findOne({
      mobileNumber: ADMIN_MOBILE,
      otp: shareOTP,
      type: "document_share",
      documentId,
      isVerified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) return res.status(400).json({ message: "Invalid or expired OTP" });

    otpRecord.isVerified = true;
    await otpRecord.save();

    const Document = (await import("../models/Document.js")).default;
    const document = await Document.findById(documentId);
    if (!document) return res.status(404).json({ message: "Document not found" });
    if (String(document.orgId) !== String(user.orgId)) return res.status(403).json({ message: "Access denied" });

    document.isShared = true;
    await document.save();

    return res.status(200).json({ success: true, message: "Document shared successfully" });
  } catch (err) {
    console.error("Share document error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/ProfileName", authMiddleware, async (req, res) => {
  try {
    let name = null;

    if (req.role === "admin") {
      const admin = await Admin.findById(req.userId).select("name");
      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }
      name = admin.name;
    }

    if (req.role === "user") {
      const user = await User.findById(req.userId).select("name");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      name = user.name;
    }

    return res.status(200).json({
      success: true,
      role: req.role,
      name,
    });
  } catch (err) {
    console.error("Get profile name error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


