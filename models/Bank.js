import mongoose from "mongoose";

const bankSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String },
    website: { type: String },

    // Quick summary of what this bank is good for
    strengths: { type: String },

    // Preferred lender tagging
    preferred: { type: Boolean, default: false },

    // Structured Programs
    programs: [
      {
        title: { type: String, required: true },
        description: { type: String },
        minCreditScore: { type: Number, default: 0 },
        maxLTV: { type: Number }, // Loan-to-Value percentage
        maxTerm: { type: Number } // Maximum months
      }
    ],

    // Contact Person
    primaryContact: {
      name: String,
      email: String,
      directLine: String
    },

    // External sync metadata
    lastUpdated: { type: Date, default: Date.now },
    apiSource: { type: String }
  },
  { timestamps: true }
);

// Fast lookup index
bankSchema.index({ name: 1 });

export default mongoose.model("Bank", bankSchema);