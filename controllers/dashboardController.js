import Activity from "../models/Activity.js";
import Customer from "../models/Customer.js";
import Deal from "../models/Deal.js";
import Inventory from "../models/Inventory.js";

export const getDashboardData = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 🚦 Parallel Execution: Syncing lot metrics and the Live Activity Feed
    const [
      newLeadsToday,
      activeDeals,
      lotInventory,
      recentActivity,
      inventoryIntel
    ] = await Promise.all([
      // 1. Leads Captured Today
      Customer.countDocuments({ createdAt: { $gte: today } }),
      
      // 2. Deals currently in "Pencil" or "Manager Review"
      Deal.countDocuments({ status: { $in: ["pending", "pending_manager"] } }),
      
      // 3. Available Inventory Count
      Inventory.countDocuments({ status: "available" }),
      
      // 4. The Pulse Feed (Populated for instant lot awareness)
      Activity.find()
        .populate("user", "name role")
        .populate("customer", "firstName lastName")
        .populate("inventory", "year make model")
        .sort({ createdAt: -1 })
        .limit(15),

      // 5. Market Intelligence Aggregation
      Inventory.aggregate([
        { $match: { status: "available" } },
        { 
          $group: { 
            _id: null, 
            totalLotValue: { $sum: "$price" },
            // ✅ FIX: Calculate variance manually (Price vs MarketAverage) since virtuals aren't available in aggregate
            avgMarketVariance: { 
              $avg: { 
                $subtract: ["$price", "$marketAverage"] 
              } 
            },
            // ✅ FIX: Using 'createdAt' (or 'dateAdded' if verified) for aging calculation
            avgAging: { 
              $avg: { 
                $divide: [
                  { $subtract: [new Date(), "$createdAt"] }, 
                  (1000 * 60 * 60 * 24)
                ] 
              } 
            }
          } 
        }
      ])
    ]);

    // 📈 Pipeline Value (Total Gross of all pending deal structures)
    const pipelineValue = await Deal.aggregate([
      { $match: { status: { $in: ["pending", "pending_manager"] } } },
      { $group: { _id: null, total: { $sum: "$structure.salePrice" } } }
    ]);

    // 🏆 Market Health Indicators
    const lotHealth = inventoryIntel[0] || { totalLotValue: 0, avgMarketVariance: 0, avgAging: 0 };

    res.json({
      stats: {
        newLeadsToday,
        activeDeals,
        unitsOnLot: lotInventory,
        pipelineValue: pipelineValue[0]?.total || 0,
        totalLotValue: lotHealth.totalLotValue,
        avgAging: Math.round(lotHealth.avgAging || 0),
        // Score based on whether the lot is priced below or above market average
        marketHealthScore: lotHealth.avgMarketVariance < 0 ? "Aggressive" : "Competitive"
      },
      feed: recentActivity
    });
  } catch (err) {
    console.error("🔥 VinPro Engine: Dashboard Sync Error:", err);
    res.status(500).json({ message: "VinPro Engine: Failed to sync command center data" });
  }
};