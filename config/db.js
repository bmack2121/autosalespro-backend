import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Professional Connection Options
      maxPoolSize: 10,               // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Try connecting for 5 seconds
      socketTimeoutMS: 45000,        // Close inactive sockets after 45s
      family: 4                      // Force IPv4 (avoids localhost IPv6 issues)
    });

    console.log(`
    ✅ VinPro Database Online
    🗄️  Host: ${conn.connection.host}
    📦 Database: ${conn.connection.name}
    `);

    // Runtime connection error handling
    mongoose.connection.on("error", err => {
      console.error("❌ MongoDB runtime error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected. Attempting to reconnect...");
    });

  } catch (error) {
    console.error(`❌ DB Connection Failed: ${error.message}`);

    // Retry logic
    console.log("Retrying connection in 5 seconds...");
    setTimeout(connectDB, 5000);
  }
};

export default connectDB;