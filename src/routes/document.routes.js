import express from "express";
import Document from "../models/Document.js";
import { authMiddleware } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import fs from "fs";

const router = express.Router();

router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "File required" });
      }

      const db = mongoose.connection.db;
      const bucket = new mongoose.mongo.GridFSBucket(db, {
        bucketName: "documents",
      });

      const uploadStream = bucket.openUploadStream(req.file.originalname);

      fs.createReadStream(req.file.path)
        .pipe(uploadStream)
        .on("finish", async () => {
          // 🔥 Save metadata only
          const doc = await Document.create({
            docName: req.body.docName,
            fileId: uploadStream.id,
            originalName: req.file.originalname,
            contentType: req.file.mimetype,
            user: req.user.id,
          });

          // 🧹 remove temp file
          fs.unlinkSync(req.file.path);

          res.json({
            success: true,
            document: doc,
          });
        });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Upload failed" });
    }
  }
);


router.get("/", authMiddleware, async (req, res) => {
  const docs = await Document.find().sort({ createdAt: -1 });
  res.json(docs);
});

router.get("/file/:id", authMiddleware, async (req, res) => {
  const bucket = new mongoose.mongo.GridFSBucket(
    mongoose.connection.db,
    { bucketName: "documents" }
  );

  bucket.openDownloadStream(
    new mongoose.Types.ObjectId(req.params.id)
  ).pipe(res);
});


export default router;
