import multer from "multer";
import path from "path";
import fs from "fs";

// 🛠️ Storage Engine Logic
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine folder based on fieldname (videos vs vehicle_photos)
    let folder = "uploads/vehicles";
    if (file.fieldname === "walkaround") folder = "uploads/videos";
    if (file.fieldname === "carfax") folder = "uploads/carfax";
    
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    // Standardize: STOCK-TIMESTAMP.extension
    const stockNumber = req.body.stockNumber || "TEMP";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${stockNumber}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// 🛡️ File Filter (Security)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|mp4|mov|quicktime/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Error: Only .jpg, .png, .mp4, and .mov files are allowed!"));
  }
};

export const uploadMedia = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB Limit for 4K Walkarounds
  fileFilter: fileFilter
});