import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  vin: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true,
    trim: true 
  },
  stockNumber: { type: String, unique: true, sparse: true },
  year: { type: Number, required: true },
  make: { type: String, required: true },
  model: { type: String, required: true },
  trim: { type: String },
  
  // 🚀 Extended Vehicle Specs (NHTSA + MarketCheck NeoVIN)
  driveType: { 
    type: String, 
    default: 'N/A'
    // Removed strict Enum to prevent API-sync crashes from varied API strings
  },
  fuelType: { 
    type: String, 
    default: 'Gasoline'
  },
  exteriorColor: { type: String, default: 'Unknown' },
  interiorColor: { type: String, default: 'Unknown' }, // Added for MarketCheck data
  engine: { type: String, default: 'N/A' },
  transmission: { type: String, default: 'N/A' }, // Added for Sales Desk
  bodyClass: { type: String }, 
  
  // 📊 Pricing & Profit Intelligence
  price: { type: Number, default: 0 },
  mileage: { type: Number, default: 0 },
  
  // 📡 MarketCheck Integration Fields
  marketAverage: { type: Number, default: 0 }, // Mean price from MarketCheck
  marketRank: { type: String, default: 'Neutral' }, // e.g., 'Great Deal', 'Fair Price'
  marketLastUpdated: { type: Date },
  msrp: { type: Number, default: 0 },
  
  status: { 
    type: String, 
    lowercase: true,
    enum: ['available', 'pending', 'sold', 'wholesale', 'hold', 'trade'],
    default: 'available' 
  },

  // 📸 Media Assets
  photos: [{ type: String }], // Changed to Array to support galleries
  walkaroundVideo: { type: String }, // 4K Walkaround support
  
  // 📅 Relationships & Metadata
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dateAdded: { type: Date, default: Date.now },
}, { 
  timestamps: true,
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true }
});

// ✅ VIRTUAL: Market Variance Percentage
// Shows how much % your car is above/below market (Negative = Better Deal)
inventorySchema.virtual('marketVariance').get(function() {
  if (!this.price || !this.marketAverage) return 0;
  const variance = ((this.price - this.marketAverage) / this.marketAverage) * 100;
  return parseFloat(variance.toFixed(2));
});

// ✅ VIRTUAL: Calculate "Days on Lot"
inventorySchema.virtual('daysOnLot').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.dateAdded);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

const Inventory = mongoose.model('Inventory', inventorySchema);
export default Inventory;