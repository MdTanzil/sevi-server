const { ObjectId } = require("mongodb");
const { booksCollection } = require("../config/db");
const normalizeBook = require("../utils/normalizeBook");

// get categories base book
const getBooksByCategory = async (req, res) => {
  // console.log('req hit ' + req.params.category);
  const categoryName = req.params.category;
  const query = { category: categoryName };
  const result = await booksCollection.find(query).toArray();
  res.send(result);
};

// get single book
const getSingleBook = async (req, res) => {
  // console.log('req hit ' + req.params.category);
  const bookId = req.params.id;

  const query = { _id: new ObjectId(bookId) };
  const result = await booksCollection.findOne(query);

  res.send(result);
};

// get all book
const getAllBooks = async (req, res) => {
  const result = await booksCollection.find().toArray();
  res.send(result);
};

// add book
const addBook = async (req, res) => {
  const book = normalizeBook(req.body);
  const result = await booksCollection.insertOne(book);
  res.send(result);
};

//update a book
const updateBook = async (req, res) => {
  const bookid = req.params.id;
  const body = normalizeBook(req.body);
  const filter = { _id: new ObjectId(bookid) };
  const updateDoc = {
    $set: body,
  };
  const options = { upsert: true };
  const result = await booksCollection.updateOne(filter, updateDoc, options);
  res.send(result);
};

// patch incrage and decrage
const decreaseBookQuantity = async (req, res) => {
  const { id } = req.params;
  const filter = { _id: new ObjectId(id) };
  const find = await booksCollection.findOne(filter);
  const updateDoc = {
    $set: {
      quantity: find.quantity - 1,
    },
  };
  const options = { upsert: false };
  const result = await booksCollection.updateOne(filter, updateDoc, options);
  res.send(result);
};

// incrage book quantity
const increaseBookQuantity = async (req, res) => {
  const { id } = req.params;
  const filter = { _id: new ObjectId(id) };
  const find = await booksCollection.findOne(filter);
  const updateDoc = {
    $set: {
      quantity: find.quantity + 1,
    },
  };

  const options = { upsert: false };
  const result = await booksCollection.updateOne(filter, updateDoc, options);
  res.send(result);
};

module.exports = {
  getBooksByCategory,
  getSingleBook,
  getAllBooks,
  addBook,
  updateBook,
  decreaseBookQuantity,
  increaseBookQuantity,
};
