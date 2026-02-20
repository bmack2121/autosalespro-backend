import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    // Basic Info
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    email: { type: String },

    // Driver's License Data (Step 1: The Lead Fast-Pass)
    dlData: {
      address: { type: String },
      dob: { type: String },
      licenseNumber: { type: String },
      state: { type: String }
    },

    // ✅ ADDED: Trade-In Information (Step 2: Scanned from the lot)
    // This allows the LeadIntake VinScanner to persist data
    tradeIn: {
      vin: { type: String, uppercase: true },
      year: { type: String },
      make: { type: String },
      model: { type: String },
      trim: { type: String },
      condition: { type: String, default: "Unknown" }
    },

    // Qualification Data (Step 2: The Soft Pull)
    qualification: {
      creditBand: { 
        type: String, 
        enum: ["Prime", "Near-Prime", "Subprime", "Unknown"], 
        default: "Unknown" 
      },
      ficoRange: { type: String }, 
      consentGiven: { type: Boolean, default: false },
      consentTimestamp: { type: Date }
    },

    // CRM fields
    status: {
      type: String,
      enum: ["New Lead", "Hot Lead", "In Deal", "Sold", "Lost", "Retention"],
      default: "New Lead"
    },

    // Dates as Strings for easier mobile formatting
    lastContact: { type: String },     
    nextFollowUp: { type: String },    

    engagement: { type: Number, default: 20 }, // 0–100 score
    notes: { type: String, default: "" },

    // Vehicle History
    carfaxReport: { type: String, default: "" },
    walkthroughVideoUrl: { type: String, default: "" }, 

    // Deal history
    dealHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Deal"
      }
    ],

    // Assigned salesperson
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { 
    timestamps: true,
    // ✅ FIX: Required to make virtuals like 'fullName' appear in res.json()
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for full name
customerSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

export default mongoose.model("Customer", customerSchema);