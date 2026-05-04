import express from "express";
import mongoose from "mongoose";
import Document from "../models/Document.js";
import User from "../models/User.js";
import { userMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Get all documents for user (only shared documents)
router.get("/", userMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    // ✅ Approval check for document access
    if (!user.isApproved) {
      return res.status(403).json({ message: "User not approved yet" });
    }
    
    if (!user || !user.orgId) {
      return res.status(403).json({ message: "User not approved or no orgId" });
    }

    // Get only shared documents from user's orgId
    const documents = await Document.find({
      orgId: user.orgId,
      isShared: true,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("Get documents error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// View document
router.get("/view/:id", userMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    // ✅ Approval check for document access
    if (!user.isApproved) {
      return res.status(403).json({ message: "User not approved yet" });
    }
    
    const doc = await Document.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (doc.orgId !== user.orgId || !doc.isShared) {
      return res.status(403).json({ message: "Access denied" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "documents",
    });

    res.set("Content-Type", doc.contentType);
    res.set("Content-Disposition", `inline; filename="${doc.originalName}"`);

    bucket.openDownloadStream(doc.fileId).pipe(res);
  } catch (error) {
    console.error("View document error:", error);
    res.status(500).json({ message: "View failed" });
  }
});

export default router;

