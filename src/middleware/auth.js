import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import RefreshToken from "../models/RefreshToken.js";

export const authMiddleware = async (req, res, next) => {
  try {
    // ✅ Support token from both header AND query param (for mobile)
    let token = null;
    
    // 🔍 Try to extract token from Authorization header (Bearer <token>)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader) {
      // Handle both "Bearer token" and just "token"
      token = authHeader.startsWith("Bearer ") 
        ? authHeader.slice(7) 
        : authHeader;
    }
    
    // 🔥 If no header token, try query param (for mobile apps)
    if (!token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
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
    console.error("🔐 AUTH ERROR:", error.message);
    res.status(401).json({ message: "Invalid Token - Token verification failed" });
  }
};

export const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    // Extract token - handle both "Bearer token" and just "token"
    let token = null;
    if (authHeader) {
      token = authHeader.startsWith("Bearer ") 
        ? authHeader.slice(7) 
        : authHeader;
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
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
    console.error("🔐 ADMIN AUTH ERROR:", err.message);
    return res.status(401).json({ message: "Invalid token - Token verification failed" });
  }
};


export const userMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    // Extract token - handle both "Bearer token" and just "token"
    let token = null;
    if (authHeader) {
      token = authHeader.startsWith("Bearer ") 
        ? authHeader.slice(7) 
        : authHeader;
    }
    
    // Also check query param as fallback
    if (!token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.role !== "user") {
      return res.status(403).json({ message: "User access required" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ REMOVED isApproved check from middleware
    // Approval check should happen only in routes that require it (documents, etc.)
    // This allows users to create/confirm PIN even before approval

    req.userId = user._id;
    req.role = decoded.role;
    req.orgId = decoded.orgId || user.orgId || null;

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid Token" });
  }
};

