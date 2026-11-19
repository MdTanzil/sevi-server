const { ObjectId } = require("mongodb");
const db = require("../config/db");
const getTokenEmail = require("../utils/tokenEmail");

// The wishlist owner's email always comes from the verified JWT
// (req.decode), never from the request body or query string. Returns null
// and sends a 401 when the token carries no email.
const getOwnerEmail = (req, res) => {
  const email = getTokenEmail(req.decode);
  if (!email) {
    res.status(401).send({ status: "unAuthorized Access", code: "401" });
    return null;
  }
  return email;
};

// Parse a book id from a route param or body field. Returns the ObjectId,
// or null after sending a 400 for a malformed id.
const parseBookId = (value, res) => {
  try {
    return new ObjectId(value);
  } catch {
    res.status(400).send({ error: "A valid book id is required." });
    return null;
  }
};

// GET /wishlist — the token owner's wishlist, newest first. Each entry
// carries the book's current details (title, author, cover, category,
// quantity, rating) so the client needs no extra lookups. Entries whose
// book no longer exists are left out (books are never deleted, so this
// only guards against stale data).
const getWishlist = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    const entries = await db.wishlistCollection
      .find({ email })
      .sort({ createdAt: -1 })
      .toArray();
    const bookIds = entries.map((entry) => entry.bookId);
    const books = await db.booksCollection
      .find({ _id: { $in: bookIds } })
      .toArray();
    const byId = new Map(books.map((book) => [String(book._id), book]));
    const result = entries
      .map((entry) => {
        const book = byId.get(String(entry.bookId));
        if (!book) return null;
        return {
          _id: entry._id,
          bookId: entry.bookId,
          createdAt: entry.createdAt,
          book: {
            _id: book._id,
            name: book.name,
            author: book.author,
            imageUrl: book.imageUrl,
            category: book.category,
            quantity: book.quantity,
            rating: book.rating,
          },
        };
      })
      .filter(Boolean);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Could not load your wishlist" });
  }
};

// POST /wishlist — add a book to the token owner's wishlist.
// Idempotent: adding a book that is already wishlisted returns the
// existing entry instead of an error.
const addToWishlist = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    const bookId = parseBookId(req.body?.bookId, res);
    if (!bookId) return;
    const book = await db.booksCollection.findOne({ _id: bookId });
    if (!book) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const existing = await db.wishlistCollection.findOne({ email, bookId });
    if (existing) {
      res.send({ ...existing, alreadyWishlisted: true });
      return;
    }
    const entry = {
      email,
      bookId,
      createdAt: new Date().toISOString(),
    };
    const result = await db.wishlistCollection.insertOne(entry);
    res.send({ ...entry, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ error: "Could not add the book to your wishlist" });
  }
};

// DELETE /wishlist/:bookId — remove a book from the token owner's
// wishlist. Returns 404 when the book is not on their wishlist.
const removeFromWishlist = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    const bookId = parseBookId(req.params.bookId, res);
    if (!bookId) return;
    const result = await db.wishlistCollection.deleteOne({ email, bookId });
    if (result.deletedCount === 0) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    res.send(result);
  } catch (error) {
    res
      .status(500)
      .send({ error: "Could not remove the book from your wishlist" });
  }
};

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
