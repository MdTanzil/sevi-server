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
const quantityAsInt = {
  $convert: { input: "$quantity", to: "int", onError: 0, onFailure: 0 },
};

// GET /admin/stats — library-wide counts for the dashboard.
const getAdminStats = async (req, res) => {
  // YYYY-MM-DD (UTC). Return dates are stored as YYYY-MM-DD strings, so a
  // plain string comparison finds the past-due ones.
  const today = new Date().toISOString().split("T")[0];
  const [
    totalBooks,
    totalUsers,
    totalBorrows,
    activeBorrows,
    overdueBorrows,
    outOfStockBooks,
    copies,
  ] = await Promise.all([
    db.booksCollection.countDocuments(),
    db.usersCollection.countDocuments(),
    db.borrowCollection.countDocuments(),
    db.borrowCollection.countDocuments(activeBorrowFilter),
    db.borrowCollection.countDocuments({
      ...activeBorrowFilter,
      retunDate: { $lt: today },
    }),
    db.booksCollection.countDocuments({
      $expr: { $eq: [quantityAsInt, 0] },
    }),
    db.booksCollection
      .aggregate([{ $group: { _id: null, total: { $sum: quantityAsInt } } }])
      .toArray(),
  ]);
  res.send({
    totalBooks,
    totalCopies: copies[0]?.total || 0,
    totalUsers,
    totalBorrows,
    activeBorrows,
    overdueBorrows,
    outOfStockBooks,
  });
};

// GET /admin/borrows — every user's ACTIVE borrows, most recent first.
const getAdminBorrows = async (req, res) => {
  const result = await db.borrowCollection
    .find(activeBorrowFilter)
    .sort({ borrowedDate: -1 })
    .toArray();
  res.send(result);
};

module.exports = { getAdminStats, getAdminBorrows };
