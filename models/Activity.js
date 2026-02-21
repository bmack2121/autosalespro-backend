import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ["DEAL", "CUSTOMER", "INVENTORY", "SYSTEM", "FINANCE", "TASK"]
    },

    /** * Action keys: 'UNIT_ADDED', 'VIN_SCANNED', 'PRICE_ADJUSTED', 'COMMIT_TO_TOWER' 
     */
    type: { type: String, required: true },

    message: { type: String, required: true },

    // Deep-linking references for the dashboard feed
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
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
      enum: ["info", "warning", "critical", "success", "primary", "secondary"],
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
 * Formats the timestamp for "The Pulse" UI (e.g., "5m ago").
 */
ActivitySchema.virtual("relativeTime").get(function () {
  if (!this.createdAt) return "---";
  const now = new Date();
  const diff = Math.floor((now - this.createdAt) / 1000);
  
  // Handle clock drift
  if (diff < 5) return "just now";
  
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  
  return this.createdAt.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
});

/**
 * ⭐ Performance Indexing
 * Compound indexes cover (Field + Time) queries for fast dashboard sorting.
 */
ActivitySchema.index({ category: 1, createdAt: -1 });
ActivitySchema.index({ user: 1, createdAt: -1 });
ActivitySchema.index({ level: 1, createdAt: -1 });

/**
 * ⭐ Retention Policy (90 Days)
 * Auto-deletes old logs to keep the DB lean.
 */
ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const Activity = mongoose.model("Activity", ActivitySchema);
export default Activity;