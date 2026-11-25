require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = `mongodb+srv://${process.env.USER}:${process.env.PASSWORD}@cluster0.vfbjj6s.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const dbConnect = async () => {
  try {
    await client.connect();
    console.log("DB Connected Successfully✅");
  } catch (error) {
    console.log(error.name, error.message);
  }
};

const categoriesCollection = client.db("booksDB").collection("categories");
const booksCollection = client.db("booksDB").collection("books");
const borrowCollection = client.db("booksDB").collection("borrows");
const usersCollection = client.db("booksDB").collection("users");
const wishlistCollection = client.db("booksDB").collection("wishlists");
const notificationsCollection = client
  .db("booksDB")
  .collection("notifications");
const reviewsCollection = client.db("booksDB").collection("reviews");
const reservationsCollection = client
  .db("booksDB")
  .collection("reservations");

module.exports = {
  client,
  dbConnect,
  categoriesCollection,
  booksCollection,
  borrowCollection,
  usersCollection,
  wishlistCollection,
  notificationsCollection,
  reviewsCollection,
  reservationsCollection,
};
