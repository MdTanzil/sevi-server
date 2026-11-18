const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const {
  addBorrow,
  getBorrows,
  deleteBorrow,
} = require("../controllers/borrows.controller");

const router = express.Router();

router.post("/borrow", verifyToken, addBorrow);
router.get("/borrows", verifyToken, getBorrows);
router.delete("/borrows/:id", verifyToken, deleteBorrow);

module.exports = router;
