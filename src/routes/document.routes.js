import express from "express";
import mongoose from "mongoose";
import Document from "../models/Document.js";
import { authMiddleware } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import fs from "fs";

const router = express.Router();

// router.post("/upload",authMiddleware,upload.single("file"),async (req, res) => {
//     try {
//       console.log("BODY:", req.body);
//       console.log("FILE:", req.file);

//       if (!req.file) {
//         return res.status(400).json({ message: "File required" });
//       }

//       const { docName, docKey } = req.body;
//       if (!docName || !docKey) {
//         return res.status(400).json({ message: "docName and docKey required" });
//       }

//       const bucket = new mongoose.mongo.GridFSBucket(
//         mongoose.connection.db,
//         { bucketName: "documents" }
//       );

//       // remove old doc of same type
//       await Document.findOneAndDelete({
//         user: req.user._id,
//         docKey,
//       });

//       const uploadStream = bucket.openUploadStream(req.file.originalname);
//       const readStream = fs.createReadStream(req.file.path);

//       readStream.pipe(uploadStream);

//       uploadStream.on("finish", async () => {
//         const doc = await Document.create({
//           docName,
//           docKey,
//           fileId: uploadStream.id,
//           originalName: req.file.originalname,
//           contentType: req.file.mimetype,
//           user: req.user._id,
//         });

//         if (fs.existsSync(req.file.path)) {
//           fs.unlinkSync(req.file.path);
//         }

//         res.status(201).json({
//           success: true,
//           document: doc,
//         });
//       });

//       uploadStream.on("error", (err) => {
//         console.error("GridFS Error:", err);
//         res.status(500).json({ message: "File upload failed" });
//       });

//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ message: "Upload failed" });
//     }
//   }
// );

// Accept multiple files with field name 'files'

router.post(
  "/upload",
  authMiddleware,
  upload.array("files", 10),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "Files required" });
      }

      const bucket = new mongoose.mongo.GridFSBucket(
        mongoose.connection.db,
        { bucketName: "documents" }
      );

      const savedDocs = [];

      for (const file of req.files) {
        const uploadStream = bucket.openUploadStream(file.originalname);

        await new Promise((resolve, reject) => {
          fs.createReadStream(file.path)
            .pipe(uploadStream)
            .on("error", reject)
            .on("finish", resolve);
        });

        const doc = await Document.create({
          docName: req.body.docName,
          docKey: req.body.docKey || "OTHER",
          fileId: uploadStream.id,
          originalName: file.originalname,
          contentType: file.mimetype,
          user: req.userId,
        });

        savedDocs.push(doc);
        fs.unlinkSync(file.path);
      }

      res.status(201).json({
        success: true,
        count: savedDocs.length,
        documents: savedDocs,
      });

    } catch (error) {
      console.error("UPLOAD ERROR", error);
      res.status(500).json({ message: "Upload failed" });
    }
  }
);




router.get("/", authMiddleware, async (req, res) => {
  try{
  const docs = await Document.find({ user: req.userId }).sort({ createdAt: -1 });
  res.json(docs);
} catch (error) {
  console.error(error);
  res.status(500).json({ message: "Server error" });
} 
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const bucket = new mongoose.mongo.GridFSBucket(
      mongoose.connection.db,
      { bucketName: "documents" }
    );

    await bucket.delete(doc.fileId);
    await doc.deleteOne();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

router.get("/download/:id", authMiddleware, async (req, res) => {
  const doc = await Document.findById(req.params.id);
  res.set("Content-Type", doc.contentType);
  res.set("Content-Disposition", `attachment; filename="${doc.originalName}"`);
  const bucket = new mongoose.mongo.GridFSBucket(
    mongoose.connection.db,
    { bucketName: "documents" }
  );
  bucket.openDownloadStream(doc.fileId).pipe(res);
});

router.get("/view/:id",authMiddleware,async (req, res) => {
    try {
      const doc = await Document.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Not found" });

      const bucket = new mongoose.mongo.GridFSBucket(
        mongoose.connection.db,
        { bucketName: "documents" }
      );

      res.set("Content-Type", doc.contentType);
      res.set("Content-Disposition", `inline; filename="${doc.originalName}"`);

      bucket
        .openDownloadStream(doc.fileId)
        .pipe(res);

    } catch (err) {
      res.status(500).json({ message: "View failed" });
    }
  }
);

router.get("share/:id", authMiddleware, async (req, res) => {
  const doc = await Document.findById(req.params.id);
  res.set("Content-Type", doc.contentType);
  res.set("Content-Disposition", `attachment; filename="${doc.originalName}"`);
  const bucket = new mongoose.mongo.GridFSBucket(
    mongoose.connection.db,
    { bucketName: "documents" }
  );
  bucket.openDownloadStream(doc.fileId).pipe(res);
});









router.get("/file/:id", authMiddleware, async (req, res) => {
  const doc = await Document.findById(req.params.id);

  const bucket = new mongoose.mongo.GridFSBucket(
    mongoose.connection.db,
    { bucketName: "documents" }
  );

  res.set("Content-Type", doc.contentType);

  bucket.openDownloadStream(doc.fileId).pipe(res);
});




export default router;
