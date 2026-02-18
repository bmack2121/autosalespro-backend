import express from "express";
// ✅ FIX: Use the named import { protect } to match your fixed middleware
import { protect } from "../middleware/auth.js"; 
import { decodeVin, getMarketValue } from "../controllers/vinController.js";

const router = express.Router();

// ✅ FIX: Apply 'protect' instead of 'auth'
// This ensures only authorized staff can run VIN decodes (saving you API costs!)
router.use(protect);

// VIN decode
router.get("/decode/:vin", decodeVin);

// Market value lookup
router.get("/market-value/:vin", getMarketValue);

export default router;