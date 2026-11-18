const { ObjectId } = require("mongodb");
const { borrowCollection } = require("../config/db");

// add a borrowed book
const addBorrow = async (req, res) => {
  const borrowBook = req.body;
  const result = await borrowCollection.insertOne(borrowBook);
  res.send(result);
};

// get borrowed books
const getBorrows = async (req, res) => {
  const { email } = req.query;
  const query = { email: email };
  const result = await borrowCollection.find(query).toArray();
  res.send(result);
};

// delete borrowed books
const deleteBorrow = async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await borrowCollection.deleteOne(query);
  res.send(result);
};

module.exports = { addBorrow, getBorrows, deleteBorrow };
