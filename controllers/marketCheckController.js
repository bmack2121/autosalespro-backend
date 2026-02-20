import axios from 'axios';

// ✅ Fixed Auto-Complete
export const getAutoComplete = async (req, res) => {
  try {
    const { term } = req.query;
    if (!term) return res.status(400).json({ message: "Search term is required" });

    const response = await axios.get('https://api.marketcheck.com/v2/search/car/auto-complete', {
      params: {
        api_key: process.env.MARKETCHECK_API_KEY,
        host_id: process.env.MARKETCHECK_HOST_ID,
        term: term
      }
    });
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Auto-complete Error:", error.message);
    res.status(500).json({ message: "Auto-complete failed", error: error.message });
  }
};

// ✅ Fixed Market Value Lookup (Migrated from Apigee to api.marketcheck.com)
export const getMarketValue = async (req, res) => {
  try {
    const { vin } = req.params;
    if (!vin) return res.status(400).json({ message: "VIN is required" });

    // ✅ FIXED: Updated URL to the current 2026 production host
    const response = await axios.get(`https://api.marketcheck.com/v2/search/car/active`, {
      params: {
        api_key: process.env.MARKETCHECK_API_KEY,
        vin: vin,
        include_stats: 'y' 
      }
    });

    // MarketCheck returns stats inside the 'stats' object of the response
    const stats = response.data.stats || {};
    
    // Some versions of the API nest price stats under 'price' or 'mean'
    res.status(200).json({
      vin: vin,
      market_average: stats.price?.mean || stats.mean_price || 0,
      market_median: stats.price?.median || stats.median_price || 0,
      avg_days_on_market: stats.dom?.mean || stats.avg_dom || 0,
      total_listings_found: response.data.num_found || 0
    });
  } catch (error) {
    // Detailed logging to catch any new API shifts
    console.error("🔥 VinPro Market Sync Error:", error.response?.data || error.message);
    res.status(500).json({ 
      message: "Market sync failed", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
};