import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    // Basic Info (Split for DL Scanner accuracy)
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

    // Qualification Data (Step 2: The Soft Pull)
    qualification: {
      creditBand: { 
        type: String, 
        enum: ["Prime", "Near-Prime", "Subprime", "Unknown"], 
        default: "Unknown" 
      },
      ficoRange: { type: String }, // e.g., "710-735"
      consentGiven: { type: Boolean, default: false },
      consentTimestamp: { type: Date }
    },

    // CRM fields
    status: {
      type: String,
      enum: ["New Lead", "Hot Lead", "In Deal", "Sold", "Lost", "Retention"],
      default: "New Lead"
    },

    lastContact: { type: String },     
    nextFollowUp: { type: String },    

    engagement: { type: Number, default: 20 }, // 0–100 score

    notes: { type: String, default: "" },

    // Vehicle History
    carfaxReport: { type: String, default: "" },
    walkthroughVideoUrl: { type: String, default: "" }, // From your walkthrough feature

    // Deal history (References the new Deal model)
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
  { timestamps: true }
);

// Virtual for full name (useful for UI)
customerSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

export default mongoose.model("Customer", customerSchema);