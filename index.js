const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;

//middleware
const corsConfig = {
  origin: ["http://localhost:5173", "https://sevi-efc34.web.app"],
  credentials: true,
};
app.use(cors(corsConfig));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

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
    client.connect();
    console.log("DB Connected Successfully✅");
  } catch (error) {
    console.log(error.name, error.message);
  }
};
dbConnect();

const categoriesCollection = client.db("booksDB").collection("categories");
const booksCollection = client.db("booksDB").collection("books");
const borrowCollection = client.db("booksDB").collection("borrows");

// jwt authentication middleware

const verify = async (req, res, next) => {
  //Coockies ache kina check koro
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).send({ status: "unAuthorized Access", code: "401" });
    return;
  }

  jwt.verify(token, process.env.SECRET_KEY, (error, decode) => {
    if (error) {
      res.status(401).send({ status: "unAuthorized Access", code: "401" });
    } else {
      // console.log(decode);
      req.decode = decode;
    }
  });
  next();
};


// jwt token create request
app.post("/api/v1/jwt", async (req, res) => {
  const body = req.body;
  // console.log(body);
  //generating Token
  const token = jwt.sign(body, process.env.SECRET_KEY, { expiresIn: "10h" });
  // console.log(token);
  // sending Token in cookies with a status
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
    .send({ success: true });

 

});

//get all categories

app.get("/api/v1/categories", async (req, res) => {
  const result = await categoriesCollection.find().toArray();
  res.send(result);
});

// get categories base book

app.get("/api/v1/books/:category", async (req, res) => {
  // console.log('req hit ' + req.params.category);
  const categoryName = req.params.category;
  const query = { category: categoryName };
  const result = await booksCollection.find(query).toArray();
  res.send(result);
});
// get single book
app.get("/api/v1/single-book/:id", async (req, res) => {
  // console.log('req hit ' + req.params.category);
  const bookId = req.params.id;

  const query = { _id: new ObjectId(bookId) };
  const result = await booksCollection.findOne(query);

  res.send(result);
});

// get all book
app.get("/api/v1/books",verify, async (req, res) => {
  const result = await booksCollection.find().toArray();
  res.send(result);
});

// add book
app.post("/api/v1/books", verify,async (req, res) => {
  const book = req.body;
  const result = await booksCollection.insertOne(book);
  res.send(result);
});

// add a borrowed book
app.post("/api/v1/borrow", async (req, res) => {
  borrowBook = req.body;
  const result = await borrowCollection.insertOne(borrowBook);
  res.send(result);
});
// get borrowed books
app.get("/api/v1/borrows", async (req, res) => {
  const { email } = req.query;
  const query = { email: email };
  const result = await borrowCollection.find(query).toArray();
  res.send(result);
});
// delete borrowed books
app.delete("/api/v1/borrows/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await borrowCollection.deleteOne(query);
  res.send(result);
});

//update a book
app.put("/api/v1/books/:id", async (req, res) => {
  const bookid = req.params.id;
  const body = req.body;
  const filter = { _id: new ObjectId(bookid) };
  const updateDoc = {
    $set: body,
  };
  const options = { upsert: true };
  const result = await booksCollection.updateOne(filter, updateDoc, options);
  res.send(result);
});

// patch incrage and decrage
app.patch("/api/v1/books-quantity-decrease/:id", async (req, res) => {
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
});

// incrage book quantity
app.patch("/api/v1/books-quantity-increase/:id", async (req, res) => {
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
});
