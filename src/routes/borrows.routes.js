const express = require("express");
const {
  addBorrow,
  getBorrows,
  deleteBorrow,
} = require("../controllers/borrows.controller");

const router = express.Router();

router.post("/borrow", addBorrow);
router.get("/borrows", getBorrows);
router.delete("/borrows/:id", deleteBorrow);

module.exports = router;
