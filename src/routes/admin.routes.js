const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const requireRole = require("../middlewares/requireRole");
const {
  getAdminStats,
  getAdminBorrows,
  createCategory,
  updateCategory,
  deleteCategory,
  listAdminUsers,
  createUser,
  updateUserProfile,
  deleteUser,
  getUserBorrows,
  adminLendBorrow,
  updateBorrowReturnDate,
  adminReturnBorrow,
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

// Category management (librarians and admins). Renaming a category also
// renames it on every book that references it, so the catalogue stays
// consistent; deleting is refused while any book uses the category.
router.post(
  "/admin/categories",
  verifyToken,
  requireRole("librarian", "admin"),
  createCategory
);
router.patch(
  "/admin/categories/:id",
  verifyToken,
  requireRole("librarian", "admin"),
  updateCategory
);
router.delete(
  "/admin/categories/:id",
  verifyToken,
  requireRole("librarian", "admin"),
  deleteCategory
);

// User list for librarians and admins (borrow tracking names + lend
// dialog). Creating, editing and deleting users is admin only, same as
// the existing GET /users management list.
router.get(
  "/admin/users",
  verifyToken,
  requireRole("librarian", "admin"),
  listAdminUsers
);
router.post(
  "/admin/users",
  verifyToken,
  requireRole("admin"),
  createUser
);
router.put(
  "/admin/users/:email",
  verifyToken,
  requireRole("admin"),
  updateUserProfile
);
router.delete(
  "/admin/users/:email",
  verifyToken,
  requireRole("admin"),
  deleteUser
);
router.get(
  "/admin/users/:email/borrows",
  verifyToken,
  requireRole("librarian", "admin"),
  getUserBorrows
);

// Borrow management (librarians and admins): lend a book on a user's
// behalf, change an active borrow's return date (up to 30 days out), and
// mark a borrow returned (restores the book quantity).
router.post(
  "/admin/borrows",
  verifyToken,
  requireRole("librarian", "admin"),
  adminLendBorrow
);
router.patch(
  "/admin/borrows/:id",
  verifyToken,
  requireRole("librarian", "admin"),
  updateBorrowReturnDate
);
router.post(
  "/admin/borrows/:id/return",
  verifyToken,
  requireRole("librarian", "admin"),
  adminReturnBorrow
);

module.exports = router;
