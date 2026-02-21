import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    // Basic Info (Flattened to match React frontend payload)
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    dob: { type: String, trim: true },

    // Driver's License Data (AAMVA support)
    dlData: {
      licenseNumber: { type: String, trim: true },
      state: { type: String, trim: true }
    },

    // Trade-In Information (Scanned from the lot)
    tradeIn: {
      vin: { type: String, uppercase: true, trim: true },
      year: { type: String },
      make: { type: String },
      model: { type: String },
      trim: { type: String },
      condition: { type: String, default: "Unknown" }
    },

    // Qualification Data (The Soft Pull)
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

    // Engagement score (Pulse feed tracking)
    engagement: { type: Number, default: 20 }, // 0–100 score
    notes: { type: String, default: "" },

    // Dates as Strings for easier mobile formatting
    lastContact: { type: String },      
    nextFollowUp: { type: String },    

    // Media & Reports
    carfaxReport: { type: String, default: "" },
    walkthroughVideoUrl: { type: String, default: "" }, 

    // Relationships
    dealHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Deal"
      }
    ],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/**
 * ✅ VIRTUAL: name
 * Bridges the gap between the DB (firstName/lastName) and the 
 * React Frontend which expects 'name' for searching and display.
 */
customerSchema.virtual('name').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

/**
 * ✅ VIRTUAL: isScanned
 * Returns true if driver's license data exists, triggering the 'VERIFIED' badge.
 */
customerSchema.virtual('isScanned').get(function() {
  return !!(this.dlData && this.dlData.licenseNumber);
});

export default mongoose.model("Customer", customerSchema);