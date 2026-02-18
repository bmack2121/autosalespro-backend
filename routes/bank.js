import express from "express";
import Bank from "../models/Bank.js";
// ✅ FIX: Use the named import { protect } to match your middleware
import { protect } from "../middleware/auth.js"; 

const router = express.Router();

/**
 * @desc    Apply protection to all bank routes
 * Only logged-in users should see financial data
 */
router.use(protect);

// GET all banks
router.get("/", async (req, res) => {
  try {
    const banks = await Bank.find().sort({ name: 1 }); // Sorted alphabetically
    res.json(banks);
  } catch (err) {
    res.status(500).json({ message: "Error fetching banks", error: err.message });
  }
});

// ADD a bank
router.post("/", async (req, res) => {
  try {
    const bank = new Bank(req.body);
    await bank.save();
    res.status(201).json(bank);
  } catch (err) {
    res.status(500).json({ message: "Error adding bank", error: err.message });
  }
});

// UPDATE a bank
router.put("/:id", async (req, res) => {
  try {
    const bank = await Bank.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true // Ensures the update follows your Model rules
    });
    if (!bank) return res.status(404).json({ message: "Bank not found" });
    res.json(bank);
  } catch (err) {
    res.status(500).json({ message: "Error updating bank", error: err.message });
  }
});

// DELETE a bank
router.delete("/:id", async (req, res) => {
  try {
    const bank = await Bank.findByIdAndDelete(req.params.id);
    if (!bank) return res.status(404).json({ message: "Bank not found" });
    res.json({ message: "Bank deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting bank", error: err.message });
  }
});

export default router;