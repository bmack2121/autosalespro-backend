import express from 'express';
import rateLimit from 'express-rate-limit';
import { getAutoComplete, getMarketValue } from '../controllers/marketCheckController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * 🛡️ Rate Limiter: Protects your MarketCheck API Credits.
 * Limits each user to 50 market lookups every 15 minutes.
 */
const marketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, 
  message: { message: "Market Intelligence quota reached. Please wait 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔍 Auto-complete for manual searches (Make/Model/Year)
router.get('/autocomplete', protect, getAutoComplete);

/**
 * 📈 Predictive Market Value
 * Fetches Predicted Price, MSRP, and Price Rank using the v2 Engine
 */
router.get('/v2/predict/:vin', protect, marketLimiter, getMarketValue);

export default router;