import Customer from "../models/Customer.js";
import Activity from "../models/Activity.js";

// Helper to get full name consistently
const getFullName = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || "Unknown Lead";

/**
 * ⭐ GET all customers
 */
export const getCustomers = async (req, res) => {
  try {
    const query = req.user.role === "sales" ? { assignedTo: req.user.id } : {};
    const customers = await Customer.find(query)
      .populate("assignedTo", "name email")
      .sort({ updatedAt: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * ⭐ GET single customer
 */
export const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).populate("assignedTo", "name");
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * ⭐ CREATE customer
 */
export const createCustomer = async (req, res) => {
  try {
    const customerData = {
      ...req.body,
      assignedTo: req.body.assignedTo || req.user.id
    };
    const customer = await Customer.create(customerData);

    await Activity.create({
      category: "CUSTOMER",
      type: "LEAD_CREATED",
      message: `New lead created: ${getFullName(customer)}`,
      user: req.user.id,
      customer: customer._id
    });

    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * ⭐ VIDEO WALKTHROUGH UPLOAD
 */
export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No video file provided" });

    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // Store relative path so frontend can decide how to prefix it (safer for Capacitor)
    customer.walkthroughVideoUrl = `/uploads/videos/${req.file.filename}`;
    
    // 📈 Business Intelligence: Video sent = Hot Lead
    customer.engagement = Math.min((customer.engagement || 0) + 25, 100);
    if (customer.status === "New Lead") customer.status = "Hot Lead";

    await customer.save();

    await Activity.create({
      category: "CUSTOMER",
      type: "VIDEO_SENT",
      message: `Walkthrough video recorded for ${getFullName(customer)}`,
      user: req.user.id,
      customer: customer._id,
      metadata: { videoUrl: customer.walkthroughVideoUrl }
    });

    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};

/**
 * ⭐ ADD DEAL
 */
export const addDeal = async (req, res) => {
  try {
    const { vehicle, payment, date } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    customer.deals.push({ vehicle, payment, date });
    customer.status = "In Deal";
    customer.engagement = 100;

    await customer.save();

    await Activity.create({
      category: "DEAL",
      type: "DEAL_STARTED",
      message: `Deal structured for ${getFullName(customer)} on unit ${vehicle}`,
      user: req.user.id,
      customer: customer._id
    });

    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: "Failed to add deal", error: err.message });
  }
};

/**
 * ⭐ UPDATE CONTACT
 */
export const updateContact = async (req, res) => {
  try {
    const { date } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    customer.lastContact = date;
    customer.engagement = Math.min((customer.engagement || 20) + 10, 100);

    await customer.save();
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: "Contact update failed", error: err.message });
  }
};

/**
 * ⭐ UPDATE FOLLOW-UP
 */
export const updateFollowUp = async (req, res) => {
  try {
    const { date } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    customer.nextFollowUp = date;
    customer.engagement = Math.min((customer.engagement || 20) + 5, 100);

    await customer.save();

    await Activity.create({
      category: "CUSTOMER",
      type: "FOLLOWUP_UPDATED",
      message: `Next follow-up scheduled for ${getFullName(customer)}`,
      user: req.user.id,
      customer: customer._id
    });

    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: "Follow-up update failed", error: err.message });
  }
};

/**
 * ⭐ UPDATE CUSTOMER (General)
 */
export const updateCustomer = async (req, res) => {
  try {
    const updated = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

/**
 * ⭐ DELETE CUSTOMER
 */
export const deleteCustomer = async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: "Lead removed from system" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err.message });
  }
};

/**
 * ⭐ ASSIGN CUSTOMER
 */
export const assignCustomer = async (req, res) => {
  try {
    const { userId } = req.body;
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { assignedTo: userId },
      { new: true }
    );
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: "Assignment failed", error: err.message });
  }
};