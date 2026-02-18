import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import cron from "node-cron";
import { fileURLToPath } from "url";

// Config & DB
import connectDB from "./config/db.js";

// Routes
import authRoutes from "./routes/auth.js";
import customerRoutes from "./routes/customers.js";
import inventoryRoutes from "./routes/inventory.js"; 
import dealsRoutes from "./routes/deals.js";
import tasksRoutes from "./routes/tasks.js";
import dashboardRoutes from "./routes/dashboard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

connectDB();

/* -------------------------------------------
 * 1. Directory Initialization (Automated)
 * ----------------------------------------- */
const uploadFolders = [
  "uploads/videos",
  "uploads/vehicles",
  "uploads/carfax"
];

uploadFolders.forEach(folder => {
  const fullPath = path.join(__dirname, folder);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`📁 Initialized Directory: ${folder}`);
  }
});

/* -------------------------------------------
 * 2. Middleware & Security
 * ----------------------------------------- */
// Tailored for Capacitor: Allows image loading from your server IP
app.use(helmet({ 
  crossOriginResourcePolicy: false, 
  crossOriginEmbedderPolicy: false 
})); 

const allowedOrigins = [
  'http://localhost:3000',  
  'http://localhost:8100', 
  'http://192.168.0.73:3000', // Your Desktop/Dev Frontend
  'capacitor://localhost',
  'http://localhost'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚨 CORS Blocked Origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(morgan("dev"));

// Body Parsers: Set limits high for Base64 image uploads and videos
app.use(express.json({ limit: "50mb" })); 
app.use(express.urlencoded({ limit: "50mb", extended: true }));

/* -------------------------------------------
 * 3. Static File Serving (Vehicle Photos)
 * ----------------------------------------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "1d",
  setHeaders: (res) => {
    res.set("Access-Control-Allow-Origin", "*");
  }
}));

/* -------------------------------------------
 * 4. API Routes
 * ----------------------------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/deals", dealsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/dashboard", dashboardRoutes);

/* -------------------------------------------
 * 5. Health & Maintenance
 * ----------------------------------------- */
app.get("/api/ping", (req, res) => {
  res.json({ 
    status: "online", 
    ip: "192.168.0.73",
    time: new Date() 
  });
});

// Weekly cleanup placeholder
cron.schedule("0 0 * * 0", () => {
  console.log("🧹 Running VinPro Engine Maintenance...");
});

/* -------------------------------------------
 * 6. Error Handling
 * ----------------------------------------- */
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack);
  res.status(500).json({
    message: "VinPro Engine Error",
    error: process.env.NODE_ENV === "development" ? err.message : {}
  });
});

/* -------------------------------------------
 * 7. Start Server
 * ----------------------------------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
  🚀 VinPro Engine Online
  📡 LAN IP: http://192.168.0.73:${PORT}
  🛠️  Environment: ${process.env.NODE_ENV || "development"}
  `);
});