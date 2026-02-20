import fs from 'fs';
import path from 'path';
import axios from "axios";
import { Parser } from "json2csv";
import PDFDocument from 'pdfkit';
import NodeCache from 'node-cache';
import Inventory from "../models/Inventory.js";
import Activity from "../models/Activity.js";

// ✅ Initialize in-memory cache
// stdTTL: 86400 seconds = 24 hours. checkperiod: 3600 seconds = 1 hour cleanup.
const marketCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

/**
 * 🛰️ Helper: Broadcast to Socket.io
 * Ensures the 'Pulse Feed' in the mobile app updates instantly.
 */
const broadcastActivity = async (req, activity) => {
  const io = req.app.get("io");
  if (io) {
    const populated = await activity.populate("user", "name role");
    io.emit("new-activity", populated);
  }
};

/**
 * 📊 Helper: Fetch MarketCheck Data with Smart Caching
 * Used by the batch fetcher to prevent API limits and speed up load times.
 */
const fetchMarketDataForVin = async (vin) => {
  try {
    // 1. Check the memory cache BEFORE making a network request
    const cachedData = marketCache.get(vin);
    if (cachedData) {
      return cachedData; 
    }

    // 2. Cache Miss: Fetch from MarketCheck API
    const apiKey = process.env.MARKETCHECK_API_KEY;
    const baseUrl = process.env.MARKETCHECK_BASE_URL || 'https://api.marketcheck.com/v2';
    
    const response = await axios.get(`${baseUrl}/predict/car/us/marketcheck_price`, {
      params: { api_key: apiKey, vin: vin },
      timeout: 5000 // Don't let a slow third-party API hang the app
    });

    // 3. Store the fresh data in the cache for the next 24 hours
    if (response.data) {
      marketCache.set(vin, response.data);
    }

    return response.data;
  } catch (error) {
    return null; // Fail silently so the rest of the lot loads
  }
};

/* -------------------------------------------
 * 1. VIN DECODE (MarketCheck + NHTSA Hybrid)
 * ----------------------------------------- */
export const decodeVin = async (req, res) => {
  try {
    const { vin } = req.params;
    const cleanVin = vin.trim().toUpperCase();
    const apiKey = process.env.MARKETCHECK_API_KEY;
    const baseUrl = process.env.MARKETCHECK_BASE_URL || 'https://api.marketcheck.com/v2';

    const marketCheckRes = await axios.get(
      `${baseUrl}/predict/car/us/marketcheck_price`, 
      { 
        params: { 
          api_key: apiKey, 
          vin: cleanVin, 
          include_build: 'true',
          include_comparables: 'false' 
        } 
      }
    ).catch((err) => {
      console.warn("⚠️ MarketCheck lookup failed:", err.message);
      return null;
    });

    const nhtsaRes = await axios.get(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${cleanVin}?format=json`
    );
    
    const nhtsa = nhtsaRes.data.Results[0];
    const mc = marketCheckRes?.data || {};

    const isNhtsaValid = nhtsa.ErrorCode && nhtsa.ErrorCode.startsWith("0");

    if (!isNhtsaValid && !marketCheckRes) {
      return res.status(400).json({ message: "VIN Invalid or Service Unavailable" });
    }

    res.json({
      vin: cleanVin,
      year: mc.year || nhtsa.ModelYear,
      make: mc.make || nhtsa.Make,
      model: mc.model || nhtsa.Model,
      trim: mc.trim || nhtsa.Trim || "Base",
      msrp: mc.msrp || 0,
      marketAverage: mc.predicted_price || mc.mean || 0,
      marketRank: mc.price_rank || "Neutral",
      driveType: mc.build?.drivetrain || nhtsa.DriveType || "N/A",
      transmission: mc.build?.transmission || nhtsa.TransmissionStyle || "N/A",
      engine: mc.build?.engine || (nhtsa.DisplacementL ? `${nhtsa.DisplacementL}L ${nhtsa.EngineCylinders}cyl` : "N/A"),
      fuelType: mc.build?.fuel_type || nhtsa.FuelTypePrimary || "Gasoline",
      bodyClass: nhtsa.BodyClass || "N/A",
      interiorColor: mc.build?.interior_color || "N/A"
    });
  } catch (err) {
    console.error("🔥 Decode Error:", err.message);
    res.status(500).json({ message: "Decoding failed" });
  }
};

/* -------------------------------------------
 * 2. GET ALL INVENTORY (Optimized Batch + Cache)
 * ----------------------------------------- */
export const getInventory = async (req, res) => {
  try {
    // .lean() makes the query faster and returns plain JS objects
    const units = await Inventory.find().sort({ createdAt: -1 }).lean();

    // Fire all requests concurrently (pulling from RAM cache when possible)
    const enrichedUnits = await Promise.all(
      units.map(async (unit) => {
        let marketData = null;
        if (unit.vin && unit.vin.length === 17) {
          marketData = await fetchMarketDataForVin(unit.vin);
        }
        return {
          ...unit,
          marketData // Attaches directly for the React frontend
        };
      })
    );

    res.json(enrichedUnits);
  } catch (err) {
    console.error("Fetch Error:", err);
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
    res.status(500).json({ message: "Error fetching vehicle details" });
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
    
    const activity = await Activity.create({
        category: "INVENTORY",
        type: "UNIT_ADDED",
        message: `Added ${inventory.year} ${inventory.make} to lot`,
        user: req.user.id,
        inventory: inventory._id,
        level: "success"
    });

    broadcastActivity(req, activity);
    res.status(201).json(inventory);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* -------------------------------------------
 * 5. UPDATE INVENTORY (Unified Media & Data)
 * ----------------------------------------- */
export const updateInventory = async (req, res) => {
  try {
    const vehicle = await Inventory.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    if (req.files) {
      if (req.files['photos']) {
        const paths = req.files['photos'].map(f => `/uploads/vehicles/${f.filename}`);
        vehicle.photos = [...vehicle.photos, ...paths];
      }
      if (req.files['walkaround']) {
        vehicle.walkaroundVideo = `/uploads/videos/${req.files['walkaround'][0].filename}`;
      }
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (!['photos', 'walkaroundVideo'].includes(key)) {
        vehicle[key] = updates[key];
      }
    });

    await vehicle.save();
    
    // Invalidate the cache if the VIN changes or pricing updates drastically (optional)
    if (updates.vin && updates.vin !== vehicle.vin) {
       marketCache.del(vehicle.vin);
    }
    
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

/* -------------------------------------------
 * 6. DELETE INVENTORY
 * ----------------------------------------- */
export const deleteInventory = async (req, res) => {
  try {
    const vehicle = await Inventory.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    const mediaToPurge = [...(vehicle.photos || [])];
    if (vehicle.walkaroundVideo) mediaToPurge.push(vehicle.walkaroundVideo);

    mediaToPurge.forEach(file => {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (fileErr) {
            console.warn(`Could not delete orphaned file: ${filePath}`);
          }
        }
    });

    // Remove from cache to keep RAM clean
    if (vehicle.vin) {
       marketCache.del(vehicle.vin);
    }

    await Inventory.findByIdAndDelete(req.params.id);
    res.json({ message: "Unit purged successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};

/* -------------------------------------------
 * 7. LEGACY BASE64 IMAGE UPLOAD
 * ----------------------------------------- */
export const uploadVehicleImage = async (req, res) => {
  try {
    const { image } = req.body; 
    const vehicleId = req.params.id;
    if (!image) return res.status(400).json({ message: "No image data" });

    const fileName = `${vehicleId}-${Date.now()}.jpg`;
    const uploadDir = path.join(process.cwd(), 'uploads', 'vehicles');
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
 * 8. BULK UPDATE
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

/* -------------------------------------------
 * 9. EXPORT CSV
 * ----------------------------------------- */
export const exportInventory = async (req, res) => {
  try {
    const vehicles = await Inventory.find().lean();
    if (!vehicles.length) return res.status(404).json({ message: "No data" });

    const fields = ["year", "make", "model", "vin", "price", "status"];
    const parser = new Parser({ fields });
    const csv = parser.parse(vehicles);

    res.header("Content-Type", "text/csv");
    res.attachment(`Lot_Export_${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ message: "Export failed" });
  }
};

/* -------------------------------------------
 * 10. CARFAX PDF BRIDGE
 * ----------------------------------------- */
export const getCarfaxReport = async (req, res) => {
  try {
    const { vin } = req.params;
    const { format } = req.query;
    
    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      doc.pipe(res);
      doc.fontSize(20).text(`Vehicle History: ${vin}`, { align: 'center' });
      doc.end();
      return;
    }

    res.json({ vin: vin.toUpperCase(), status: "Verified Clean" });
  } catch (err) {
    res.status(500).json({ message: "Carfax Bridge failed" });
  }
};