const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const booksRoutes = require("./routes/books.routes");
const borrowsRoutes = require("./routes/borrows.routes");
const categoriesRoutes = require("./routes/categories.routes");
const usersRoutes = require("./routes/users.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const reviewsRoutes = require("./routes/reviews.routes");
const reservationsRoutes = require("./routes/reservations.routes");

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
app.use("/api/v1", adminRoutes);
app.use("/api/v1", booksRoutes);
app.use("/api/v1", borrowsRoutes);
app.use("/api/v1", categoriesRoutes);
app.use("/api/v1", usersRoutes);
app.use("/api/v1", wishlistRoutes);
app.use("/api/v1", notificationsRoutes);
app.use("/api/v1", reviewsRoutes);
app.use("/api/v1", reservationsRoutes);

module.exports = app;
