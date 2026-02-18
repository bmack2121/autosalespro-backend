import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import cron from "node-cron";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

// Config & DB
import connectDB from "./config/db.js";

// Routes
import authRoutes from "./routes/auth.js";
import customerRoutes from "./routes/customers.js";
import inventoryRoutes from "./routes/inventory.js"; 
import dealsRoutes from "./routes/deals.js";
import tasksRoutes from "./routes/tasks.js";
import dashboardRoutes from "./routes/dashboard.js";
import marketCheckRoutes from "./routes/marketCheckRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
const httpServer = createServer(app);

// Initialize Database
connectDB();

/* -------------------------------------------
 * 1. Directory Initialization (Automated)
 * Ensures storage is ready for media and reports
 * ----------------------------------------- */
const uploadFolders = [
  "uploads/videos",
  "uploads/vehicles",
  "uploads/carfax",
  "uploads/profiles"
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
app.use(helmet({ 
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false 
})); 

// ✅ Expanded Allowed Origins for local, mobile, and IP-based access
const allowedOrigins = [
  'http://localhost:3000',  
  'http://localhost:8100', 
  'http://192.168.0.73:3000',
  'capacitor://localhost',
  'http://localhost'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('capacitor://')) {
      callback(null, true);
    } else {
      console.warn(`🚨 CORS Blocked Origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(morgan("dev"));
app.use(express.json({ limit: "100mb" })); // High limit for Base64 VIN photos
app.use(express.urlencoded({ limit: "100mb", extended: true }));

/* -------------------------------------------
 * 3. Socket.io Initialization (The Pulse)
 * Powers real-time lot updates
 * ----------------------------------------- */
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
});

// Attach io to app so it can be accessed in controllers via req.app.get("io")
app.set("io", io);

io.on("connection", (socket) => {
  console.log(`📡 Pulse Connected: ${socket.id}`);
  socket.on("disconnect", () => console.log("🔌 Pulse Disconnected"));
});

/* -------------------------------------------
 * 4. Static File Serving (Vehicle Media)
 * ----------------------------------------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "1d",
  setHeaders: (res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
  }
}));

/* -------------------------------------------
 * 5. API Routes
 * ----------------------------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/deals", dealsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/marketcheck", marketCheckRoutes);

/* -------------------------------------------
 * 6. Health & Maintenance
 * ----------------------------------------- */
app.get("/api/ping", (req, res) => {
  res.json({ 
    status: "online", 
    engine: "VinPro v8.2",
    node: process.version,
    time: new Date() 
  });
});

// Weekly lot data cleanup / report generation
cron.schedule("0 0 * * 0", () => {
  console.log("🧹 Running VinPro Engine Maintenance...");
});

/* -------------------------------------------
 * 7. Error Handling
 * ----------------------------------------- */
app.use((err, req, res, next) => {
  console.error("🔥 VinPro Internal Error:", err.stack);
  res.status(err.status || 500).json({
    message: "VinPro Engine Error",
    error: process.env.NODE_ENV === "development" ? err.message : "Internal Error"
  });
});

/* -------------------------------------------
 * 8. Start Server
 * ----------------------------------------- */
const PORT = process.env.PORT || 5000;
const server = httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`
  🚀 VinPro Engine Online
  📡 LAN Access: http://192.168.0.73:${PORT}
  📡 API Base:   http://192.168.0.73:${PORT}/api
  🛠️  Mode:       ${process.env.NODE_ENV || "development"}
  `);
});

// Set timeout to 5 minutes to handle heavy 4K walkaround video uploads
server.timeout = 300000;