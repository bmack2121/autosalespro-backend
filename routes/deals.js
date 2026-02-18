import express from "express";
import { protect } from "../middleware/auth.js"; 

import {
  createDeal,
  getDeals,
  updateDealStatus,
  commitToManager 
} from "../controllers/dealController.js";

const router = express.Router();

/**
 * All Deal routes require a logged-in user (Sales or Manager)
 */
router.use(protect);

// ⭐ GET all deals (Role-based filtering handled in Controller)
// Sales see their own; Managers see the whole "Tower"
router.get("/", getDeals);

// ⭐ CREATE / SAVE PENCIL
// Handles the Four-Square structure, Trade-In ACV, and Inventory linking
router.post("/", createDeal);

// ⭐ UPDATE deal status (General status changes: "In Progress", "Lost", etc.)
router.patch("/:id/status", updateDealStatus);

// ⭐ COMMIT TO MANAGER (The Closer)
// Specialized route for the "Send to Tower" button in the app
// We use PATCH because we are updating the state of an existing deal
router.patch("/:id/commit", commitToManager);

export default router;