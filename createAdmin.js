// createAdmin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Load your actual User model
import User from "./models/User.js";

// Your real MongoDB connection string
const MONGO_URI = "mongodb://localhost:27017/autosalespro";

async function createAdmin() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);

    const email = "kontentking100@gmail.com";
    const password = "Number21!!";

    // Check if admin already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log("Admin already exists:", existing.email);
      process.exit(0);
    }

    // Hash password using bcryptjs
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin user
    const admin = await User.create({
      name: "Admin",
      email,
      password: hashedPassword,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log("Admin account created successfully:");
    console.log({
      id: admin._id,
      email: admin.email,
      role: admin.role
    });

    process.exit(0);
  } catch (err) {
    console.error("Error creating admin:", err);
    process.exit(1);
  }
}

createAdmin();