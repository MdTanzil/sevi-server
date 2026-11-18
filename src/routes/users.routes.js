const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const requireRole = require("../middlewares/requireRole");
const {
  getProfile,
  updateProfile,
  updateEmail,
  listUsers,
  updateUserRole,
} = require("../controllers/users.controller");

const router = express.Router();

router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);
router.put("/profile/email", verifyToken, updateEmail);
router.get("/users", verifyToken, requireRole("admin"), listUsers);
router.put(
  "/users/:email/role",
  verifyToken,
  requireRole("admin"),
  updateUserRole
);

module.exports = router;
