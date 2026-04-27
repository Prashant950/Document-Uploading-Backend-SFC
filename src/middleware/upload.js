import multer from "multer";
import path from "path";
import os from "os";
//const { CloudinaryStorage } = require('multer-storage-cloudinary');
import { CloudinaryStorage } from "multer-storage-cloudinary";
//const cloudinary = require("../config/Cloudnary");
import cloudinary from "../config/Cloudnary.js";

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, os.tmpdir()); // System temp folder
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
//   },
// });
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Document_uploads", // Optional: specify a folder in Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "mp4", "mpeg", "quicktime", "avi", "wmv", "webm"],
    public_id: (req, file) => Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname),
  },
});

// File filter for documents and videos
const fileFilter = (req, file, cb) => {
  // Allow documents and videos
  const allowedMimes = [
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    // Videos
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-ms-wmv",
    "video/webm",
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 1024 * 5, // 5GB max file size
  },
});

// export const uploadWithLogging = (req, res, next) => {
//   upload.fields([{ name: "file", maxCount: 1 }])(req, res, (err) => {
//     if (err) {
//       console.error("Error uploading file:", err);
//       return res.status(400).json({ error: err.message });
//     }
//     next();
//   });
// };
export const uploadWithLogging = (req, res, next) => {
  upload.array("files", 50)(req, res, (err) => {
    if (err) {
      console.error("Error uploading file:", err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};