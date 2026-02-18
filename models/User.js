import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: { 
      type: String, 
      required: true, 
      select: false // 🔒 Security: Hidden from default queries
    },
    role: {
      type: String,
      enum: ["sales", "manager", "admin"],
      default: "sales"
    },
    // ⭐ Dealership-specific logic
    settings: {
      monthlySalesGoal: { type: Number, default: 10 },
      commissionRate: { type: Number, default: 25 },
      isAvailable: { type: Boolean, default: true },
      notifications: {
        newLeads: { type: Boolean, default: true },
        dealApprovals: { type: Boolean, default: true }
      }
    },
    stats: {
      totalDealsClosed: { type: Number, default: 0 },
      totalRevenueGenerated: { type: Number, default: 0 }
    },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    pushToken: { type: String },
    resetPasswordToken: String,
    resetPasswordExpire: Date
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/**
 * ⭐ Password Hashing
 * Runs before saving to database
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * ⭐ Password Comparison
 * Defensive check ensures we don't crash if password isn't selected
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    throw new Error("Missing password field. Ensure .select('+password') is used.");
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * ⭐ Virtual: Sales Goal Progress
 * Calculates percentage dynamically for the dashboard
 */
userSchema.virtual("goalProgress").get(function () {
  const goal = this.settings?.monthlySalesGoal || 0;
  if (goal === 0) return 0;

  const closed = this.stats?.totalDealsClosed || 0;
  return Math.round((closed / goal) * 100);
});

export default mongoose.model("User", userSchema);