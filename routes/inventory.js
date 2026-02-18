import express from "express";
import { protect } from "../middleware/auth.js"; 

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
 * This protects your inventory "Cost" and "Pack" data from public eyes.
 */
router.use(protect);

/* -------------------------------------------
 * 📊 UTILITY & EXTERNAL API ROUTES
 * (Static names come first to avoid :id collisions)
 * ----------------------------------------- */
router.get("/export", exportInventory);
router.get("/decode/:vin", decodeVin);      // 🚀 Step 3: VIN Scanner for Appraisal
router.get("/carfax/:vin", getCarfaxReport); // 🚀 Step 5: E-Brochure Integration

/* -------------------------------------------
 * 📦 BULK & AGGREGATE OPERATIONS
 * ----------------------------------------- */
router.patch("/bulk-update", bulkUpdateInventory);

/* -------------------------------------------
 * 🚗 COLLECTION ROUTES
 * ----------------------------------------- */
router.get("/", getInventory);       
router.post("/", createInventory);    

/* -------------------------------------------
 * 🛠️ INDIVIDUAL UNIT ROUTES
 * ----------------------------------------- */
router.route("/:id")
  .get(getVehicleById)     // Fetches specs for the Four-Square DealSheet
  .put(updateInventory)    // Updates reconditioning costs post-appraisal
  .delete(deleteInventory);

// Dedicated endpoint for vehicle photos (Step 3: Damage documentation)
router.post("/:id/image", uploadVehicleImage);

export default router;