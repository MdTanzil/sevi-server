const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const {
  getBooksByCategory,
  getSingleBook,
  getAllBooks,
  addBook,
  updateBook,
  decreaseBookQuantity,
  increaseBookQuantity,
} = require("../controllers/books.controller");

const router = express.Router();

router.get("/books/:category", getBooksByCategory);
router.get("/single-book/:id", getSingleBook);
router.get("/books", verifyToken, getAllBooks);
router.post("/books", verifyToken, addBook);
router.put("/books/:id", updateBook);
router.patch("/books-quantity-decrease/:id", decreaseBookQuantity);
router.patch("/books-quantity-increase/:id", increaseBookQuantity);

module.exports = router;
