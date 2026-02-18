import jwt from "jsonwebtoken";

/**
 * @desc    Verify JWT and Protect Private Routes
 */
export const protect = (req, res, next) => {
  // 1. Safe header access (handles 'authorization', 'Authorization', etc.)
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access denied. No valid token provided."
    });
  }

  try {
    // 2. Extract the token
    const token = authHeader.split(" ")[1];

    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not defined in environment variables");
    }

    // 3. Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Attach User info to Request
    // This allows your controllers to access req.user.id and req.user.role
    req.user = {
      id: decoded.id,
      role: decoded.role
    };

    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);

    // 5. Specific response for expired tokens
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    return res.status(401).json({ message: "Authentication failed. Invalid token." });
  }
};