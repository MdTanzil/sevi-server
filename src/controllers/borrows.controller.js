const { ObjectId } = require("mongodb");
const db = require("../config/db");
const getTokenEmail = require("../utils/tokenEmail");

// Maximum number of books a user may have borrowed at the same time.
const MAX_ACTIVE_BORROWS = 3;

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

// add a borrowed book (at most MAX_ACTIVE_BORROWS active borrows per user)
const addBorrow = async (req, res) => {
  const email = getBorrowerEmail(req, res);
  if (!email) return;
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
  activeBorrowQuery,
  countActiveBorrows,
  addBorrow,
  getBorrows,
  getBorrowHistory,
  returnBorrow,
  deleteBorrow,
};
