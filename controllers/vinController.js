import axios from "axios";

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

    const data = response.data.Results[0];

    if (data.ErrorCode !== "0") {
      return res
        .status(400)
        .json({ message: `VIN Invalid: ${data.ErrorText}` });
    }

    res.json({
      vin: data.VIN,
      year: data.ModelYear,
      make: data.Make,
      model: data.Model,
      trim: data.Series || data.Trim || "Base",
      bodyClass: data.BodyClass,
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
  const apiKey = process.env.MARKETCHECK_API_KEY;

  // Mock fallback for development if key is missing
  if (!apiKey || apiKey === "your_key_here") {
    return res.json({
      mean_price: 28500,
      msrp: 32000,
      rank: "Fair Price",
      market_range: { low: 26000, high: 31000 },
      isMock: true
    });
  }

  try {
    /**
     * ✅ Using MarketCheck v2 Predict API
     * This provides the most accurate "Market Average" for your variance logic
     */
    const response = await axios.get(
      `https://marketcheck-prod.apigee.net/v2/predict/car/us/marketcheck_price/comparables/decode`,
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
    res.json({
      mean_price: data.predicted_price || data.mean || 0,
      msrp: data.msrp || 0,
      rank: data.price_rank || "Neutral",
      market_range: {
        low: data.range_low,
        high: data.range_high
      },
      // NeoVIN Build Data additions
      build: {
        transmission: data.build?.transmission,
        drive_type: data.build?.drivetrain,
        interior_color: data.build?.interior_color
      },
      isMock: false
    });
  } catch (err) {
    console.error("MarketCheck Error:", err.response?.data || err.message);
    res.status(500).json({ message: "MarketCheck service unavailable" });
  }
};