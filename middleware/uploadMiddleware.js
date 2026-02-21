import multer from "multer";
import path from "path";
import fs from "fs";

// 🛠️ Storage Engine Logic
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 1. Map fields to their respective folders inside a public directory
    let folder = "public/uploads/vehicles";
    if (file.fieldname === "walkaround") folder = "public/uploads/videos";
    if (file.fieldname === "carfax") folder = "public/uploads/carfax";
    
    // Anchor the path to the project root
    const absolutePath = path.join(process.cwd(), folder);
    
    // Ensure the directory exists (Synchronous is fine here as it only runs once per upload)
    if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true });
    }
    
    cb(null, absolutePath);
  },
  filename: (req, file, cb) => {
    // 🛡️ FIX: If stockNumber isn't in req.body yet (due to field order), 
    // we fallback to the ID from the URL params.
    const rawIdentifier = req.body.stockNumber || req.params.id || "VINPRO";
    const cleanStock = rawIdentifier.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    
    // Force lowercase extension
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    
    cb(null, `${cleanStock}-${uniqueSuffix}${ext}`);
  }
});

// 🛡️ Strict File Filter (Security)
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "walkaround") {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Walkaround must be a valid video.")); 
    }
  } else if (file.fieldname === "carfax") {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Carfax reports must be PDF format."));
    }
  } else {
    // photos array
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error(`${file.fieldname} requires an image file.`));
    }
  }
};

export const uploadMedia = multer({
  storage: storage,
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB
    fieldSize: 25 * 1024 * 1024  // 25MB for large Base64 text fields if needed
  },
  fileFilter: fileFilter
});