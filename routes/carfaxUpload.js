import express from "express";
import multer from "multer";
import Customer from "../models/Customer.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/carfax/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

router.post("/:customerId/upload", upload.single("pdf"), async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    customer.carfaxReport = req.file.path;
    await customer.save();

    res.json({
      message: "Carfax PDF uploaded",
      path: req.file.path
    });
  } catch (err) {
    res.status(500).json({ message: "Error uploading Carfax PDF" });
  }
});

export default router;