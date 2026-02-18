// ✅ Changed from 'export default function' to 'export const admin'
export const admin = (req, res, next) => {
  try {
    // 1. Ensure authentication middleware (protect) ran first and set req.user
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required. Please log in."
      });
    }

    // 2. Allow both admin and manager roles
    const privilegedRoles = ["admin", "manager"];

    if (!privilegedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied. Management or Admin permissions required."
      });
    }

    // 3. Security Audit Logging
    console.log(
      `🛡️ Privileged access granted: ${req.user.id} (Role: ${req.user.role})`
    );

    next();
  } catch (err) {
    console.error("Privileged Access Error:", err);
    res.status(500).json({
      message: "Internal server error during permission check"
    });
  }
};