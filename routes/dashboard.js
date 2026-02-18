import express from "express";
import Activity from "../models/Activity.js";
import Inventory from "../models/Inventory.js"; 
import Customer from "../models/Customer.js"; 
import Deal from "../models/Deal.js"; 
import { protect } from "../middleware/auth.js"; 

const router = express.Router();

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get high-level dealership KPIs (The "Pulse")
 */
router.get("/stats", protect, async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // ✅ PRO TIP: We use Promise.all to fetch metrics in parallel
    const [activeListings, todaysLeads, pendingDeals, inventoryValuation] = await Promise.all([
      // Count units ready for sale
      Inventory.countDocuments({ status: "available" }),
      
      // Count new customers added since midnight
      Customer.countDocuments({ createdAt: { $gte: startOfToday } }),
      
      // Count deals currently being worked in the pipeline
      Deal.countDocuments({ status: { $in: ["pending", "pending_manager"] } }),

      // Sum of MSRP for available units (Inventory Health)
      Inventory.aggregate([
        { $match: { status: "available" } },
        { $group: { _id: null, total: { $sum: "$price" } } }
      ])
    ]);

    res.json({
      activeListings,
      todaysLeads,
      pendingDeals,
      inventoryValue: inventoryValuation[0]?.total || 0,
      avgDaysOnLot: 12 // Logic to be implemented with arrivalDate field
    });
  } catch (err) {
    console.error("🔥 Dashboard Stats Error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard metrics" });
  }
});

/**
 * @route   GET /api/dashboard/activity
 * @desc    Get live audit trail (The "Feed")
 */
router.get("/activity", protect, async (req, res) => {
  try {
    const { category, level, limit = 20 } = req.query;

    let filter = {};
    if (category) filter.category = category;
    if (level) filter.level = level;

    // ✅ If the user is 'sales', only show their activity? 
    // Usually, we want the whole lot feed for the 'Pulse' effect.
    const activity = await Activity.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("user", "name role")
      .populate("inventory", "year make model stockNumber photo") // Added photo for the feed
      .populate("customer", "firstName lastName")
      .populate("deal", "status");

    res.json(activity);
  } catch (err) {
    console.error("🔥 Activity Feed Sync Error:", err);
    res.status(500).json({ error: "Failed to synchronize live lot activity" });
  }
});

export default router;