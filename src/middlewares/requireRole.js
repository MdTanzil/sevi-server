const db = require("../config/db");
const getTokenEmail = require("../utils/tokenEmail");

// Role gate. Use AFTER verifyToken: the caller's role is read from their
// users profile. A missing profile counts as a member (profiles are
// auto-created on first profile read, so this only happens before that).
// Sets req.userRole for downstream handlers.
const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    const email = getTokenEmail(req.decode);
    if (!email) {
      res.status(401).send({ status: "unAuthorized Access", code: "401" });
      return;
    }
    const profile = await db.usersCollection.findOne({ email });
    const role = profile?.role || "member";
    if (!allowedRoles.includes(role)) {
      res.status(403).send({ status: "Forbidden", code: "403" });
      return;
    }
    req.userRole = role;
    next();
  };
};

module.exports = requireRole;
