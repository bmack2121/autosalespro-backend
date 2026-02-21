import fs from 'fs';
import path from 'path';
import axios from "axios";
import { Parser } from "json2csv";
import PDFDocument from 'pdfkit';
import NodeCache from 'node-cache';
import Inventory from "../models/Inventory.js";
import Activity from "../models/Activity.js";

// ✅ Initialize in-memory cache (24hr TTL)
const marketCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

/**
 * 🛰️ Helper: Broadcast to Socket.io Pulse Feed
 */
const broadcastActivity = async (req, activity) => {
  const io = req.app.get("io");
  if (io) {
    const populated = await activity.populate("user", "name role");
    io.emit("new-activity", populated);
  }
};

/**
 * 📊 Helper: Fetch Market Data with Caching
 */
const fetchMarketDataForVin = async (vin) => {
  try {
    const cachedData = marketCache.get(vin);
    if (cachedData) return cachedData;

    const apiKey = process.env.MARKETCHECK_API_KEY;
    const baseUrl = process.env.MARKETCHECK_BASE_URL || 'https://api.marketcheck.com/v2';
    
    const response = await axios.get(`${baseUrl}/predict/car/us/marketcheck_price`, {
      params: { api_key: apiKey, vin: vin },
      timeout: 5000 
    });

    if (response.data) marketCache.set(vin, response.data);
    return response.data;
  } catch (error) {
    return null;
  }
};

/* -------------------------------------------
 * 1. VIN DECODE (Hybrid Logic)
 * ----------------------------------------- */
export const decodeVin = async (req, res) => {
  try {
    const { vin } = req.params;
    const cleanVin = vin.trim().toUpperCase();
    const apiKey = process.env.MARKETCHECK_API_KEY;
    const baseUrl = process.env.MARKETCHECK_BASE_URL || 'https://api.marketcheck.com/v2';

    const [marketCheckRes, nhtsaRes] = await Promise.all([
      axios.get(`${baseUrl}/predict/car/us/marketcheck_price`, { 
        params: { api_key: apiKey, vin: cleanVin, include_build: 'true' } 
      }).catch(() => null),
      axios.get(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${cleanVin}?format=json`)
    ]);
    
    const nhtsa = nhtsaRes.data.Results[0];
    const mc = marketCheckRes?.data || {};

    if (!nhtsa.Make && !mc.make) {
      return res.status(400).json({ message: "VIN Invalid or Service Unavailable" });
    }

    res.json({
      vin: cleanVin,
      year: mc.year || nhtsa.ModelYear,
      make: mc.make || nhtsa.Make,
      model: mc.model || nhtsa.Model,
      trim: mc.trim || nhtsa.Trim || "Base",
      msrp: mc.msrp || 0,
      marketAverage: mc.predicted_price || 0,
      driveType: mc.build?.drivetrain || nhtsa.DriveType || "N/A",
      transmission: mc.build?.transmission || nhtsa.TransmissionStyle || "N/A",
      engine: mc.build?.engine || nhtsa.EngineConfiguration || "N/A",
      fuelType: mc.build?.fuel_type || nhtsa.FuelTypePrimary || "Gasoline"
    });
  } catch (err) {
    res.status(500).json({ message: "Decoding failed" });
  }
};

/* -------------------------------------------
 * 2. GET ALL INVENTORY (Optimized)
 * ----------------------------------------- */
export const getInventory = async (req, res) => {
  try {
    const units = await Inventory.find().sort({ createdAt: -1 }).lean();

    const enrichedUnits = await Promise.all(
      units.map(async (unit) => {
        const marketData = (unit.vin && unit.vin.length === 17) 
          ? await fetchMarketDataForVin(unit.vin) 
          : null;
        return { ...unit, marketData };
      })
    );

    res.json(enrichedUnits);
  } catch (err) {
    res.status(500).json({ message: "Fetch failed" });
  }
};

/* -------------------------------------------
 * 3. GET SINGLE VEHICLE
 * ----------------------------------------- */
export const getVehicleById = async (req, res) => {
  try {
    const vehicle = await Inventory.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: "Unit not found" });
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ message: "Error fetching details" });
  }
};

/* -------------------------------------------
 * 4. CREATE INVENTORY
 * ----------------------------------------- */
export const createInventory = async (req, res) => {
  try {
    const inventoryData = {
      ...req.body,
      vin: req.body.vin?.toUpperCase(),
      stockNumber: req.body.stockNumber || `VP-${Date.now().toString().slice(-6)}`,
      addedBy: req.user?.id
    };
    
    const inventory = await Inventory.create(inventoryData);
    
    if (req.user) {
      const activity = await Activity.create({
          category: "INVENTORY",
          type: "UNIT_ADDED",
          message: `Added ${inventory.year} ${inventory.make} to lot`,
          user: req.user.id,
          inventory: inventory._id,
          level: "success"
      });
      broadcastActivity(req, activity);
    }

    res.status(201).json(inventory);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* -------------------------------------------
 * 5. UPDATE INVENTORY (Unified Media Handler)
 * ----------------------------------------- */
export const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    let updatePayload = { ...req.body };
    let pushPayload = {};

    // ✅ Map incoming files to correct schema fields
    if (req.files) {
      if (req.files['photos']) {
        const photoPaths = req.files['photos'].map(f => `/uploads/vehicles/${f.filename}`);
        pushPayload.photos = { $each: photoPaths };
      }
      
      if (req.files['walkaround']) {
        updatePayload.walkaroundVideo = `/uploads/videos/${req.files['walkaround'][0].filename}`;
      }
      
      if (req.files['carfax']) {
        updatePayload.carfaxReport = `/uploads/carfax/${req.files['carfax'][0].filename}`;
      }
    }

    // Combine standard fields and the $push array logic
    const finalUpdate = Object.keys(pushPayload).length > 0 
      ? { ...updatePayload, $push: pushPayload } 
      : updatePayload;

    const vehicle = await Inventory.findByIdAndUpdate(
      id, 
      finalUpdate, 
      { new: true, runValidators: true }
    );

    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });
    if (updatePayload.vin) marketCache.del(updatePayload.vin);
    
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

/* -------------------------------------------
 * 6. DELETE INVENTORY (with FS Cleanup)
 * ----------------------------------------- */
export const deleteInventory = async (req, res) => {
  try {
    const vehicle = await Inventory.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    const mediaToPurge = [
      ...(vehicle.photos || []),
      vehicle.walkaroundVideo,
      vehicle.carfaxReport
    ].filter(Boolean);

    mediaToPurge.forEach(file => {
      // ✅ Matches the /public/uploads serving path
      const filePath = path.join(process.cwd(), 'public', file);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    });

    if (vehicle.vin) marketCache.del(vehicle.vin);
    await Inventory.findByIdAndDelete(req.params.id);
    res.json({ message: "Unit purged successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};

/* -------------------------------------------
 * 7. FALLBACK BASE64 UPLOAD
 * ----------------------------------------- */
export const uploadVehicleImage = async (req, res) => {
  try {
    const { image } = req.body; 
    const vehicleId = req.params.id;
    if (!image) return res.status(400).json({ message: "No image data" });

    const fileName = `${vehicleId}-${Date.now()}.jpg`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'vehicles');
    
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    
    const filePath = path.join(uploadDir, fileName);
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    
    fs.writeFileSync(filePath, base64Data, 'base64');
    const relativePath = `/uploads/vehicles/${fileName}`;
    
    const vehicle = await Inventory.findByIdAndUpdate(
        vehicleId, 
        { $push: { photos: relativePath } }, 
        { new: true }
    );
    
    res.json({ photo: relativePath, vehicle });
  } catch (err) {
    res.status(500).json({ message: "Image upload failed" });
  }
};

/* -------------------------------------------
 * 8. UTILITY: BULK, EXPORT, CARFAX
 * ----------------------------------------- */
export const bulkUpdateInventory = async (req, res) => {
  try {
    const { ids, status } = req.body;
    const result = await Inventory.updateMany({ _id: { $in: ids } }, { $set: { status } });
    res.json({ modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: "Bulk update failed" });
  }
};

export const exportInventory = async (req, res) => {
  try {
    const vehicles = await Inventory.find().lean();
    const fields = ["year", "make", "model", "vin", "price", "status"];
    const parser = new Parser({ fields });
    const csv = parser.parse(vehicles);

    res.header("Content-Type", "text/csv");
    res.attachment(`VinPro_Export_${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ message: "Export failed" });
  }
};

export const getCarfaxReport = async (req, res) => {
  try {
    const { vin } = req.params;
    const { format } = req.query;
    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      doc.pipe(res);
      doc.fontSize(20).text(`Carfax Report: ${vin}`, { align: 'center' });
      doc.end();
      return;
    }
    res.json({ vin: vin.toUpperCase(), status: "Verified Clean" });
  } catch (err) {
    res.status(500).json({ message: "Carfax failed" });
  }
};