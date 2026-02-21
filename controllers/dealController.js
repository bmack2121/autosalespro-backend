import Deal from "../models/Deal.js";
import Activity from "../models/Activity.js";
import Customer from "../models/Customer.js";

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

// ⭐ 1. CREATE Lead from DL Scan (Now handles flattened AAMVA data)
export const createLeadFromScan = async (req, res) => {
  try {
    const { firstName, lastName, address, dob, email, phone, tradeIn } = req.body;

    // ✅ CHECK FOR EXISTING: Prevent duplicates based on Name + DOB (Standard AAMVA deduplication)
    let existingCustomer = await Customer.findOne({ 
      firstName: firstName,
      lastName: lastName,
      dob: dob
    });
    
    // If we have an email or phone, check those too as a secondary net
    if (!existingCustomer && (email || phone)) {
      existingCustomer = await Customer.findOne({
        $or: [
          { email: email ? email.toLowerCase() : "NEVER_MATCH" },
          { phone: phone ? phone : "NEVER_MATCH" }
        ]
      });
    }

    if (existingCustomer) {
      // If we scanned a trade-in but they already exist, update their profile with the car!
      if (tradeIn && !existingCustomer.tradeIn?.vin) {
        existingCustomer.tradeIn = tradeIn;
        await existingCustomer.save();
      }

      return res.status(200).json({ 
        message: "Existing lead found. Opening profile...", 
        customer: existingCustomer,
        isExisting: true 
      });
    }

    // ✅ FIX: Create new lead using the flattened data structure
    const newCustomer = await Customer.create({
      firstName,
      lastName,
      address,
      dob,
      email: email?.toLowerCase(),
      phone,
      tradeIn, // Captures the VIN scanner data
      assignedTo: req.user.id 
    });

    const activity = await Activity.create({
      category: "CUSTOMER",
      type: "DL_SCAN",
      message: `Lead Captured: ${firstName} ${lastName} via Fast-Pass Scanner`,
      user: req.user.id,
      customer: newCustomer._id
    });

    broadcastActivity(req, activity);
    res.status(201).json(newCustomer);
  } catch (err) {
    console.error("DL Scan processing failed:", err);
    res.status(500).json({ message: "DL Scan processing failed", error: err.message });
  }
};

// ⭐ 2. RUN Soft Credit Pull
export const runSoftPull = async (req, res) => {
  try {
    const { id } = req.params; 
    const { consent } = req.body;

    if (!consent) return res.status(400).json({ message: "Legal consent required" });

    // Mocking Credit Logic
    const tiers = ['Prime', 'Near-Prime', 'Subprime'];
    const mockBand = tiers[Math.floor(Math.random() * tiers.length)];
    const mockFico = mockBand === 'Prime' ? '715-745' : mockBand === 'Near-Prime' ? '630-675' : '510-580';

    const customer = await Customer.findByIdAndUpdate(id, {
      "qualification.creditBand": mockBand,
      "qualification.ficoRange": mockFico,
      "qualification.consentGiven": true,
      "qualification.consentTimestamp": new Date(),
      status: "Hot Lead" 
    }, { new: true });

    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const activity = await Activity.create({
      category: "CUSTOMER",
      type: "CREDIT_CHECK",
      message: `Credit Qualified: ${mockBand} Band (${mockFico})`,
      user: req.user.id,
      customer: id
    });

    broadcastActivity(req, activity);
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: "Soft pull failed", error: err.message });
  }
};

// ⭐ 3. CREATE/SAVE Deal
export const createDeal = async (req, res) => {
  try {
    // Let the Deal model middleware handle the ACV and Payment math
    const dealData = {
      ...req.body,
      user: req.user.id,
      status: req.body.status || "pending" 
    };

    const deal = await Deal.create(dealData);

    // Update Customer Status to "In Deal"
    await Customer.findByIdAndUpdate(req.body.customer, { status: "In Deal" });

    const activity = await Activity.create({
      category: "DEAL",
      type: "DEAL_CREATED",
      message: `Pencil Created: $${Math.round(deal.structure?.monthlyPayment || 0)}/mo for ${deal.vehicle}`,
      user: req.user.id,
      customer: deal.customer,
      metadata: { dealId: deal._id }
    });

    broadcastActivity(req, activity);
    res.status(201).json(deal);
  } catch (err) {
    console.error("CREATE DEAL ERROR:", err);
    res.status(500).json({ message: "Failed to initialize deal structure" });
  }
};

// ⭐ 4. GET Deals (Role-Based Pipeline)
export const getDeals = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "sales") query.user = req.user.id;

    const deals = await Deal.find(query)
      .populate("customer", "firstName lastName phone qualification status") 
      .populate("user", "name")
      .populate("vehicle", "year make model stockNumber price photos") 
      .sort({ createdAt: -1 });

    res.json(deals);
  } catch (err) {
    res.status(500).json({ message: "Pipeline fetch failed" });
  }
};

// ⭐ 5. COMMIT to Manager
export const commitToManager = async (req, res) => {
  try {
    const deal = await Deal.findByIdAndUpdate(
      req.params.id, 
      { status: "pending_manager" }, 
      { new: true }
    );

    if (!deal) return res.status(404).json({ message: "Deal not found" });

    const activity = await Activity.create({
      category: "DEAL",
      type: "COMMIT_TO_MANAGER",
      message: `Deal submitted to Tower for final approval.`,
      user: req.user.id,
      customer: deal.customer,
      metadata: { dealId: deal._id }
    });

    broadcastActivity(req, activity);
    res.json(deal);
  } catch (err) {
    res.status(500).json({ message: "Submission failed" });
  }
};

// ⭐ 6. UPDATE Status
export const updateDealStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const deal = await Deal.findByIdAndUpdate(req.params.id, { status }, { new: true });
    
    const activity = await Activity.create({
      category: "DEAL",
      type: "STATUS_UPDATED",
      message: `Deal status updated to ${status.toUpperCase()}`,
      user: req.user.id,
      customer: deal.customer
    });

    broadcastActivity(req, activity);
    res.json(deal);
  } catch (err) {
    res.status(500).json({ message: "Status update failed" });
  }
};