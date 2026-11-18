const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const requireRole = require("../middlewares/requireRole");
const {
  addBorrow,
  getBorrows,
  getBorrowHistory,
  returnBorrow,
  deleteBorrow,
} = require("../controllers/borrows.controller");

const router = express.Router();

router.post("/borrow", verifyToken, addBorrow);
router.get("/borrows", verifyToken, getBorrows);
router.get("/borrows/history", verifyToken, getBorrowHistory);
router.patch("/borrows/:id/return", verifyToken, returnBorrow);
router.delete(
  "/borrows/:id",
  verifyToken,
  requireRole("admin"),
  deleteBorrow
);

module.exports = router;
