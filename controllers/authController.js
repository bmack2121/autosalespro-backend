import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Helper to generate token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const emailLower = email.toLowerCase();
    const existing = await User.findOne({ email: emailLower });
    if (existing) return res.status(400).json({ message: "Email already in use" });

    const allowedRoles = ['sales', 'manager'];
    const userRole = allowedRoles.includes(role) ? role : 'sales';

    const user = await User.create({
      name,
      email: emailLower,
      password,
      role: userRole
    });

    const token = generateToken(user._id, user.role);
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Missing email or password" });
    }

    const emailLower = email.toLowerCase();
    // ✅ Crucial: Ensure 'password' is included if the model hides it by default
    const user = await User.findOne({ email: emailLower }).select("+password");

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    // ✅ Match this call to the method name in User.js
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    await User.findByIdAndUpdate(user._id, { lastLogin: Date.now() });

    const token = generateToken(user._id, user.role);
    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Session expired" });
  }
};