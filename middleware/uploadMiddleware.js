import multer from "multer";
import path from "path";
import fs from "fs";

// 🛠️ Storage Engine Logic
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 1. Map fields to their respective folders
    let folder = "uploads/vehicles";
    if (file.fieldname === "walkaround") folder = "uploads/videos";
    if (file.fieldname === "carfax") folder = "uploads/carfax";
    
    // ✅ FIX: Anchor the path to the project root so it never writes to the wrong place
    const absolutePath = path.join(process.cwd(), folder);
    
    if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true });
    }
    
    cb(null, absolutePath);
  },
  filename: (req, file, cb) => {
    // ✅ FIX: Sanitize the fallback stockNumber to ensure no spaces or weird characters 
    // break the file system if the FormData fields arrive out of order.
    const rawStock = req.body.stockNumber || "VINPRO";
    const cleanStock = rawStock.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Force lowercase extension to prevent .JPG vs .jpg mismatches later
    const ext = path.extname(file.originalname).toLowerCase();
    
    cb(null, `${cleanStock}-${uniqueSuffix}${ext}`);
  }
});

// 🛡️ Strict File Filter (Security)
const fileFilter = (req, file, cb) => {
  // ✅ FIX: Strict routing prevents cross-contamination of file types
  if (file.fieldname === "walkaround") {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Upload Rejected: Walkaround must be a valid video file."), false);
    }
  } else if (file.fieldname === "carfax") {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Upload Rejected: Carfax reports must be PDF format."), false);
    }
  } else {
    // Default fallback is for the "photos" array
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error(`Upload Rejected: ${file.fieldname} requires an image file.`), false);
    }
  }
};

export const uploadMedia = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit protects against memory bloat
  fileFilter: fileFilter
});