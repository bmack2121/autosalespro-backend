import express from "express";
import axios from "axios";
// ✅ FIX: Adding the protect middleware to secure your API costs
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * @desc    VIN History Lookup
 * @access  Private
 */
router.post("/lookup", protect, async (req, res) => {
  const { vin } = req.body;

  // 🛡️ Safety check for VIN presence
  if (!vin) {
    return res.status(400).json({ message: "VIN is required for Carfax lookup." });
  }

  // If no API key, return manual mode
  if (!process.env.CARFAX_API_KEY || process.env.CARFAX_API_KEY === "your_key_here") {
    return res.json({
      manual: true,
      message: "Carfax API key not configured in .env"
    });
  }

  try {
    const response = await axios.get(
      `https://api.carfax.com/v1/report?vin=${vin}&key=${process.env.CARFAX_API_KEY}`,
      { timeout: 5000 } // Don't let the server hang if Carfax is slow
    );

    res.json(response.data);
  } catch (err) {
    // We log the real error on the server for you to see...
    console.error("Carfax API Error:", err.message);
    
    // ...but we tell the frontend to use manual mode so the salesperson can keep working
    res.json({
      manual: true,
      message: "Carfax API unavailable. Use Carfax Online."
    });
  }
});

export default router;