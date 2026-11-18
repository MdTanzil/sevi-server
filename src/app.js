const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const booksRoutes = require("./routes/books.routes");
const borrowsRoutes = require("./routes/borrows.routes");
const categoriesRoutes = require("./routes/categories.routes");

const app = express();

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

app.use("/api/v1", authRoutes);
app.use("/api/v1", booksRoutes);
app.use("/api/v1", borrowsRoutes);
app.use("/api/v1", categoriesRoutes);

module.exports = app;
