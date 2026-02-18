import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      index: true,
      enum: ["DEAL", "CUSTOMER", "INVENTORY", "SYSTEM", "FINANCE", "TASK"]
    },

    // e.g., 'VIN_SCANNED', 'PRICE_ADJUSTED', 'LEASE_QUOTED'
    type: { type: String, required: true },

    message: { type: String, required: true },

    // References for Dashboard Deep-Linking
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true
    },
    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      index: true
    },
    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      index: true
    },

    level: {
      type: String,
      enum: ["info", "warning", "critical", "success"],
      default: "info"
    },

    // metadata: { before: { price: 30000 }, after: { price: 28500 } }
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ⭐ Virtual: Relative Time (e.g., "2m ago")
ActivitySchema.virtual("relativeTime").get(function () {
  const diff = Math.floor((new Date() - this.createdAt) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
});

// ⭐ Performance Indexing
ActivitySchema.index({ category: 1, createdAt: -1 });
ActivitySchema.index({ user: 1, createdAt: -1 });

// ⭐ Retention Policy (90 Days)
ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export default mongoose.model("Activity", ActivitySchema);