import mongoose from "mongoose";

const dealSchema = new mongoose.Schema(
  {
    // Relationships
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true
    },

    // Lender Relationship (Integrated with Step 1: FinancingBanksPage)
    lender: { type: mongoose.Schema.Types.ObjectId, ref: "Bank" },

    // Financials (Step 4: The Four-Square)
    structure: {
      salePrice: { type: Number, required: true },
      downPayment: { type: Number, default: 0 },
      tradeInValue: { type: Number, default: 0 },
      termMonths: { type: Number, default: 60 },
      apr: { type: Number, default: 0 },
      monthlyPayment: { type: Number }
    },

    // Trade-In Details (Step 3: Appraisal Walkaround)
    appraisal: {
      vin: { type: String },
      baseValue: { type: Number },
      deductions: [
        {
          label: { type: String },
          cost: { type: Number }
        }
      ],
      finalACV: { type: Number }
    },

    // Stipulations Tracking (Salesman's Checklist)
    stipulations: {
      idVerified: { type: Boolean, default: false }, // Updated via DL Scanner
      videoSent: { type: Boolean, default: false },  // Updated via Walkthrough Video
      insuranceProof: { type: Boolean, default: false },
      creditConsent: { type: Boolean, default: false } // Updated via Soft Pull
    },

    status: {
      type: String,
      enum: [
        "pending",          // Draft deal
        "pending_manager",  // Step 4: Salesman hit "I'll Take It"
        "approved",         // Manager approved the gross
        "delivered",        // Unit rolled off the lot
        "cancelled"
      ],
      default: "pending"
    },

    notes: { type: String }
  },
  { timestamps: true }
);

/**
 * ⭐ Middleware: Calculate Monthly Payment before saving
 * This ensures the DB reflects the exact "Pencil" shown on the DealSheet
 */
dealSchema.pre("save", function (next) {
  const { salePrice, apr, termMonths, downPayment, tradeInValue } = this.structure;

  if (salePrice && termMonths) {
    const principal = salePrice - (downPayment || 0) - (tradeInValue || 0);
    const monthlyRate = (apr || 0) / 100 / 12;

    if (monthlyRate > 0) {
      this.structure.monthlyPayment =
        (principal * monthlyRate) /
        (1 - Math.pow(1 + monthlyRate, -termMonths));
    } else {
      this.structure.monthlyPayment = principal / termMonths;
    }
    
    // Auto-update ACV if appraisal data is present
    if (this.appraisal && this.appraisal.baseValue) {
      const totalDeductions = this.appraisal.deductions.reduce((sum, d) => sum + d.cost, 0);
      this.appraisal.finalACV = this.appraisal.baseValue - totalDeductions;
      this.structure.tradeInValue = this.appraisal.finalACV;
    }
  }
  next();
});

export default mongoose.model("Deal", dealSchema);