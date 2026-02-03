// import express from "express";
// import mongoose from "mongoose";
// import Document from "../models/Document.js";
// import { authMiddleware } from "../middleware/auth.js";
// import { upload } from "../middleware/upload.js";
// import fs from "fs";

// const router = express.Router();


// router.post("/upload", authMiddleware, upload.array("files", 10),async (req, res) => {
//     try {
//       const bucket = new mongoose.mongo.GridFSBucket(
//         mongoose.connection.db,
//         { bucketName: "documents" }
//       );

//       const uploadPromises = req.files.map((f) => {
//         return new Promise((resolve, reject) => {
//           const uploadStream = bucket.openUploadStream(f.originalname);

//           fs.createReadStream(f.path)
//             .pipe(uploadStream)
//             .on("finish", async () => {
//               const doc = await Document.create({
//                 docName: req.body.docName,
//                 docKey: req.body.docKey || "OTHER",
//                 fileId: uploadStream.id,
//                 originalName: f.originalname,
//                 contentType: f.mimetype,
//                 user: req.userId,
//               });

//               fs.unlinkSync(f.path);
//               resolve(doc);
//             })
//             .on("error", reject);
//         });
//       });

//       const documents = await Promise.all(uploadPromises);

//       res.status(201).json({
//         success: true,
//         count: documents.length,
//         documents,
//       });
//     } catch (err) {
//       res.status(500).json({ message: "Upload failed" });
//     }
//   }
// );


// router.get("/", authMiddleware, async (req, res) => {
//   try{
//   const docs = await Document.find({ user: req.userId }).sort({ createdAt: -1 });
//   res.json(docs);
// } catch (error) {
//   console.error(error);
//   res.status(500).json({ message: "Server error" });
// } 
// });


// router.delete("/:id", authMiddleware, async (req, res) => {
//   try {
//     const doc = await Document.findById(req.params.id);
//     if (!doc) return res.status(404).json({ message: "Not found" });

//     const bucket = new mongoose.mongo.GridFSBucket(
//       mongoose.connection.db,
//       { bucketName: "documents" }
//     );

//     await bucket.delete(doc.fileId);
//     await doc.deleteOne();

//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ message: "Delete failed" });
//   }
// });

// router.get("/download/:id", authMiddleware, async (req, res) => {
//   const doc = await Document.findById(req.params.id);
//   res.set("Content-Type", doc.contentType);
//   res.set("Content-Disposition", `attachment; filename="${doc.originalName}"`);
//   const bucket = new mongoose.mongo.GridFSBucket(
//     mongoose.connection.db,
//     { bucketName: "documents" }
//   );
//   bucket.openDownloadStream(doc.fileId).pipe(res);
// });

// router.get("/view/:id",authMiddleware,async (req, res) => {
//     try {
//       const doc = await Document.findById(req.params.id);
//       if (!doc) return res.status(404).json({ message: "Not found" });

//       const bucket = new mongoose.mongo.GridFSBucket(
//         mongoose.connection.db,
//         { bucketName: "documents" }
//       );

//       res.set("Content-Type", doc.contentType);
//       res.set("Content-Disposition", `inline; filename="${doc.originalName}"`);

//       bucket
//         .openDownloadStream(doc.fileId)
//         .pipe(res);

//     } catch (err) {
//       res.status(500).json({ message: "View failed" });
//     }
//   }
// );

// router.get("share/:id", authMiddleware, async (req, res) => {
//   const doc = await Document.findById(req.params.id);
//   res.set("Content-Type", doc.contentType);
//   res.set("Content-Disposition", `attachment; filename="${doc.originalName}"`);
//   const bucket = new mongoose.mongo.GridFSBucket(
//     mongoose.connection.db,
//     { bucketName: "documents" }
//   );
//   bucket.openDownloadStream(doc.fileId).pipe(res);
// });









// router.get("/file/:id", authMiddleware, async (req, res) => {
//   const doc = await Document.findById(req.params.id);

//   const bucket = new mongoose.mongo.GridFSBucket(
//     mongoose.connection.db,
//     { bucketName: "documents" }
//   );

//   res.set("Content-Type", doc.contentType);

//   bucket.openDownloadStream(doc.fileId).pipe(res);
// });




// export default router;
