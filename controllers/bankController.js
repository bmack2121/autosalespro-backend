import Bank from "../models/Bank.js";

// ⭐ Get all banks
export const getBanks = async (req, res) => {
  try {
    const banks = await Bank.find().sort({ name: 1 });
    res.json(banks);
  } catch (err) {
    console.error("GET BANKS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch banks" });
  }
};

// ⭐ Get preferred banks only
export const getPreferredBanks = async (req, res) => {
  try {
    const banks = await Bank.find({ preferred: true }).sort({ name: 1 });
    res.json(banks);
  } catch (err) {
    console.error("GET PREFERRED BANKS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch preferred banks" });
  }
};

// ⭐ Create a new bank
export const createBank = async (req, res) => {
  try {
    const bank = await Bank.create(req.body);
    res.status(201).json(bank);
  } catch (err) {
    console.error("CREATE BANK ERROR:", err);
    res.status(500).json({ message: "Failed to create bank" });
  }
};

// ⭐ Update bank
export const updateBank = async (req, res) => {
  try {
    const bank = await Bank.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    });

    res.json(bank);
  } catch (err) {
    console.error("UPDATE BANK ERROR:", err);
    res.status(500).json({ message: "Failed to update bank" });
  }
};

// ⭐ Delete bank
export const deleteBank = async (req, res) => {
  try {
    await Bank.findByIdAndDelete(req.params.id);
    res.json({ message: "Bank deleted" });
  } catch (err) {
    console.error("DELETE BANK ERROR:", err);
    res.status(500).json({ message: "Failed to delete bank" });
  }
};

// ⭐ Toggle preferred status
export const togglePreferred = async (req, res) => {
  try {
    const bank = await Bank.findById(req.params.id);

    if (!bank) {
      return res.status(404).json({ message: "Bank not found" });
    }

    bank.preferred = !bank.preferred;
    await bank.save();

    res.json({
      message: `Bank marked as ${bank.preferred ? "preferred" : "not preferred"}`,
      bank
    });
  } catch (err) {
    console.error("TOGGLE PREFERRED ERROR:", err);
    res.status(500).json({ message: "Failed to toggle preferred status" });
  }
};