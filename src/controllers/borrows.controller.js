const { ObjectId } = require("mongodb");
const db = require("../config/db");
const getTokenEmail = require("../utils/tokenEmail");
const { quantityOf } = require("../utils/restock");

// Maximum number of books a user may have borrowed at the same time.
const MAX_ACTIVE_BORROWS = 3;

// Books can be borrowed for at most this many days. The server allows
// one extra day of grace in each direction for timezone skew between
// the borrower's clock and the server's.
const MAX_BORROW_DAYS = 5;
const RETURN_DATE_GRACE_DAYS = 1;

// Validate a YYYY-MM-DD return date against today (UTC midnight — the
// server cannot know the borrower's timezone, so the grace day covers
// the difference). Returns an error message string, or null when valid.
// `maxDays`/`graceDays` default to the member borrow rule; the admin
// return-date override passes its own window (30 days, no grace).
const validateReturnDate = (
  value,
  today = new Date(),
  maxDays = MAX_BORROW_DAYS,
  graceDays = RETURN_DATE_GRACE_DAYS
) => {
  if (typeof value !== "string" || value.trim() === "") {
    return "A return date is required.";
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return "The return date must be a valid YYYY-MM-DD date.";
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const due = Date.UTC(year, month - 1, day);
  // Guard against rollover (e.g. 2026-02-30 becomes 2026-03-02).
  const check = new Date(due);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return "The return date must be a valid YYYY-MM-DD date.";
  }
  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const days = Math.round((due - start) / 86400000);
  if (days < -graceDays) {
    return "The return date cannot be in the past.";
  }
  if (days > maxDays + graceDays) {
    return `Books can be borrowed for up to ${maxDays} days.`;
  }
  return null;
};

// A borrow is active unless it was returned. Documents without a status
// field predate the status feature and count as borrowed: in MongoDB, $ne
// matches documents where the field is missing.
const activeBorrowQuery = (email) => ({
  email,
  status: { $ne: "returned" },
});

const countActiveBorrows = (collection, email) =>
  collection.countDocuments(activeBorrowQuery(email));

// The borrower's email always comes from the verified JWT (req.decode),
// never from the request body or query string. Returns null and sends a
// 401 when the token carries no email.
const getBorrowerEmail = (req, res) => {
  const email = getTokenEmail(req.decode);
  if (!email) {
    res.status(401).send({ status: "unAuthorized Access", code: "401" });
    return null;
  }
  return email;
};

// Out-of-stock guard: a book with no available copies cannot be
// borrowed (the details page disables Borrow too, but the server is the
// authority). Returns an error message when the book exists and is out
// of stock, or null when borrowing may proceed. A missing book or a
// malformed book id skips the check — the borrow is recorded exactly
// as before.
const checkBookInStock = async (bookId) => {
  let id;
  try {
    id = new ObjectId(bookId);
  } catch {
    return null;
  }
  const book = await db.booksCollection.findOne({ _id: id });
  if (!book) return null;
  if (quantityOf(book) < 1) {
    return "This book is out of stock.";
  }
  return null;
};

// add a borrowed book (at most MAX_ACTIVE_BORROWS active borrows per user;
// the return date must be within MAX_BORROW_DAYS of today, plus grace)
const addBorrow = async (req, res) => {
  const email = getBorrowerEmail(req, res);
  if (!email) return;
  const dateError = validateReturnDate(req.body.retunDate);
  if (dateError) {
    res.status(400).send({ error: dateError });
    return;
  }
  const stockError = await checkBookInStock(req.body.bookId);
  if (stockError) {
    res.status(400).send({ error: stockError });
    return;
  }
  const activeCount = await countActiveBorrows(db.borrowCollection, email);
  if (activeCount >= MAX_ACTIVE_BORROWS) {
    res.status(400).send({ error: "Borrow limit reached (3 books)" });
    return;
  }
  const borrowBook = { ...req.body, email, status: "borrowed" };
  delete borrowBook.returnedDate;
  const result = await db.borrowCollection.insertOne(borrowBook);
  res.send(result);
};

// get borrowed books (only the token owner's ACTIVE borrows)
const getBorrows = async (req, res) => {
  const email = getBorrowerEmail(req, res);
  if (!email) return;
  const result = await db.borrowCollection
    .find(activeBorrowQuery(email))
    .toArray();
  res.send(result);
};

// get the token owner's full borrow history (borrowed + returned),
// newest first
const getBorrowHistory = async (req, res) => {
  const email = getBorrowerEmail(req, res);
  if (!email) return;
  const result = await db.borrowCollection
    .find({ email })
    .sort({ borrowedDate: -1 })
    .toArray();
  res.send(result);
};

// return a borrowed book (only the owner can return their own borrow).
// The record is kept with status "returned" so the borrow history survives.
const returnBorrow = async (req, res) => {
  const email = getBorrowerEmail(req, res);
  if (!email) return;
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const record = await db.borrowCollection.findOne(query);
  if (!record) {
    res.status(404).send({ status: "Not Found", code: "404" });
    return;
  }
  if (record.email !== email) {
    res.status(403).send({ status: "Forbidden", code: "403" });
    return;
  }
  if (record.status === "returned") {
    res.status(400).send({ error: "This book was already returned" });
    return;
  }
  const result = await db.borrowCollection.updateOne(query, {
    $set: {
      status: "returned",
      returnedDate: new Date().toISOString().split("T")[0],
    },
  });
  res.send(result);
};

// delete a borrow record (admin only — cleanup use; returns use the
// PATCH /borrows/:id/return endpoint instead)
const deleteBorrow = async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const record = await db.borrowCollection.findOne(query);
  if (!record) {
    res.status(404).send({ status: "Not Found", code: "404" });
    return;
  }
  const result = await db.borrowCollection.deleteOne(query);
  res.send(result);
};

module.exports = {
  MAX_ACTIVE_BORROWS,
  MAX_BORROW_DAYS,
  RETURN_DATE_GRACE_DAYS,
  validateReturnDate,
  activeBorrowQuery,
  countActiveBorrows,
  addBorrow,
  getBorrows,
  getBorrowHistory,
  returnBorrow,
  deleteBorrow,
};
