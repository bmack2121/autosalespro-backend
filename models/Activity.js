import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      index: true,
      enum: ["DEAL", "CUSTOMER", "INVENTORY", "SYSTEM", "FINANCE", "TASK"]
    },

    /** * Action keys: 'VIN_SCANNED', 'PRICE_ADJUSTED', 'LEASE_QUOTED', 'COMMIT_TO_TOWER' 
     * These should be uppercase snake_case for consistency across the engine.
     */
    type: { type: String, required: true },

    message: { type: String, required: true },

    // Deep-linking references for the dashboard feed
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

    /**
     * Metadata: Used for tracking state changes.
     * Example: { oldPrice: 30000, newPrice: 28500, vin: "..." }
     */
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/**
 * ⭐ Virtual: Relative Time
 * Optimized to handle clock drift and long-term retention.
 */
ActivitySchema.virtual("relativeTime").get(function () {
  if (!this.createdAt) return "---";
  const now = new Date();
  const diff = Math.floor((now - this.createdAt) / 1000);
  
  // Handle edge case where server/client time sync is off
  if (diff < 5) return "just now";
  
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  
  // Return localized date for items older than a week
  return this.createdAt.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
});

/**
 * ⭐ Performance Indexing
 * Optimized for the "The Pulse" Live Feed on the dashboard.
 */
ActivitySchema.index({ category: 1, createdAt: -1 });
ActivitySchema.index({ user: 1, createdAt: -1 });
// Compound index for filtered activity views
ActivitySchema.index({ level: 1, createdAt: -1 });

/**
 * ⭐ Retention Policy (90 Days)
 * Keeps the database lean by auto-purging old logs.
 * 7,776,000 seconds = 90 days.
 */
ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export default mongoose.model("Activity", ActivitySchema);