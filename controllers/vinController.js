import axios from "axios";

/**
 * ⭐ Decode VIN (NHTSA API)
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
        .json({ message: "Invalid VIN structure detected" });
    }

    res.json({
      vin: data.VIN,
      year: data.ModelYear,
      make: data.Make,
      model: data.Model,
      trim: data.Series || data.Trim,
      bodyClass: data.BodyClass,
      fuelType: data.FuelTypePrimary
    });
  } catch (err) {
    console.error("NHTSA Error:", err.message);
    res.status(500).json({ message: "NHTSA decoding service unavailable" });
  }
};

/**
 * ⭐ Market Value Lookup (VinAudit API)
 */
export const getMarketValue = async (req, res) => {
  const { vin } = req.params;
  const apiKey = process.env.VINAUDIT_API_KEY;

  // Mock fallback if no API key
  if (!apiKey || apiKey === "your_key_here") {
    return res.json({
      average_retail: 28500,
      trade_in_value: 24200,
      market_range: { low: 22000, high: 31000 },
      data_points: 15,
      isMock: true
    });
  }

  try {
    const response = await axios.get(
      "https://marketvalue.vinaudit.com/getmarketvalue.php",
      {
        params: {
          key: apiKey,
          vin: vin,
          format: "json",
          period: 90
        }
      }
    );

    if (!response.data || response.data.success === false) {
      return res
        .status(404)
        .json({ message: "Market data not found for this VIN" });
    }

    res.json({
      average_retail: response.data.prices?.average || 0,
      trade_in_value: response.data.prices?.below || 0,
      market_range: {
        low: response.data.prices?.below,
        high: response.data.prices?.above
      },
      data_points: response.data.count,
      isMock: false
    });
  } catch (err) {
    console.error("VinAudit Error:", err.message);
    res.status(500).json({ message: "Market value service unavailable" });
  }
};