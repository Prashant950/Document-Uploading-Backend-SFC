import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

export const authMiddleware = async (req, res, next) => {
  try {
    // ✅ Support token from both header AND query param (for mobile)
    let token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      token = req.query.token; // 🔥 Mobile apps send via query param
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId;
    req.role = decoded.role;
    req.orgId = decoded.orgId;

    // Backfill orgId from DB when token doesn't include it (support older tokens)
    if (!req.orgId) {
      if (decoded.role === "admin") {
        const admin = await Admin.findById(decoded.userId);
        req.orgId = admin?.orgId || null;
      } else if (decoded.role === "user") {
        const user = await User.findById(decoded.userId);
        req.orgId = user?.orgId || null;
      }
    }
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid Token" });
  }
};

export const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const admin = await Admin.findById(decoded.userId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    req.admin = admin;
    req.orgId = decoded.orgId || admin.orgId || null;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};


export const userMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.role !== "user") {
      return res.status(403).json({ message: "User access required" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isApproved) {
      return res.status(403).json({ message: "User not approved" });
    }

    req.userId = user._id;
    req.role = decoded.role;
    req.orgId = decoded.orgId || user.orgId || null;

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid Token" });
  }
};

