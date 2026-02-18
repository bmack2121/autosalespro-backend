import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

// ✅ Middleware Imports
import { protect } from "../middleware/auth.js"; 
import { admin } from "../middleware/admin.js"; 

// ✅ Controllers
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addDeal,
  updateContact,
  updateFollowUp,
  assignCustomer,
  uploadVideo
} from "../controllers/customerController.js";

// ✅ Deal Controller Integration
import { createLeadFromScan, runSoftPull } from "../controllers/dealController.js";

const router = express.Router();

/* -------------------------------------------
 * 🛠️ Multer Configuration (Digital Walkthroughs)
 * ----------------------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Using relative pathing compatible with your server.js setup
    const dir = "./uploads/videos/";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Clean filename to prevent issues with special characters in IDs
    const safeId = req.params.id.replace(/[^a-z0-9]/gi, '_');
    cb(
      null,
      `walkthrough-${safeId}-${Date.now()}${path.extname(file.originalname)}`
    );
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for 4K mobile walkthroughs
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed!"), false);
    }
  }
});

/* -------------------------------------------
 * 🚀 Routes (Sales & Pipeline)
 * ----------------------------------------- */

/**
 * ⭐ Sales Weapon Endpoints
 * These support the DL Scanner and the Soft Pull UI
 */
// @route   POST /api/customers/scan-dl
router.post("/scan-dl", protect, createLeadFromScan);

// @route   POST /api/customers/:id/soft-pull
router.post("/:id/soft-pull", protect, runSoftPull);

// ⭐ Base Customer Access
router.route("/")
  .get(protect, getCustomers)
  .post(protect, createCustomer);

// ⭐ Single Customer Intelligence
router.route("/:id")
  .get(protect, getCustomer)
  .put(protect, updateCustomer)
  .delete(protect, protect, admin, deleteCustomer); // Only Admins can purge leads

// ⭐ Walkthrough Media Engine
// Matches the "video" key used in your frontend FormData
router.post("/:id/video", protect, upload.single("video"), uploadVideo);

// ⭐ Sales Actions & Desking
router.post("/:id/add-deal", protect, addDeal);
router.post("/:id/contact", protect, updateContact);
router.post("/:id/followup", protect, updateFollowUp);

// ⭐ Admin-Only: Lead Re-assignment
router.patch("/:id/assign", protect, admin, assignCustomer);

export default router;