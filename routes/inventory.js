import express from "express";
import { protect } from "../middleware/auth.js"; 
import { uploadMedia } from "../middleware/uploadMiddleware.js"; 

import {
  getInventory,
  getVehicleById, 
  createInventory,
  updateInventory,
  deleteInventory,
  uploadVehicleImage, 
  exportInventory,
  bulkUpdateInventory,
  decodeVin,
  getCarfaxReport
} from "../controllers/inventoryController.js";

const router = express.Router();

/**
 * 🔒 SECURITY: All inventory actions require a valid login token.
 */
router.use(protect);

// 🛡️ Error-Catching Wrapper for Multer
// Moved up so it can be used in the route definitions below
const handleMediaUpload = (req, res, next) => {
  const upload = uploadMedia.fields([
    { name: 'photos', maxCount: 15 },    
    { name: 'walkaround', maxCount: 1 },
    { name: 'carfax', maxCount: 1 }
  ]);

  upload(req, res, (err) => {
    if (err) {
      if (err.name === 'MulterError') {
        return res.status(400).json({ message: `Upload Error: ${err.message}` });
      }
      return res.status(500).json({ message: 'Server error during file upload.', error: err.message });
    }
    next(); 
  });
};

/* -------------------------------------------
 * 📊 UTILITY & EXTERNAL API ROUTES
 * ----------------------------------------- */
router.get("/export", exportInventory);
router.get("/decode/:vin", decodeVin);      
router.get("/carfax/:vin", getCarfaxReport); 

/* -------------------------------------------
 * 📦 BULK OPERATIONS
 * ----------------------------------------- */
router.patch("/bulk-update", bulkUpdateInventory);

/* -------------------------------------------
 * 🚗 COLLECTION & CORE ROUTES
 * ----------------------------------------- */
router.get("/", getInventory);       
router.post("/", handleMediaUpload, createInventory); // ✅ Enabled for new vehicle creation with photos

/* -------------------------------------------
 * 🛠️ INDIVIDUAL UNIT ROUTES
 * ----------------------------------------- */
router.route("/:id")
  .get(getVehicleById)     
  .put(handleMediaUpload, updateInventory)    // ✅ FIXED: Now catches photos on Sync
  .patch(handleMediaUpload, updateInventory)  // ✅ FIXED: Now catches photos on partial updates
  .delete(deleteInventory);

/* -------------------------------------------
 * 📷 MEDIA & WALKTHROUGH ASSETS (Legacy/Specific Fallbacks)
 * ----------------------------------------- */

// Keep these as dedicated endpoints if your mobile app specifically calls them
router.post("/:id/media", handleMediaUpload, updateInventory);
router.post("/:id/image", uploadVehicleImage);

export default router;