const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const optionalToken = require("../middlewares/optionalToken");
const {
  getBookReviews,
  addBookReview,
  updateBookReview,
  deleteBookReview,
} = require("../controllers/reviews.controller");

const router = express.Router();

// Reading reviews is public; optionalToken only adds the `isMine` flag
// for signed-in callers. Writing a review needs a signed-in user.
router.get("/books/:bookId/reviews", optionalToken, getBookReviews);
router.post("/books/:bookId/reviews", verifyToken, addBookReview);
router.put(
  "/books/:bookId/reviews/:reviewId",
  verifyToken,
  updateBookReview
);
router.delete(
  "/books/:bookId/reviews/:reviewId",
  verifyToken,
  deleteBookReview
);

module.exports = router;
