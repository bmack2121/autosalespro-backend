import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  vin: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true,
    trim: true 
  },
  stockNumber: { type: String, unique: true, sparse: true }, // sparse: true allows multiple nulls if empty
  year: { type: Number, required: true },
  make: { type: String, required: true },
  model: { type: String, required: true },
  trim: { type: String },
  
  // 🚀 Extended Vehicle Specs (Fetched via NHTSA)
  driveTrain: { 
    type: String, 
    default: 'N/A',
    enum: ['FWD', 'RWD', 'AWD', '4WD', '4x4', 'N/A'] 
  },
  fuelType: { 
    type: String, 
    default: 'Gasoline',
    enum: ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid', 'N/A']
  },
  exteriorColor: { type: String, default: 'Unknown' },
  engine: { type: String, default: 'N/A' },
  
  // 📊 Pricing & Status
  price: { type: Number, default: 0 },
  mileage: { type: Number, default: 0 },
  marketVariance: { type: Number, default: 0 }, 
  status: { 
    type: String, 
    lowercase: true,
    enum: ['available', 'pending', 'sold', 'wholesale'],
    default: 'available' 
  },

  // 📸 Media
  imageUrl: { type: String },
  
  // 📅 Relationships & Dates
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dateAdded: { type: Date, default: Date.now },
}, { 
  timestamps: true,
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true }
});

// ✅ VIRTUAL: Calculate "Days on Lot" on the fly
inventorySchema.virtual('daysOnLot').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.dateAdded);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// ✅ FIX: Use 'export default' for ES Modules compatibility
const Inventory = mongoose.model('Inventory', inventorySchema);
export default Inventory;