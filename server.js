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
 * 1. Directory Initialization
 * ----------------------------------------- */
const uploadFolders = ["uploads/videos", "uploads/vehicles", "uploads/carfax", "uploads/profiles"];
uploadFolders.forEach(folder => {
  const fullPath = path.join(__dirname, folder);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

/* -------------------------------------------
 * 2. Middleware & Security
 * ----------------------------------------- */
app.use(helmet({ 
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false 
})); 

// ✅ The "Golden List" for VinPro 2026 Mobile & Web
const allowedOrigins = [
  'http://localhost:3000',    // Local Web Browser
  'http://localhost:8100',    // Ionic/Capacitor Dev Server
  'capacitor://localhost',    // Capacitor iOS
  'http://localhost',         // Capacitor Android
  'app://localhost'           // Legacy iOS Webview fallback
];

app.use(cors({
  origin: (origin, callback) => {
    // 💡 Allow tools like Postman (!origin), defined origins, OR dynamic local LAN IPs
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://192.168.')) {
      callback(null, true);
    } else {
      console.warn(`🚨 VinPro CORS Blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(morgan("dev"));
app.use(express.json({ limit: "100mb" })); 
app.use(express.urlencoded({ limit: "100mb", extended: true }));

/* -------------------------------------------
 * 3. Socket.io (The Pulse)
 * ----------------------------------------- */
const io = new Server(httpServer, {
  cors: {
    // ✅ Use true to safely mirror the dynamically accepted Express CORS origin
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  },
  // ✅ Crucial for Mobile: Prevents the server from dropping the connection 
  // immediately if the salesman walks behind a concrete wall.
  pingInterval: 25000, 
  pingTimeout: 60000,
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`📡 Pulse Connected: ${socket.id}`);
  socket.on("disconnect", (reason) => console.log(`🔌 Pulse Disconnected: ${reason}`));
});

/* -------------------------------------------
 * 4. Static File Serving
 * ----------------------------------------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res) => {
    // Use "*" here only for static assets where credentials aren't required
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

app.get("/api/ping", (req, res) => {
  res.json({ status: "online", engine: "VinPro v8.2", time: new Date() });
});

/* -------------------------------------------
 * 6. Error Handling & Server Start
 * ----------------------------------------- */
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack);
  res.status(err.status || 500).json({
    message: "VinPro Engine Error",
    error: process.env.NODE_ENV === "development" ? err.message : "Internal Error"
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 VinPro Engine Online | Listening on Port ${PORT}`);
});