import axios from "axios";
import NodeCache from "node-cache";

// ✅ Initialize in-memory cache for MarketCheck (24-hour TTL)
const marketCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

/**
 * ⭐ Decode VIN (NHTSA API)
 * Primary source for mechanical specs and safety compliance
 */
export const decodeVin = async (req, res) => {
  const { vin } = req.params;

  try {
    const response = await axios.get(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`
    );

    const data = response.data?.Results?.[0];

    // ✅ FIX: NHTSA often returns "0 - VIN decoded clean"
    // Strict equality (!== "0") will falsely reject valid VINs. Use startsWith!
    if (!data || !data.ErrorCode || !data.ErrorCode.startsWith("0")) {
      return res
        .status(400)
        .json({ message: `VIN Invalid or unreadable: ${data?.ErrorText || "Unknown error"}` });
    }

    res.json({
      vin: data.VIN || vin,
      year: data.ModelYear,
      make: data.Make,
      model: data.Model,
      trim: data.Series || data.Trim || "Base",
      bodyClass: data.BodyClass || "N/A",
      fuelType: data.FuelTypePrimary || "Gasoline",
      driveType: data.DriveType || "N/A",
      engine: data.DisplacementL ? `${data.DisplacementL}L ${data.EngineCylinders}cyl` : "N/A",
      transmission: data.TransmissionStyle || "N/A"
    });
  } catch (err) {
    console.error("NHTSA Error:", err.message);
    res.status(500).json({ message: "NHTSA decoding service unavailable" });
  }
};

/**
 * ⭐ Market Intelligence Lookup (MarketCheck API)
 * Provides Predicted Price, MSRP, and Price Ranking
 */
export const getMarketValue = async (req, res) => {
  const { vin } = req.params;
  
  // ✅ 1. Check Cache First (Saves API Credits & returns instantly)
  const cachedData = marketCache.get(vin);
  if (cachedData) {
    return res.json(cachedData);
  }

  const apiKey = process.env.MARKETCHECK_API_KEY;

  // 2. Mock fallback for development if key is missing
  if (!apiKey || apiKey === "your_key_here") {
    return res.json({
      mean_price: 28500,
      msrp: 32000,
      rank: "Fair Price",
      market_range: { low: 26000, high: 31000 },
      build: { transmission: "N/A", drive_type: "N/A", interior_color: "N/A" },
      isMock: true
    });
  }

  try {
    // ✅ FIX: Corrected the MarketCheck API URL to the standard v2 predict endpoint
    const response = await axios.get(
      `https://api.marketcheck.com/v2/predict/car/us/marketcheck_price`,
      {
        params: {
          api_key: apiKey,
          vin: vin,
          include_build: "true" // Pulls MSRP and Build Data
        }
      }
    );

    const data = response.data;

    // Standardizing the response to match your VinPro Frontend
    const payload = {
      mean_price: data.predicted_price || data.mean || 0,
      msrp: data.msrp || 0,
      rank: data.price_rank || "Neutral",
      market_range: {
        low: data.range_low || 0,
        high: data.range_high || 0
      },
      // NeoVIN Build Data additions (with safe fallbacks)
      build: {
        transmission: data.build?.transmission || "N/A",
        drive_type: data.build?.drivetrain || "N/A",
        interior_color: data.build?.interior_color || "N/A"
      },
      isMock: false
    };

    // ✅ 3. Save to RAM Cache for the next 24 hours
    marketCache.set(vin, payload);

    res.json(payload);
  } catch (err) {
    console.error("MarketCheck Error:", err.response?.data || err.message);
    res.status(500).json({ message: "MarketCheck service unavailable" });
  }
};