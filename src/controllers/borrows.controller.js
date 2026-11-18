const { ObjectId } = require("mongodb");
const { borrowCollection } = require("../config/db");
const getTokenEmail = require("../utils/tokenEmail");

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

// add a borrowed book
const addBorrow = async (req, res) => {
  const email = getBorrowerEmail(req, res);
  if (!email) return;
  const borrowBook = { ...req.body, email };
  const result = await borrowCollection.insertOne(borrowBook);
  res.send(result);
};

// get borrowed books (only the token owner's borrows)
const getBorrows = async (req, res) => {
  const email = getBorrowerEmail(req, res);
  if (!email) return;
  const query = { email: email };
  const result = await borrowCollection.find(query).toArray();
  res.send(result);
};

// delete borrowed books (only the owner can return their own borrow)
const deleteBorrow = async (req, res) => {
  const email = getBorrowerEmail(req, res);
  if (!email) return;
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const record = await borrowCollection.findOne(query);
  if (!record) {
    res.status(404).send({ status: "Not Found", code: "404" });
    return;
  }
  if (record.email !== email) {
    res.status(403).send({ status: "Forbidden", code: "403" });
    return;
  }
  const result = await borrowCollection.deleteOne(query);
  res.send(result);
};

module.exports = { addBorrow, getBorrows, deleteBorrow };
