const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/wishlist.controller");

const router = express.Router();

// Every wishlist entry belongs to the token owner — the email always
// comes from the verified JWT, never from the request.
router.get("/wishlist", verifyToken, getWishlist);
router.post("/wishlist", verifyToken, addToWishlist);
router.delete("/wishlist/:bookId", verifyToken, removeFromWishlist);

module.exports = router;
