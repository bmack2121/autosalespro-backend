import express from "express";
import { protect } from "../middleware/auth.js"; 

import {
  createDeal,
  getDeals,
  updateDealStatus,
  commitToManager // ✅ Added for Step 4 Logic
} from "../controllers/dealController.js";

const router = express.Router();

/**
 * All Deal routes require a logged-in user (Sales or Manager)
 */
router.use(protect);

// ⭐ GET all deals (Role-based filtering handled in Controller)
router.get("/", getDeals);

// ⭐ CREATE / SAVE PENCIL
// Handles the Four-Square structure and Appraisal data
router.post("/", createDeal);

// ⭐ UPDATE deal status (General status changes)
router.put("/:id/status", updateDealStatus);

// ⭐ COMMIT TO MANAGER (The Closer)
// Specialized route for the "I'll Take It" button in the app
router.post("/:id/commit", commitToManager);

export default router;