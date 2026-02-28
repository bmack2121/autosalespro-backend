import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
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

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Initialize Database
connectDB();

/* -------------------------------------------
 * 1. Directory Initialization
 * ----------------------------------------- */
const uploadFolders = [
  "public/uploads/videos", 
  "public/uploads/vehicles", 
  "public/uploads/carfax", 
  "public/uploads/profiles"
];

uploadFolders.forEach(folder => {
  const fullPath = path.join(process.cwd(), folder);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`📁 Created folder: ${fullPath}`);
  }
});

/* -------------------------------------------
 * 2. Shared CORS Configuration (Cloud Optimized)
 * ----------------------------------------- */
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8100',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'app://localhost',
  'https://autosalespro-frontend.onrender.com' // ✅ Allow your cloud frontend
];

const originCheck = (origin, callback) => {
  // 📱 Mobile apps often send no origin or specific protocols. 
  // We allow null origins and our whitelist.
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    // During the transition, we log blocked origins instead of crashing
    console.warn(`🚨 VinPro CORS Blocked: ${origin}`);
    callback(null, true); 
  }
};

/* -------------------------------------------
 * 3. Middleware & Security
 * ----------------------------------------- */
app.use(helmet({ 
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false 
})); 

app.use(cors({
  origin: originCheck,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(morgan("dev"));
app.use(express.json({ limit: "100mb" })); 
app.use(express.urlencoded({ limit: "100mb", extended: true }));

/* -------------------------------------------
 * 4. Socket.io (The Pulse - Cloud Hardened)
 * ----------------------------------------- */
const io = new Server(httpServer, {
  path: "/socket.io/", 
  cors: {
    origin: "*", // ✅ Required for production mobile handshakes
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true, 
  pingInterval: 25000, 
  pingTimeout: 60000,
  transports: ['websocket', 'polling'] 
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`📡 Pulse Connected: ${socket.id}`);
  
  socket.on("disconnect", (reason) => {
    console.log(`🔌 Pulse Disconnected: ${reason}`);
  });
});

/* -------------------------------------------
 * 5. Static File Serving
 * ----------------------------------------- */
app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads"), {
  setHeaders: (res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
  }
}));

/* -------------------------------------------
 * 6. API Routes
 * ----------------------------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/deals", dealsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/marketcheck", marketCheckRoutes);

app.get("/api/ping", (req, res) => {
  res.json({ status: "online", engine: "VinPro", time: new Date() });
});

/* -------------------------------------------
 * 7. Error Handling & Server Start
 * ----------------------------------------- */
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack);
  res.status(err.status || 500).json({
    message: "VinPro Engine Error",
    error: process.env.NODE_ENV === "development" ? err.message : "Internal Error"
  });
});

// ✅ Render uses process.env.PORT (usually 10000)
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 VinPro Engine Online | Listening on Port ${PORT}`);
});