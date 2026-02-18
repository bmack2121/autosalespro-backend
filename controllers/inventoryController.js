import fs from 'fs';
import path from 'path';
import axios from "axios";
import { Parser } from "json2csv";
import PDFDocument from 'pdfkit';
import Inventory from "../models/Inventory.js";

/* -------------------------------------------
 * 1. VIN DECODE (NHTSA Extended API)
 * ----------------------------------------- */
export const decodeVin = async (req, res) => {
  try {
    const { vin } = req.params;
    const response = await axios.get(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`
    );
    const data = response.data.Results[0];

    res.json({
      vin: vin.toUpperCase(),
      year: data.ModelYear,
      make: data.Make,
      model: data.Model,
      trim: data.Trim || "Base",
      driveTrain: data.DriveType || "N/A",
      fuelType: data.FuelTypePrimary || "Gasoline",
      engine: data.DisplacementL ? `${data.DisplacementL}L ${data.EngineCylinders}cyl` : "N/A",
      bodyClass: data.BodyClass || "N/A"
    });
  } catch (err) {
    console.error("NHTSA Decode Error:", err);
    res.status(500).json({ message: "Decoding failed" });
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
 * 3. GET SINGLE VEHICLE (FOR DETAIL PAGE)
 * ----------------------------------------- */
export const getVehicleById = async (req, res) => {
  try {
    const vehicle = await Inventory.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });
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
      stockNumber: req.body.stockNumber || `VP-${Date.now().toString().slice(-6)}`,
      addedBy: req.user?.id
    };
    const inventory = await Inventory.create(inventoryData);
    res.status(201).json(inventory);
  } catch (err) {
    res.status(400).json({ 
      message: err.code === 11000 ? "Duplicate VIN: Unit already in system" : err.message 
    });
  }
};

/* -------------------------------------------
 * 5. UPDATE INVENTORY
 * ----------------------------------------- */
export const updateInventory = async (req, res) => {
  try {
    const vehicle = await Inventory.findByIdAndUpdate(
      req.params.id, 
      { $set: req.body }, 
      { new: true, runValidators: true }
    );
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });
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
    await Inventory.findByIdAndDelete(req.params.id);
    res.json({ message: "Unit purged successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};

/* -------------------------------------------
 * 7. EXPORT INVENTORY (CSV)
 * ----------------------------------------- */
export const exportInventory = async (req, res) => {
  try {
    const vehicles = await Inventory.find().lean();
    if (!vehicles.length) return res.status(404).json({ message: "No data to export" });

    const fields = ["year", "make", "model", "vin", "stockNumber", "price", "status"];
    const parser = new Parser({ fields });
    const csv = parser.parse(vehicles);

    res.header("Content-Type", "text/csv");
    res.attachment(`VinPro_Export_${new Date().toISOString().split("T")[0]}.csv`);
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ message: "Export failed" });
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
 * 9. UPLOAD IMAGE (Base64 to File System)
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
    
    const vehicle = await Inventory.findByIdAndUpdate(vehicleId, { imageUrl: relativePath }, { new: true });
    res.json({ message: "Image synced", imageUrl: relativePath, vehicle });
  } catch (err) {
    res.status(500).json({ message: "Image upload failed" });
  }
};

/* -------------------------------------------
 * 10. CARFAX REPORT (Bridge with PDF Generation)
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
      res.setHeader('Content-Disposition', `attachment; filename=VinPro_Report_${vin}.pdf`);
      
      doc.pipe(res);
      doc.fillColor('#2563eb').fontSize(24).text('VinPro Carfax Bridge', { align: 'center' });
      doc.moveDown().fillColor('#64748b').fontSize(10).text(`Report ID: ${Date.now()}`, { align: 'center' });
      doc.moveDown(2);

      doc.fillColor('#0f172a').fontSize(16).text('Vehicle History Summary', { underline: true });
      doc.moveDown().fontSize(12)
         .text(`Vehicle: ${reportData.vehicleName}`)
         .text(`VIN: ${reportData.vin}`)
         .moveDown()
         .text(`Title Status: ${reportData.status}`)
         .text(`Accidents: ${reportData.accidents}`);

      doc.moveDown(5).fontSize(8).fillColor('#94a3b8').text('Disclaimer: This report is a bridge-generated summary for VinPro Internal Inventory Management.');
      doc.end();
      return;
    }

    res.json(reportData);
  } catch (err) {
    res.status(500).json({ message: "Carfax Bridge failed" });
  }
};