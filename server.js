import express from "express";
import cors from "cors";
import { initDB } from "./src/db/init.js";
import pinRoutes from "./src/routes/pin.routes.js";
import docRoutes from "./src/routes/document.routes.js";
import { config } from "./src/config/config.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/pin", pinRoutes);
app.use("/api/documents", docRoutes);

initDB();

app.listen(config.port, () =>
  console.log(`🚀 Server running on port ${config.port}`)
);
