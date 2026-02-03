import express from "express";
import cors from "cors";
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

// Initialize database
initDB();

// Start server
app.listen(config.port, () =>
  console.log(`🚀 Server running on port ${config.port}`)
);
