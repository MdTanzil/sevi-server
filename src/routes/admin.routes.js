const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const requireRole = require("../middlewares/requireRole");
const {
  getAdminStats,
  getAdminBorrows,
  updateCategoryImage,
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
// Category images only — renaming a category would break the books that
// reference it by name, so no name change is offered.
router.patch(
  "/admin/categories/:id",
  verifyToken,
  requireRole("librarian", "admin"),
  updateCategoryImage
);

module.exports = router;
