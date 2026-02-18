import express from "express";
import Activity from "../models/Activity.js";
import Vehicle from "../models/Inventory.js"; 
import Customer from "../models/Customer.js"; 
import { protect } from "../middleware/auth.js"; 

const router = express.Router();

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get high-level dealership KPIs
 */
router.get("/stats", protect, async (req, res) => {
  try {
    // Start of day for local time lead counting
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [activeListings, todaysLeads, pendingDeals] = await Promise.all([
      Vehicle.countDocuments({ status: { $regex: /available/i } }),
      Customer.countDocuments({ createdAt: { $gte: startOfToday } }),
      Vehicle.countDocuments({ status: { $regex: /pending|sold/i } }) // Tracks active deals
    ]);

    res.json({
      activeListings,
      todaysLeads,
      pendingDeals,
      avgDaysOnLot: 14 // Placeholder for future logic
    });
  } catch (err) {
    console.error("🔥 Dashboard Stats Error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard metrics" });
  }
});

/**
 * @route   GET /api/dashboard/activity
 * @desc    Get live audit trail of everything happening on the lot
 */
router.get("/activity", protect, async (req, res) => {
  try {
    const { category, level, limit = 20 } = req.query;

    let filter = {};
    if (category) filter.category = category;
    if (level) filter.level = level;

    const activity = await Activity.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("user", "name role")
      .populate("inventory", "year make model stockNumber")
      .populate("customer", "firstName lastName");

    res.json(activity);
  } catch (err) {
    console.error("🔥 Activity Feed Sync Error:", err);
    res.status(500).json({ error: "Failed to synchronize live lot activity" });
  }
});

export default router;