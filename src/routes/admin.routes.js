const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const requireRole = require("../middlewares/requireRole");
const {
  getAdminStats,
  getAdminBorrows,
} = require("../controllers/admin.controller");

const router = express.Router();

// Dashboard data for librarians and admins (members are forbidden).
router.get(
  "/admin/stats",
  verifyToken,
  requireRole("librarian", "admin"),
  getAdminStats
);
router.get(
  "/admin/borrows",
  verifyToken,
  requireRole("librarian", "admin"),
  getAdminBorrows
);

module.exports = router;
