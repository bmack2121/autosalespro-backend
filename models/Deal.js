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
      // ✅ FIX: Match the model name used in Inventory.js
      ref: "Inventory", 
      required: true
    },

    // Lender Relationship
    lender: { type: mongoose.Schema.Types.ObjectId, ref: "Bank" },

    // Financials (The Pencil)
    structure: {
      salePrice: { type: Number, required: true },
      downPayment: { type: Number, default: 0 },
      tradeInValue: { type: Number, default: 0 },
      termMonths: { type: Number, default: 60 },
      apr: { type: Number, default: 0 },
      monthlyPayment: { type: Number }
    },

    // Trade-In Details (ACV = Actual Cash Value)
    appraisal: {
      vin: { type: String, uppercase: true },
      baseValue: { type: Number },
      deductions: [
        {
          label: { type: String },
          cost: { type: Number }
        }
      ],
      finalACV: { type: Number }
    },

    // Salesman's Stipulation Checklist
    stipulations: {
      idVerified: { type: Boolean, default: false }, 
      videoSent: { type: Boolean, default: false },  
      insuranceProof: { type: Boolean, default: false },
      creditConsent: { type: Boolean, default: false } 
    },

    status: {
      type: String,
      enum: [
        "pending",          
        "pending_manager",  
        "approved",         
        "delivered",        
        "cancelled"
      ],
      default: "pending"
    },

    notes: { type: String }
  },
  { timestamps: true }
);

/**
 * ⭐ Middleware: Financial Calculations
 * Logic for the "Pencil" to ensure payments are accurate before storage.
 */
dealSchema.pre("save", function (next) {
  // 1. Calculate ACV first
  if (this.appraisal && this.appraisal.baseValue) {
    const totalDeductions = this.appraisal.deductions.reduce((sum, d) => sum + (d.cost || 0), 0);
    this.appraisal.finalACV = this.appraisal.baseValue - totalDeductions;
    
    // Auto-populate tradeInValue if it hasn't been manually set to something else
    if (!this.structure.tradeInValue) {
      this.structure.tradeInValue = this.appraisal.finalACV;
    }
  }

  // 2. Calculate Monthly Payment (Standard Amortization)
  const { salePrice, apr, termMonths, downPayment, tradeInValue } = this.structure;

  if (salePrice && termMonths) {
    const principal = salePrice - (downPayment || 0) - (tradeInValue || 0);
    const monthlyRate = (apr || 0) / 100 / 12;

    if (monthlyRate > 0) {
      const payment = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
      this.structure.monthlyPayment = Math.round(payment * 100) / 100; // Round to 2 decimals
    } else {
      this.structure.monthlyPayment = Math.round((principal / termMonths) * 100) / 100;
    }
  }
  next();
});

export default mongoose.model("Deal", dealSchema);