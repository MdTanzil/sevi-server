const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const requireRole = require("../middlewares/requireRole");
const {
  getBooksByCategory,
  getSingleBook,
  getAllBooks,
  addBook,
  updateBook,
  deleteBook,
  decreaseBookQuantity,
  increaseBookQuantity,
} = require("../controllers/books.controller");

const router = express.Router();

router.get("/books/:category", getBooksByCategory);
router.get("/single-book/:id", getSingleBook);
router.get("/books", verifyToken, getAllBooks);
router.post("/books", verifyToken, requireRole("librarian", "admin"), addBook);
router.put(
  "/books/:id",
  verifyToken,
  requireRole("librarian", "admin"),
  updateBook
);
router.delete(
  "/books/:id",
  verifyToken,
  requireRole("librarian", "admin"),
  deleteBook
);
router.patch("/books-quantity-decrease/:id", verifyToken, decreaseBookQuantity);
router.patch("/books-quantity-increase/:id", verifyToken, increaseBookQuantity);

module.exports = router;
