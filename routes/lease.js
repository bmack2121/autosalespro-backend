import express from "express";
// ✅ FIX 1: Use curly braces { protect } to match the export in auth.js
import { protect } from "../middleware/auth.js"; 

import {
  calculateLease,
  compareLeaseTerms
} from "../controllers/leaseController.js";

const router = express.Router();

// ✅ FIX 2: Use 'protect' instead of 'auth'
// This keeps your proprietary lease math secured behind a login
router.use(protect);

// Single-term lease calculation
router.post("/calculate", calculateLease);

// Multi-term comparison
router.post("/compare", compareLeaseTerms);

export default router;