import Quote from "../models/Quote.js";

export const saveQuote = async (req, res) => {
  try {
    const quoteData = {
      ...req.body,
      salesperson: req.user.id // Captured from Auth middleware
    };

    const quote = await Quote.create(quoteData);

    res.status(201).json({
      message: "Quote locked in Deal Vault",
      quote
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to save deal",
      error: err.message
    });
  }
};