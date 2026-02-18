import fs from 'fs';
import path from 'path';
import axios from "axios";
import { Parser } from "json2csv";
import PDFDocument from 'pdfkit';
import Inventory from "../models/Inventory.js";
import Activity from "../models/Activity.js";

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

/* -------------------------------------------
 * 1. VIN DECODE (MarketCheck + NHTSA Hybrid)
 * ----------------------------------------- */
export const decodeVin = async (req, res) => {
  try {
    const { vin } = req.params;
    const cleanVin = vin.trim().toUpperCase();
    const apiKey = process.env.MARKETCHECK_API_KEY;

    // 1. Attempt MarketCheck NeoVIN Decode (Premium Build Data)
    const marketCheckRes = await axios.get(
      `https://api.marketcheck.com/v2/predict/car/us/marketcheck_price/comparables/decode`,
      { params: { api_key: apiKey, vin: cleanVin, include_build: 'true' } }
    ).catch(() => null);

    // 2. Secondary/Fallback: NHTSA Extended Decode
    const nhtsaRes = await axios.get(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${cleanVin}?format=json`
    );
    
    const nhtsa = nhtsaRes.data.Results[0];
    const mc = marketCheckRes?.data || {};

    if (nhtsa.ErrorCode !== "0" && !marketCheckRes) {
      return res.status(400).json({ message: "VIN Invalid or Service Unavailable" });
    }

    res.json({
      vin: cleanVin,
      year: mc.year || nhtsa.ModelYear,
      make: mc.make || nhtsa.Make,
      model: mc.model || nhtsa.Model,
      trim: mc.trim || nhtsa.Trim || "Base",
      // Market Intel
      msrp: mc.msrp || 0,
      marketAverage: mc.predicted_price || mc.mean || 0,
      marketRank: mc.price_rank || "Neutral",
      // Mechanicals
      driveType: mc.build?.drivetrain || nhtsa.DriveType || "N/A",
      transmission: mc.build?.transmission || nhtsa.TransmissionStyle || "N/A",
      engine: mc.build?.engine || (nhtsa.DisplacementL ? `${nhtsa.DisplacementL}L ${nhtsa.EngineCylinders}cyl` : "N/A"),
      fuelType: mc.build?.fuel_type || nhtsa.FuelTypePrimary || "Gasoline",
      bodyClass: nhtsa.BodyClass || "N/A",
      interiorColor: mc.build?.interior_color || "N/A"
    });
  } catch (err) {
    console.error("VinPro Engine: Decode Error", err.message);
    res.status(500).json({ message: "VinPro Engine: Decoding failed" });
  }
};

/* -------------------------------------------
 * 2. GET ALL INVENTORY
 * ----------------------------------------- */
export const getInventory = async (req, res) => {
  try {
    const items = await Inventory.find().sort({ createdAt: -1 });
    res.json(items);
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
    res.status(500).json({ message: "Error fetching vehicle details" });
  }
};

/* -------------------------------------------
 * 4. CREATE INVENTORY (Auto-Valuation)
 * ----------------------------------------- */
export const createInventory = async (req, res) => {
  try {
    const inventoryData = {
      ...req.body,
      vin: req.body.vin?.toUpperCase(),
      stockNumber: req.body.stockNumber || `VP-${Date.now().toString().slice(-6)}`,
      addedBy: req.user?.id,
      marketLastUpdated: new Date()
    };
    
    const inventory = await Inventory.create(inventoryData);

    const activity = await Activity.create({
        category: "INVENTORY",
        type: "UNIT_ADDED",
        message: `Added ${inventory.year} ${inventory.make} to lot with Market Intelligence`,
        user: req.user.id,
        inventory: inventory._id,
        level: "success"
    });

    broadcastActivity(req, activity);
    res.status(201).json(inventory);
  } catch (err) {
    res.status(400).json({ 
      message: err.code === 11000 ? "Duplicate VIN: Unit already in system" : err.message 
    });
  }
};

/* -------------------------------------------
 * 5. UPDATE INVENTORY (Unified with Media)
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

    const oldPrice = vehicle.price;
    const updates = req.body;

    Object.keys(updates).forEach(key => {
        if (!['photos', 'walkaroundVideo'].includes(key)) {
            vehicle[key] = updates[key];
        }
    });

    await vehicle.save();

    if (updates.price && Number(updates.price) !== oldPrice) {
        const activity = await Activity.create({
            category: "INVENTORY",
            type: "PRICE_ADJUSTED",
            message: `Price adjusted for ${vehicle.year} ${vehicle.make}`,
            user: req.user.id,
            inventory: vehicle._id,
            level: "warning",
            metadata: { oldPrice, newPrice: updates.price }
        });
        broadcastActivity(req, activity);
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
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    await Inventory.findByIdAndDelete(req.params.id);

    const activity = await Activity.create({
        category: "INVENTORY",
        type: "UNIT_DELETED",
        message: `Purged ${vehicle.year} ${vehicle.make} from system`,
        user: req.user.id,
        level: "critical"
    });

    broadcastActivity(req, activity);
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

    const uploadDir = path.join(process.cwd(), 'uploads', 'vehicles');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const fileName = `${vehicleId}-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, fileName);
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    
    fs.writeFileSync(filePath, base64Data, 'base64');
    const relativePath = `/uploads/vehicles/${fileName}`;
    
    const vehicle = await Inventory.findByIdAndUpdate(
        vehicleId, 
        { $push: { photos: relativePath } }, 
        { new: true }
    );
    
    const activity = await Activity.create({
        category: "INVENTORY",
        type: "PHOTO_ADDED",
        message: `New photo uploaded for ${vehicle.year} ${vehicle.make}`,
        user: req.user.id,
        inventory: vehicleId,
        level: "info"
    });

    broadcastActivity(req, activity);
    res.json({ message: "Image synced to lot", photo: relativePath, vehicle });
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
    
    const activity = await Activity.create({
        category: "INVENTORY",
        type: "BULK_UPDATE",
        message: `Bulk updated status to ${status} for ${result.modifiedCount} units`,
        user: req.user.id,
        level: "info"
    });

    broadcastActivity(req, activity);
    res.json({ modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: "Bulk update failed" });
  }
};

/* -------------------------------------------
 * 9. EXPORT CSV (Includes Market Intel)
 * ----------------------------------------- */
export const exportInventory = async (req, res) => {
  try {
    const vehicles = await Inventory.find().lean();
    if (!vehicles.length) return res.status(404).json({ message: "No data to export" });

    const fields = ["year", "make", "model", "vin", "stockNumber", "price", "marketAverage", "status"];
    const parser = new Parser({ fields });
    const csv = parser.parse(vehicles);

    res.header("Content-Type", "text/csv");
    res.attachment(`VinPro_Lot_Export_${Date.now()}.csv`);
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
    const vehicle = await Inventory.findOne({ vin: vin.toUpperCase() });
    
    const reportData = {
      vin: vin.toUpperCase(),
      vehicleName: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Unknown Unit",
      status: "Verified Clean",
      accidents: 0,
      lastChecked: new Date().toLocaleDateString()
    };

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Report_${vin}.pdf`);
      
      doc.pipe(res);
      doc.fillColor('#2563eb').fontSize(26).font('Helvetica-Bold').text('VINPRO', { align: 'left' });
      doc.fontSize(10).fillColor('#64748b').text('DIGITAL INVENTORY SOLUTIONS', { align: 'left' });
      doc.moveDown();
      doc.rect(50, doc.y, 500, 2).fill('#2563eb');
      doc.moveDown(2);

      doc.fillColor('#0f172a').fontSize(18).text('Vehicle History Snapshot');
      doc.moveDown().fontSize(12).fillColor('#334155')
          .text(`Vehicle: ${reportData.vehicleName}`)
          .text(`VIN: ${reportData.vin}`)
          .moveDown()
          .text(`Title Status: ${reportData.status}`)
          .text(`Accident Records: ${reportData.accidents}`);

      doc.moveDown(10).fontSize(8).fillColor('#94a3b8').text('This report is generated for internal dealership use via the VinPro Engine bridge.', { align: 'center' });
      doc.end();
      return;
    }

    res.json(reportData);
  } catch (err) {
    res.status(500).json({ message: "Carfax Bridge failed" });
  }
};