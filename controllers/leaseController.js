// ⭐ Single Lease Calculation
// Calculates monthly payment for one lease term
export const calculateLease = (req, res) => {
  try {
    const {
      msrp,
      capCost,
      residualPercent,
      moneyFactor,
      term,
      downPayment = 0,
      salesTaxRate = 0,
      tradeInValue = 0
    } = req.body;

    if (!msrp || !capCost || !residualPercent || !moneyFactor || !term) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Normalize MF
    let mf = moneyFactor;
    if (typeof mf === "string") mf = parseFloat(mf);
    if (mf > 1) mf = mf / 2400;

    const residualValue = msrp * (residualPercent / 100);
    const netCapCost = capCost - downPayment - tradeInValue;

    const depreciation = Math.max(0, (netCapCost - residualValue) / term);
    const rentCharge = (netCapCost + residualValue) * mf;
    const tax = (depreciation + rentCharge) * (salesTaxRate / 100);
    const total = depreciation + rentCharge + tax;

    res.json({
      monthlyPayment: Math.round(total),
      residualValue: Math.round(residualValue),
      totalInterest: Math.round(rentCharge * term)
    });

  } catch (err) {
    console.error("Lease Calc Error:", err.message);
    res.status(500).json({ message: "Lease calculation failed." });
  }
};


// ⭐ Compare Multiple Lease Terms
// Calculates monthly payments across various term lengths (24, 36, 48 mo)
export const compareLeaseTerms = (req, res) => {
  const {
    msrp,
    capCost,
    residualPercents = {},   // e.g., { "24": 65, "36": 58 }
    moneyFactor,
    terms = [],              // Prevent .map crash
    downPayment = 0,
    salesTaxRate = 0,
    tradeInValue = 0
  } = req.body;

  try {
    // 1. Validation
    if (!msrp || !capCost || !Array.isArray(terms) || terms.length === 0) {
      return res.status(400).json({
        message: "MSRP, Cap Cost, and at least one lease term are required."
      });
    }

    // Normalize MF
    let mf = moneyFactor;
    if (typeof mf === "string") mf = parseFloat(mf);
    if (mf > 1) mf = mf / 2400;

    const comparisons = terms.map(term => {
      const termKey = String(term);

      // 2. Residual Calculation
      const resP = residualPercents[termKey] || 50;
      const residualValue = msrp * (resP / 100);

      // 3. Adjusted Cap Cost
      const netCapCost = capCost - downPayment - tradeInValue;

      // 4. Monthly Breakdown
      const depreciation = Math.max(0, (netCapCost - residualValue) / term);
      const rentCharge = (netCapCost + residualValue) * mf;

      const tax = (depreciation + rentCharge) * (salesTaxRate / 100);
      const total = depreciation + rentCharge + tax;

      return {
        term: Number(term),
        monthlyPayment: Math.round(total),
        totalInterest: Math.round(rentCharge * term),
        residualValue: Math.round(residualValue),
        depreciation: Math.round(depreciation)
      };
    });

    // Clean vehicle label
    const vehicleLabel = [req.body.year, req.body.make, req.body.model]
      .filter(Boolean)
      .join(" ")
      .trim();

    res.json({
      vehicle: vehicleLabel || "Vehicle",
      options: comparisons
    });

  } catch (err) {
    console.error("Lease Calc Error:", err.message);
    res.status(500).json({
      message: "Comparison calculation failed.",
      error: err.message
    });
  }
};