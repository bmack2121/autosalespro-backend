import express from "express";
import { protect } from "../middleware/auth.js"; 
import { uploadMedia } from "../middleware/uploadMiddleware.js"; 

import {
  getInventory,
  getVehicleById, 
  createInventory,
  updateInventory,
  deleteInventory,
  uploadVehicleImage, // ✅ Now provided by controller
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

/* -------------------------------------------
 * 📊 UTILITY & EXTERNAL API ROUTES
 * (Static routes defined first to avoid :id collisions)
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
router.post("/", createInventory);    

/* -------------------------------------------
 * 🛠️ INDIVIDUAL UNIT ROUTES
 * ----------------------------------------- */
router.route("/:id")
  .get(getVehicleById)     
  .put(updateInventory)    
  .patch(updateInventory) 
  .delete(deleteInventory);

/* -------------------------------------------
 * 📷 MEDIA & WALKTHROUGH ASSETS
 * ----------------------------------------- */

// 1. High-Performance Multi-Part Upload (Photos & 4K Video)
// uploadMedia processes the files, then passes req.files to updateInventory
router.post("/:id/media", 
  uploadMedia.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'walkaround', maxCount: 1 }
  ]), 
  updateInventory
);

// 2. Legacy Base64 Upload
// Direct Base64 string processing from Capacitor Camera
router.post("/:id/image", uploadVehicleImage);

export default router;