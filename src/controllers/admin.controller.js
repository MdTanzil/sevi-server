const { ObjectId } = require("mongodb");
const db = require("../config/db");

// Admin dashboard aggregates (librarian/admin only — see admin.routes.js).
//
// A borrow is active unless it was returned. Documents without a status
// field predate the status feature and count as borrowed: in MongoDB, $ne
// matches documents where the field is missing (same rule as
// activeBorrowQuery in borrows.controller.js).
const activeBorrowFilter = { status: { $ne: "returned" } };

// Book quantities are stored exactly as sent (the web form sends them as
// strings), so numeric work converts defensively: non-numeric or missing
// quantities count as 0.
const quantityOf = (book) => {
  const qty = Number(book?.quantity);
  return Number.isFinite(qty) ? qty : 0;
};

// GET /admin/stats — library-wide counts for the dashboard.
const getAdminStats = async (req, res) => {
  try {
    // YYYY-MM-DD (UTC). Return dates are stored as YYYY-MM-DD strings, so
    // a plain string comparison finds the past-due ones.
    const today = new Date().toISOString().split("T")[0];
    const [books, totalUsers, totalBorrows, activeBorrows, overdueBorrows] =
      await Promise.all([
        db.booksCollection.find({}, { projection: { quantity: 1 } }).toArray(),
        db.usersCollection.countDocuments(),
        db.borrowCollection.countDocuments(),
        db.borrowCollection.countDocuments(activeBorrowFilter),
        db.borrowCollection.countDocuments({
          ...activeBorrowFilter,
          retunDate: { $lt: today },
        }),
      ]);
    res.send({
      totalBooks: books.length,
      totalCopies: books.reduce((sum, book) => sum + quantityOf(book), 0),
      totalUsers,
      totalBorrows,
      activeBorrows,
      overdueBorrows,
      outOfStockBooks: books.filter((book) => quantityOf(book) === 0).length,
    });
  } catch (error) {
    // Express 4 does not catch rejected async handlers — without this the
    // request would hang until the serverless timeout instead of failing.
    res.status(500).send({ error: "Could not load dashboard stats" });
  }
};

// GET /admin/borrows — every user's ACTIVE borrows, most recent first.
const getAdminBorrows = async (req, res) => {
  try {
    const result = await db.borrowCollection
      .find(activeBorrowFilter)
      .sort({ borrowedDate: -1 })
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Could not load active borrows" });
  }
};

// PATCH /admin/categories/:id — update ONLY the image of a category.
// Renaming is deliberately not allowed: book records reference the
// category name, so a rename would break them.
const updateCategoryImage = async (req, res) => {
  try {
    const image = req.body?.image;
    let url = null;
    if (typeof image === "string" && image.trim() !== "") {
      try {
        url = new URL(image.trim());
      } catch {
        url = null;
      }
    }
    if (!url || url.protocol !== "https:") {
      res
        .status(400)
        .send({ error: "A valid https image URL is required." });
      return;
    }
    let query;
    try {
      query = { _id: new ObjectId(req.params.id) };
    } catch {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const record = await db.categoriesCollection.findOne(query);
    if (!record) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const result = await db.categoriesCollection.updateOne(query, {
      $set: { image: image.trim() },
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Could not update the category image" });
  }
};

module.exports = { getAdminStats, getAdminBorrows, updateCategoryImage };
