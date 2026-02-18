import mongoose from "mongoose";

const QuoteSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true
    },
    salesperson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Financial Parameters
    calculations: {
      msrp: Number,
      capCost: Number,
      residual: Number,
      moneyFactor: Number,
      term: Number,
      downPayment: Number,
      monthlyPayment: Number,
      dueAtSigning: Number
    },

    status: {
      type: String,
      enum: ["draft", "sent", "accepted", "expired"],
      default: "draft"
    },

    // 7‑day expiry
    expiresAt: {
      type: Date,
      default: () =>
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  },
  { timestamps: true }
);

export default mongoose.model("Quote", QuoteSchema);