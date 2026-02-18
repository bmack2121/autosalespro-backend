require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
      console.log("Usage: node createAdmin.js <email> <password>");
      process.exit(1);
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log("User already exists:", email);
      process.exit(1);
    }

    const user = await User.create({
      name: "Admin User",
      email,
      password,
      role: "admin",
    });

    console.log("Admin created successfully:");
    console.log({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    process.exit(0);
  } catch (err) {
    console.error("Error creating admin:", err);
    process.exit(1);
  }
};

run();