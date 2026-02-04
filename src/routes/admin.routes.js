import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Admin from "../models/Admin.js";
import Pin from "../models/Pin.js";
import User from "../models/User.js";
import Document from "../models/Document.js";
import Notification from "../models/Notification.js";
import OTP from "../models/OTP.js";
import mongoose from "mongoose";
import fs from "fs";
import { config } from "../config/config.js";
import { generateOrgId } from "../utils/orgIdGenerator.js";
import { sendOTP, verifyOTP, normalizeNumber } from "../utils/otpGenerator.js";
import { authMiddleware, adminAuth,userMiddleware } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import mime from "mime-types";
import { ensureAdminMobileConfigured } from "../utils/adminConfig.js";

const router = express.Router();
const ADMIN_MOBILE = config.adminMobile;

// Build all possible mobile number variants that might be stored in DB
const buildMobileVariants = (mobile) => {
  if (!mobile) return [];
  
  const m = String(mobile).trim();
  
  // Extract only digits (handles +91, 0, spaces, etc)
  const allDigits = m.replace(/\D/g, "");
  
  // Get last 10 digits (pure mobile number)
  const last10 = allDigits.slice(-10);
  
  if (last10.length !== 10) {
    console.warn("❌ Cannot extract 10-digit mobile from:", mobile);
    return [];
  }
  
  // Create all possible format variants
  const variants = [...new Set([
    last10,              // "88888888888"
    `+${last10}`,        // "+8888888888"
    `91${last10}`,       // "918888888888"
    `+91${last10}`,      // "+918888888888"
  ])];
  
  console.log("🔍 Mobile variants for input", mobile, ":", variants);
  
  return variants;
};


router.post("/request-otp", async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required",
      });
    }

    const normalizedMobile = normalizeNumber(mobileNumber);
    console.log("📲 REQUEST OTP:", normalizedMobile);

    if (!normalizedMobile || normalizedMobile.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number",
      });
    }

    let otpReceiverMobile = normalizedMobile;
    let requestedMobile = null;
    let role = "user";
    let type = "login";

    /* ================= CHECK ADMIN ================= */
    const admin = await Admin.findOne({ mobileNumber: { $in: buildMobileVariants(normalizedMobile) } });
    if (admin) {
      role = "admin";
      type = "admin_access";
    }

    /* ================= CHECK USER ================= */
    const user = !admin
      ? await User.findOne({ mobileNumber: { $in: buildMobileVariants(normalizedMobile) } })
      : null;

    if (user) {
      role = "user";
      type = "user_login";
    }

    /* ================= NEW USER ================= */
    if (!admin && !user) {
      const systemAdmin = await Admin.findOne();
      if (!systemAdmin) {
        return res.status(500).json({
          success: false,
          message: "System admin not configured",
        });
      }

      otpReceiverMobile = systemAdmin.mobileNumber; // 🔥 OTP admin ko
      requestedMobile = normalizedMobile;           // 🔥 new user
      role = "new_user";
      type = "user_access_request";
    }

    // ❌ expire previous OTPs for SAME receiver
    await OTP.updateMany(
      { mobileNumber: otpReceiverMobile, isVerified: false },
      { expiresAt: new Date() }
    );

    // 🔥 SEND OTP
    const otpResponse = await sendOTP(otpReceiverMobile);

    if (!otpResponse?.verificationId) {
      return res.status(500).json({
        success: false,
        message: "OTP service failed",
      });
    }

    // ✅ SINGLE & CORRECT OTP CREATE
    await OTP.create({
      mobileNumber: otpReceiverMobile,     // jisko OTP gaya
      requestedMobile,                     // new user case
      verificationSid: otpResponse.verificationId,
      type,
      isVerified: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    console.log("✅ OTP CREATED:", {
      otpReceiverMobile,
      requestedMobile,
      type,
    });

    return res.json({
      success: true,
      role,
      message: "OTP sent successfully",
    });

  } catch (error) {
    console.error("❌ REQUEST OTP ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
});

router.post("/confirm-otp", async (req, res) => {
  try {
    const { mobileNumber, otp } = req.body;

    const inputMobile = normalizeNumber(mobileNumber);
    const code = String(otp).trim();

    if (!inputMobile || !/^\d{4,6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number or OTP",
      });
    }

    /* 🔍 FIND OTP */
    const otpRecord = await OTP.findOne({
      isVerified: false,
      expiresAt: { $gt: new Date() },
      $or: [
        { mobileNumber: inputMobile },
        { requestedMobile: inputMobile },
      ],
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found",
      });
    }

    /* 🔐 VERIFY OTP */
    const verified = await verifyOTP(
      otpRecord.mobileNumber,
      code,
      otpRecord.verificationSid
    );

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    otpRecord.isVerified = true;
    await otpRecord.save();

    /* =====================================================
       🔥 ADMIN LOGIN
       ===================================================== */
    if (otpRecord.type === "admin_access") {
      const admin = await Admin.findOne({
        mobileNumber: otpRecord.mobileNumber,
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }

      // Ensure admin has an orgId assigned
      if (!admin.orgId) {
        admin.orgId = generateOrgId();
        await admin.save();
      }

      const token = jwt.sign(
        { userId: admin._id, role: "admin", orgId: admin.orgId || null },
        config.jwtSecret,
        { expiresIn: "1d" }
      );

      return res.json({
        success: true,
        role: "admin",
        token,
        nextStep: admin.pinHash ? "confirm_pin" : "create_pin",
        message: "Admin verified successfully",
      });
    }

    /* =====================================================
       🔥 USER FLOW (NO AUTO CREATE)
       ===================================================== */

    const userMobile =
      otpRecord.requestedMobile || otpRecord.mobileNumber;

    const user = await User.findOne({ mobileNumber: userMobile });

    /* 🆕 USER NOT EXISTS */
    if (!user) {
      // 🧹 CLEAN UP: Invalidate all verified OTPs for this mobile
      await OTP.deleteMany({
        $or: [
          { mobileNumber: userMobile, isVerified: true },
          { requestedMobile: userMobile, isVerified: true }
        ]
      });

      return res.json({
        success: true,
        role: "new_user",
        nextStep: "waiting_approval",
        message: "OTP verified. Please wait for admin approval",
      });
    }

    /* 🔐 TOKEN */
    const token = jwt.sign(
      { userId: user._id, role: "user", orgId: user.orgId || null },
      config.jwtSecret,
      { expiresIn: "30d" }
    );

    /* 🔴 NOT APPROVED */
    if (!user.isApproved) {
      const waitingToken = jwt.sign(
        { userId: user._id, role: "user", orgId: user.orgId || null },
        config.jwtSecret,
        { expiresIn: "30d" }
      );
      
      return res.json({
        success: true,
        role: "new_user",
        token: waitingToken,
        nextStep: "waiting_approval",
        message: "Waiting for admin approval",
      });
    }

    /* 🟡 APPROVED BUT PIN NOT CREATED */
    if (!user.pinHash) {
      const pinToken = jwt.sign(
        { userId: user._id, role: "user", orgId: user.orgId || null },
        config.jwtSecret,
        { expiresIn: "30d" }
      );
      
      return res.json({
        success: true,
        role: "user",
        token: pinToken,
        nextStep: "create_pin",
        message: "Please create your PIN",
      });
    }

    /* 🟢 APPROVED + PIN CREATED */
    // 🔥 REFRESH user from DB to ensure latest orgId
    const refreshedUser = await User.findById(user._id);
    
    const finalToken = jwt.sign(
      { userId: refreshedUser._id, role: "user", orgId: refreshedUser.orgId || null },
      config.jwtSecret,
      { expiresIn: "30d" }
    );

    return res.json({
      success: true,
      role: "user",
      token: finalToken,
      nextStep: "confirm_pin",
      message: "User verified successfully",
    });
  } catch (error) {
    console.error("❌ CONFIRM OTP ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.post("/create-admin-pin", adminAuth, async (req, res) => {
  try {
    const { pin } = req.body;
    const adminId = req.admin._id;

    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: "PIN must be exactly 4 digits",
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    if (admin.pinHash) {
      return res.status(400).json({
        success: false,
        message: "PIN already created",
      });
    }

    admin.pinHash = await bcrypt.hash(pin, 10);
    await admin.save();

    console.log("✅ PIN SAVED IN DB FOR:", admin.mobileNumber);

    return res.json({
      success: true,
      message: "Admin PIN created successfully",
    });
  } catch (error) {
    console.error("❌ Create Admin PIN error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/confirm-admin-pin", adminAuth, async (req, res) => {
  try {
    const { pin } = req.body;
    const admin = req.admin;

    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: "Invalid PIN" });
    }

    const match = await bcrypt.compare(pin, admin.pinHash);
    if (!match) {
      return res.status(400).json({ success: false, message: "Wrong PIN" });
    }

    // Ensure admin has an orgId (create one if missing)
    if (!admin.orgId) {
      admin.orgId = generateOrgId();
      await admin.save();
    }

    const token = jwt.sign(
      {
        userId: admin._id,
        role: "admin",
        orgId: admin.orgId || null,
      },
      config.jwtSecret,
      { expiresIn: "30d" }
    );
console.log("✅ Admin OrgId:", admin.orgId);
    return res.json({
      success: true,
      token,
      role: "admin",
      message: "Admin logged in successfully",
    });
  } catch (error) {
    console.error("❌ Confirm Admin PIN error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/existing-admin", adminAuth, async (req, res) => {
  const admin = await Admin.findById(req.admin._id).lean();

  if (!admin) {
    return res.status(404).json({ exists: false });
  }

  return res.json({
    success: true,  
    exists: !!admin.pinHash, // 🔥 TRUE / FALSE
  });
});

router.post("/forgot-admin-pin", adminAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (!admin.pinHash) {
      return res.status(400).json({
        success: false,
        message: "No PIN found",
      });
    }

    admin.pinHash = null;
    await admin.save();

    return res.json({
      success: true,
      message: "PIN removed. Create a new PIN.",
    });
  } catch (error) {
    console.error("Forgot Admin PIN error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.get("/approval-requests", adminAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      adminId: req.admin._id,
      type: "approval_request", 
      isRead: false,
    }).populate("userId", "name mobileNumber approvalRequestedAt").sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Get approval requests error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Approve user
// router.post("/approve-user/:userId", adminAuth, async (req, res) => {
//   try {
//     const { userId } = req.params;

//     const admin = await Admin.findById(req.admin._id);
//     if (!admin) {
//       return res.status(404).json({ message: "Admin not found" });
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Approve user and assign orgId
//     user.isApproved = true;
//     user.orgId = admin.orgId;
//     user.approvedAt = new Date();
//     await user.save();

//     // Create approval notification
//     await Notification.create({
//       adminId: admin._id,
//       userId: user._id,
//       type: "approval_approved",
//       message: `User ${user.name} (${user.mobileNumber}) has been approved`,
//     });

//     // Mark request notification as read
//     await Notification.updateMany(
//       {
//         adminId: admin._id,
//         userId: user._id,
//         type: "approval_request",
//       },
//       { isRead: true }
//     );

//     res.status(200).json({
//       success: true,
//       message: "User approved successfully",
//       user: {
//         id: user._id,
//         name: user.name,
//         mobileNumber: user.mobileNumber,
//         orgId: user.orgId,
//       },
//     });
//   } catch (error) {
//     console.error("Approve user error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });
router.post("/approve-user/:userId", adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // ✅ Admin from middleware
    const admin = req.admin;
    if (!admin) {
      return res.status(401).json({ message: "Unauthorized admin" });
    }

    // ✅ Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ⚠️ Already approved safeguard
    if (user.isApproved) {
      return res.status(400).json({
        message: "User already approved",
      });
    }

    // ✅ Approve user
    user.isApproved = true;
    user.orgId = admin.orgId || null;
    user.approvedAt = new Date();
    await user.save();

    // 🔔 Approval notification (idempotent)
    await Notification.create({
      adminId: admin._id,
      userId: user._id,
      type: "approval_approved",
      status: "APPROVED",
      message: `User ${user.name || "User"} (${user.mobileNumber}) approved`,
    });

    // 🔕 Mark approval request as read
    await Notification.updateMany(
      {
        adminId: admin._id,
        userId: user._id,
        type: "approval_request",
        isRead: false,
      },
      { isRead: true }
    );

    return res.status(200).json({
      success: true,
      message: "User approved successfully",
      user: {
        id: user._id,
        name: user.name,
        mobileNumber: user.mobileNumber,
        isApproved: user.isApproved,
        orgId: user.orgId,
        nextStep: user.pinHash ? "confirm_pin" : "create_pin",
      },
    });
  } catch (error) {
    console.error("❌ Approve user error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});


// Upload documents (multiple files)
  router.post("/upload", adminAuth, upload.array("files", 50), async (req, res) => {
  try {
    const { docName, docKey } = req.body;

    if (!docName || !docKey) {
      return res.status(400).json({
        success: false,
        message: "docName and docKey are required",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const bucket = new mongoose.mongo.GridFSBucket(
      mongoose.connection.db,
      { bucketName: "documents" }
    );

    const uploadedDocs = [];

    for (const file of req.files) {
      const uploadStream = bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype,
        metadata: {
          orgId: admin.orgId,
          uploadedBy: admin._id.toString(),
        },
      });

      // ✅ CRITICAL: Stream file to GridFS completely
      await new Promise((resolve, reject) => {
        fs.createReadStream(file.path)
          .pipe(uploadStream)
          .once("finish", resolve)
          .once("error", reject);
      });

      // 🔥 Get fileId AFTER stream completes
      const fileId = uploadStream.id;

      const document = await Document.create({
        docName,
        docKey,
        fileId,
        originalName: file.originalname,
        contentType: file.mimetype,
        fileSize: file.size,
        orgId: admin.orgId,
        uploadedBy: admin._id,
        uploadedByType: "Admin",
      });

      uploadedDocs.push(document);
      
      // 🧹 Remove temp file after successful upload
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.warn("⚠️ Could not remove temp file:", file.path);
      }
    }

    res.status(201).json({
      success: true,
      message: "Documents uploaded successfully",
      count: uploadedDocs.length,
      documents: uploadedDocs,
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Upload failed",
    });
  }
});

// Get documents with optional filtering by docKey
router.get("/documents", authMiddleware, async (req, res) => {
  try {
    const { docKey } = req.query;

    if (!req.orgId) {
      return res.status(400).json({
        success: false,
        message: "Organization not assigned",
      });
    }

    const allowedKeys = [
      "CLIENT_STRATEGY",
      "FINANCIAL_ADVISORY",
      "PROJECT_BLUEPRINT",
      "CONSULTANT_REPORT",
      "CONTRACT",
      "HR_RECORD",
      "OTHER",
    ];

    const query = {
      orgId: req.orgId, // 🔥 ADMIN + USER BOTH
    };

    if (docKey) {
      if (!allowedKeys.includes(docKey)) {
        return res.status(400).json({
          success: false,
          message: "Invalid docKey",
        });
      }
      query.docKey = docKey;
    }

    const documents = await Document.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      role: req.role,          // frontend control
      docKey: docKey || "ALL",
      count: documents.length,
      documents,
    });
  } catch (error) {
    console.error("Get documents error:", error);
    res.status(500).json({ message: "Server error" });
  }
});



// View document
// router.get("/view/:id", adminAuth, async (req, res) => {
//   try {
//     /* 🔐 AUTH */
//     const admin = await Admin.findById(req.admin._id).lean();
//     if (!admin) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized",
//       });
//     }
//     const token =
//       req.headers.authorization?.split(" ")[1] ||
//       req.query.token; // 👈 fallback

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         message: "No auth token provided",
//       });
//     }

//     const decoded = jwt.verify(token, config.jwtSecret);
//     if (!decoded || String(decoded.userId) !== String(admin._id))
//      {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid auth token",
//       });
//     }

//     /* ✅ VALIDATE ID */
//     const { id } = req.params;
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid document ID",
//       });
//     }

//     /* 📄 FIND DOCUMENT */
//     const doc = await Document.findById(id).lean();
//     if (!doc) {
//       return res.status(404).json({
//         success: false,
//         message: "Document not found",
//       });
//     }

//     /* 🏢 ORG SECURITY */
//     if (String(doc.orgId) !== String(admin.orgId)) {
//       return res.status(403).json({
//         success: false,
//         message: "Access denied",
//       });
//     }

//     /* 📦 GRIDFS */
//     const bucket = new mongoose.mongo.GridFSBucket(
//       mongoose.connection.db,
//       { bucketName: "documents" }
//     );

//     /* ✅ INDUSTRY VIEW HEADERS */
//     // res.set({
//     //   "Content-Type": doc.contentType || "application/octet-stream",
//     //   "Content-Disposition": `inline; filename="${doc.originalName}"`,
//     //   "Accept-Ranges": "bytes",               // 🔥 VERY IMPORTANT
//     //   "X-Content-Type-Options": "nosniff",
//     //   "Cache-Control": "no-store, no-cache",
//     //   "Pragma": "no-cache",
//     // });

// res.set({
//   "Content-Type": doc.contentType,
//   "Content-Disposition": `inline; filename="${doc.originalName}"`,
//   "Accept-Ranges": "bytes",
//   "Cache-Control": "no-store",
//   "Pragma": "no-cache",
// });
// // res.set({
// //   "Content-Type": doc.contentType,
// //   "Content-Disposition": "inline",
// //   "Cache-Control": "no-store",
// //   "Pragma": "no-cache",
// //   "X-Content-Type-Options": "nosniff",
// // });



//     /* 🎥 STREAM */
//     const fileId = mongoose.Types.ObjectId.isValid(doc.fileId)
//       ? mongoose.Types.ObjectId(doc.fileId)
//       : doc.fileId;

//     if (doc.fileSize) {
//       res.setHeader("Content-Length", String(doc.fileSize));
//     }

//     const stream = bucket.openDownloadStream(fileId);

//     stream.on("error", (err) => {
//       console.error("❌ GridFS stream error:", err);
//       if (!res.headersSent) {
//         res.status(404).end("File not found");
//       }
//     });

//     stream.pipe(res);
//   } catch (error) {
//     console.error("❌ View document error:", error);
//     if (!res.headersSent) {
//       res.status(500).json({
//         success: false,
//         message: "Unable to view document",
//       });
//     }
//   }
// });


router.get("/view/:id", authMiddleware, async (req, res) => {
  try {
    const { role, userId } = req;

    const doc = await Document.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Document not found" });

    let orgId;

    // 👑 ADMIN ACCESS
    if (role === "admin") {
      const admin = await Admin.findById(userId);
      if (!admin) return res.status(401).json({ message: "Unauthorized" });

      if (String(doc.orgId) !== String(admin.orgId))
        return res.status(403).json({ message: "Access denied" });

      orgId = admin.orgId;
    }

    // 👤 USER ACCESS - Can view any document in their organization
    if (role === "user") {
      const user = await User.findById(userId);
      if (!user || !user.isApproved)
        return res.status(403).json({ message: "Not approved" });

      // ✅ Allow viewing documents from same organization
      if (String(doc.orgId) !== String(user.orgId))
        return res.status(403).json({ message: "Access denied" });

      orgId = user.orgId;
    }

    const bucket = new mongoose.mongo.GridFSBucket(
      mongoose.connection.db,
      { bucketName: "documents" }
    );

    res.setHeader("Content-Type", doc.contentType || "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${doc.originalName}"`
    );
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");

    if (doc.fileSize) {
      res.setHeader("Content-Length", String(doc.fileSize));
    }

    const fileId = new mongoose.Types.ObjectId(doc.fileId);
    const stream = bucket.openDownloadStream(fileId);

    stream.on("error", (err) => {
      console.error("GridFS error:", err);
      if (!res.headersSent) {
        res.status(404).end("File not found");
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.error("View error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "View failed" });
    }
  }
});



router.get("/download/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid document ID" });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const doc = await Document.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (doc.orgId.toString() !== admin.orgId.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(
      mongoose.connection.db,
      { bucketName: "documents" }
    );

    res.set({
      "Content-Type": doc.contentType,
      "Content-Disposition": `attachment; filename="${doc.originalName}"`,
    });
    if (doc.fileSize) {
      res.setHeader("Content-Length", String(doc.fileSize));
    }

    bucket.openDownloadStream(doc.fileId).pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ message: "Download failed" });
  }
});

// Share document
router.get("/share/:id", adminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid document id" });
    }

    const admin = await Admin.findById(req.admin._id);
    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (String(doc.orgId) !== String(admin.orgId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "documents",
    });

    // Determine content type and filename (ensure extension)
    const contentType = doc.contentType || "application/octet-stream";
    let filename = doc.originalName || `document_${doc._id}`;
    if (!filename.includes(".")) {
      const ext = mime.extension(contentType) || "bin";
      filename = `${filename}.${ext}`;
    }

    // Expose headers so clients can read filename/content-length
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Type, Content-Length");
    res.setHeader("Content-Type", contentType);
    // RFC5987-safe UTF-8 filename
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    if (doc.fileSize) {
      res.setHeader("Content-Length", String(doc.fileSize));
    }
    res.setHeader("Content-Transfer-Encoding", "binary");

    const fileId = mongoose.Types.ObjectId.isValid(doc.fileId)
      ? mongoose.Types.ObjectId(doc.fileId)
      : doc.fileId;

    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.on("error", (err) => {
      console.error("GridFS download error", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Share failed" });
      } else {
        res.end();
      }
    });

    downloadStream.pipe(res);
  } catch (err) {
    console.error("Share error", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Share failed" });
    } else {
      res.end();
    }
  }
});

// Delete document
router.delete("/delete/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    /* ✅ VALIDATE ID */
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid document ID" });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const doc = await Document.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (String(doc.orgId) !== String(admin.orgId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(
      mongoose.connection.db,
      { bucketName: "documents" }
    );

    /* 🧨 DELETE FILE FROM GRIDFS */
    try {
      await bucket.delete(new mongoose.Types.ObjectId(doc.fileId));
    } catch (gridErr) {
      console.error("⚠️ GridFS delete error:", gridErr);
      // file missing ho to bhi document delete allow
    }

    /* 🗑 DELETE DB RECORD */
    await doc.deleteOne();

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete document error:", error);
    res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
});

// Rename document
router.patch("/rename/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { docName } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid document ID" });
    }

    if (!docName || docName.trim() === "") {
      return res.status(400).json({ message: "Document name is required" });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const doc = await Document.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (doc.orgId.toString() !== admin.orgId.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    doc.docName = docName.trim();
    await doc.save();

    res.status(200).json({
      success: true,
      message: "Document renamed successfully",
      document: doc,
    });
  } catch (err) {
    console.error("Rename error:", err);
    res.status(500).json({ message: "Rename failed" });
  }
});



export default router;