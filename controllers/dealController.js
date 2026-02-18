import Deal from "../models/Deal.js";
import Activity from "../models/Activity.js";
import Customer from "../models/Customer.js";

// ⭐ 1. CREATE Lead from DL Scan (The Intake Weapon)
export const createLeadFromScan = async (req, res) => {
  try {
    const { firstName, lastName, dlData } = req.body;

    // We split names for better CRM searching/sorting
    const customer = await Customer.create({
      firstName,
      lastName,
      dlData,
      assignedTo: req.user.id 
    });

    await Activity.create({
      category: "LEAD",
      type: "DL_SCAN",
      message: `Lead Captured: ${firstName} ${lastName} via DL Scanner`,
      user: req.user.id,
      customer: customer._id
    });

    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ message: "DL Scan processing failed", error: err.message });
  }
};

// ⭐ 2. RUN Soft Credit Pull (The Qualification Weapon)
export const runSoftPull = async (req, res) => {
  try {
    const { id } = req.params; 
    const { consent } = req.body;

    if (!consent) return res.status(400).json({ message: "Legal consent is required for credit pulls" });

    // Mocking Credit Logic for the "Weapon" suite
    // In production, integrate with 700Credit or DealerTrack API here
    const tiers = ['Prime', 'Near-Prime', 'Subprime'];
    const mockBand = tiers[Math.floor(Math.random() * tiers.length)];
    const mockFico = mockBand === 'Prime' ? '715-745' : mockBand === 'Near-Prime' ? '630-675' : '510-580';

    const customer = await Customer.findByIdAndUpdate(id, {
      "qualification.creditBand": mockBand,
      "qualification.ficoRange": mockFico,
      "qualification.consentGiven": true,
      "qualification.consentTimestamp": new Date(),
      status: "Hot Lead" // Auto-promote status on credit pull
    }, { new: true });

    await Activity.create({
      category: "LEAD",
      type: "CREDIT_CHECK",
      message: `Credit Qualified: ${mockBand} Band (${mockFico})`,
      user: req.user.id,
      customer: id
    });

    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: "Soft pull failed", error: err.message });
  }
};

// ⭐ 3. CREATE/SAVE Deal (The Four-Square Weapon)
export const createDeal = async (req, res) => {
  try {
    const { structure, appraisal, customer, vehicle } = req.body;

    // ✅ VERIFICATION: Sync Appraisal ACV with Deal Trade-In Value
    // This ensures the salesman doesn't "fat finger" different numbers in different components
    const finalACV = appraisal?.finalACV || structure?.tradeInValue || 0;

    const dealData = {
      ...req.body,
      user: req.user.id,
      "structure.tradeInValue": finalACV, 
      status: req.body.status || "pending" 
    };

    const deal = await Deal.create(dealData);

    // Update Customer status to "In Deal"
    await Customer.findByIdAndUpdate(customer, { status: "In Deal" });

    await Activity.create({
      category: "DEAL",
      type: "DEAL_CREATED",
      message: `Pencil Created: $${Math.round(deal.structure.monthlyPayment)}/mo on Unit ${vehicle}`,
      user: req.user.id,
      customer: deal.customer,
      metadata: { dealId: deal._id, acv: finalACV }
    });

    res.status(201).json(deal);
  } catch (err) {
    console.error("CREATE DEAL ERROR:", err);
    res.status(500).json({ message: "Failed to initialize deal structure", error: err.message });
  }
};

// ⭐ 4. GET Deals (Role-Based Pipeline)
export const getDeals = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "sales") query.user = req.user.id;

    const deals = await Deal.find(query)
      .populate("customer", "firstName lastName phone qualification") 
      .populate("user", "name")
      .populate("vehicle", "year make model stockNumber price")
      .sort({ createdAt: -1 });

    res.json(deals);
  } catch (err) {
    res.status(500).json({ message: "Pipeline fetch failed", error: err.message });
  }
};

// ⭐ 5. COMMIT to Manager (The Closer)
export const commitToManager = async (req, res) => {
  try {
    const deal = await Deal.findByIdAndUpdate(
      req.params.id, 
      { status: "pending_manager" }, 
      { new: true }
    );

    await Activity.create({
      category: "DEAL",
      type: "COMMIT_TO_MANAGER",
      message: `Deal submitted to Manager Tower for final pencil approval.`,
      user: req.user.id,
      customer: deal.customer,
      metadata: { dealId: deal._id }
    });

    // TODO: Trigger real-time Socket.io event for Manager Dashboard
    res.json(deal);
  } catch (err) {
    res.status(500).json({ message: "Submission to tower failed", error: err.message });
  }
};

// ⭐ 6. UPDATE Status (General Pipeline Movement)
export const updateDealStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const deal = await Deal.findByIdAndUpdate(req.params.id, { status }, { new: true });
    
    res.json(deal);
  } catch (err) {
    res.status(500).json({ message: "Status update failed", error: err.message });
  }
};