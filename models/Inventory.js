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
  },
  fuelType: { 
    type: String, 
    default: 'Gasoline'
  },
  exteriorColor: { type: String, default: 'Unknown' },
  interiorColor: { type: String, default: 'Unknown' },
  engine: { type: String, default: 'N/A' },
  transmission: { type: String, default: 'N/A' },
  bodyClass: { type: String }, 
  
  // 📊 Pricing & Profit Intelligence
  price: { type: Number, default: 0 },
  mileage: { type: Number, default: 0 },
  
  // 📡 MarketCheck Integration Fields
  marketAverage: { type: Number, default: 0 }, 
  marketRank: { type: String, default: 'Neutral' },
  marketLastUpdated: { type: Date },
  msrp: { type: Number, default: 0 },
  
  status: { 
    type: String, 
    lowercase: true,
    enum: ['available', 'pending', 'sold', 'wholesale', 'hold', 'trade'],
    default: 'available' 
  },

  // 📸 Media Assets
  // ✅ Initialized as an empty array to prevent .map() errors in React
  photos: { 
    type: [String], 
    default: [] 
  }, 
  walkaroundVideo: { type: String },
  carfaxReport: { type: String }, // Added to match your controller logic
  
  // 📅 Relationships & Metadata
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dateAdded: { type: Date, default: Date.now },
}, { 
  timestamps: true,
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true }
});

// ✅ VIRTUAL: Primary Photo
// Returns the first photo in the array or a placeholder if empty
inventorySchema.virtual('primaryPhoto').get(function() {
  return this.photos && this.photos.length > 0 
    ? this.photos[0] 
    : '/assets/no-image-placeholder.png';
});

// ✅ VIRTUAL: Market Variance Percentage
inventorySchema.virtual('marketVariance').get(function() {
  if (!this.price || !this.marketAverage || this.marketAverage === 0) return 0;
  const variance = ((this.price - this.marketAverage) / this.marketAverage) * 100;
  return parseFloat(variance.toFixed(2));
});

// ✅ VIRTUAL: Days on Lot
inventorySchema.virtual('daysOnLot').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.dateAdded);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

const Inventory = mongoose.model('Inventory', inventorySchema);
export default Inventory;