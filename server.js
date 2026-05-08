import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { initDB } from "./src/db/init.js";
import userRoutes from "./src/routes/user.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import userDocumentRoutes from "./src/routes/userDocument.routes.js";
import { config } from "./src/config/config.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user/documents", userDocumentRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// 🔧 DEBUG ENDPOINT - Remove in production
app.get("/debug/jwt-test", (req, res) => {
  try {
    // Check if JWT_SECRET is configured
    if (!config.jwtSecret) {
      return res.status(500).json({ 
        status: "ERROR",
        message: "JWT_SECRET is not configured in .env file",
        config: {
          port: config.port,
          jwtSecret: "NOT SET"
        }
      });
    }

    // Create a test token
    const testPayload = { userId: "test123", role: "user", orgId: "org123" };
    const testToken = jwt.sign(testPayload, config.jwtSecret, { expiresIn: "1h" });

    // Verify the test token
    const decoded = jwt.verify(testToken, config.jwtSecret);

    res.json({
      status: "OK",
      message: "JWT configuration is working correctly",
      config: {
        port: config.port,
        jwtSecret: config.jwtSecret ? "SET (length: " + config.jwtSecret.length + ")" : "NOT SET",
        mongoUri: config.mongoUri ? "SET" : "NOT SET"
      },
      test: {
        created_token: testToken,
        verified_payload: decoded,
        expiry: "1 hour"
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "JWT verification failed",
      error: error.message
    });
  }
});

// Initialize database
initDB();

// Start server
app.listen(config.port, () =>
  console.log(`🚀 Server running on port ${config.port}`)
);
