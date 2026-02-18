import axios from 'axios';

// ✅ Existing Auto-Complete
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
    res.status(500).json({ message: "Auto-complete failed", error: error.message });
  }
};

// ✅ NEW: Market Value Lookup
export const getMarketValue = async (req, res) => {
  try {
    const { vin } = req.params;
    if (!vin) return res.status(400).json({ message: "VIN is required" });

    // MarketCheck 'active' search gives us the current market averages
    const response = await axios.get(`https://marketcheck-prod.apigee.net/v2/search/car/active`, {
      params: {
        api_key: process.env.MARKETCHECK_API_KEY,
        vin: vin,
        include_stats: 'y' // This gives us the mean, median, and mileage averages
      }
    });

    // We extract the stats object which contains the market averages
    const stats = response.data.stats || {};
    
    res.status(200).json({
      vin: vin,
      market_average: stats.mean_price || 0,
      market_median: stats.median_price || 0,
      avg_days_on_market: stats.avg_dom || 0,
      total_listings_found: response.data.num_found || 0
    });
  } catch (error) {
    console.error("Market Value Error:", error.message);
    res.status(500).json({ message: "Market sync failed" });
  }
};