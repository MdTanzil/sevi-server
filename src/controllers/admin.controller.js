const { ObjectId } = require("mongodb");
const db = require("../config/db");
const {
  validateReturnDate,
  countActiveBorrows,
  MAX_ACTIVE_BORROWS,
} = require("./borrows.controller");
const { quantityOf, notifyRestock } = require("../utils/restock");
const getTokenEmail = require("../utils/tokenEmail");

// How far out a librarian/admin may push a return date (the member
// borrow rule is 5 days; the admin override window is 30).
const ADMIN_MAX_RETURN_DAYS = 30;

// Escape a string for use inside a RegExp — category names are user
// input and may contain regex characters.
const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Case-insensitive exact-match query on a category name.
const categoryNameQuery = (name) => ({
  name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" },
});

// Parse an https URL, or null when the value is not one.
const parseHttpsUrl = (value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

// Parse a MongoDB ObjectId from a route param, or null when malformed.
const objectIdOrNull = (value) => {
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
};

// A return date arrives as `retunDate` (the borrow record's field name)
// from the dashboard dialogs; accept `returnDate` too for callers that
// use the plain spelling. Returns the trimmed value or "".
const returnDateFromBody = (body) => {
  const value = body?.retunDate ?? body?.returnDate;
  return typeof value === "string" ? value.trim() : "";
};

// Admin dashboard aggregates (librarian/admin only — see admin.routes.js).
//
// A borrow is active unless it was returned. Documents without a status
// field predate the status feature and count as borrowed: in MongoDB, $ne
// matches documents where the field is missing (same rule as
// activeBorrowQuery in borrows.controller.js).
const activeBorrowFilter = { status: { $ne: "returned" } };

// Book quantities are stored exactly as sent (the web form sends them as
// strings), so numeric work converts defensively via quantityOf from
// restock.js: non-numeric or missing quantities count as 0.

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

// POST /admin/categories — create a category. The name must be unique
// (case-insensitive); the image is optional but must be an https URL.
const createCategory = async (req, res) => {
  try {
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).send({ error: "A category name is required." });
      return;
    }
    const taken = await db.categoriesCollection.findOne(
      categoryNameQuery(name)
    );
    if (taken) {
      res
        .status(409)
        .send({ error: `A category named "${name}" already exists.` });
      return;
    }
    const doc = { name };
    const image = req.body?.image;
    if (typeof image === "string" && image.trim() !== "") {
      if (!parseHttpsUrl(image)) {
        res
          .status(400)
          .send({ error: "The image must be a valid https URL." });
        return;
      }
      doc.image = image.trim();
    }
    const result = await db.categoriesCollection.insertOne(doc);
    res.status(201).send({ ...doc, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ error: "Could not create the category" });
  }
};

// PATCH /admin/categories/:id — update a category's name and/or image.
// A rename also updates every book that references the old name, so the
// catalogue stays consistent (books store the category name, not an id).
// An empty image string clears the image (the placeholder shows instead).
const updateCategory = async (req, res) => {
  try {
    const id = objectIdOrNull(req.params.id);
    if (!id) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const record = await db.categoriesCollection.findOne({ _id: id });
    if (!record) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const updates = {};
    let clearImage = false;
    if (req.body?.name !== undefined) {
      const name =
        typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!name) {
        res.status(400).send({ error: "A category name is required." });
        return;
      }
      if (name !== record.name) {
        const taken = await db.categoriesCollection.findOne({
          ...categoryNameQuery(name),
          _id: { $ne: id },
        });
        if (taken) {
          res
            .status(409)
            .send({ error: `A category named "${name}" already exists.` });
          return;
        }
        updates.name = name;
      }
    }
    if (req.body?.image !== undefined) {
      const image = req.body.image;
      if (typeof image === "string" && image.trim() !== "") {
        if (!parseHttpsUrl(image)) {
          res
            .status(400)
            .send({ error: "The image must be a valid https URL." });
          return;
        }
        updates.image = image.trim();
      } else if (image === "" || image === null) {
        clearImage = true;
      } else {
        res
          .status(400)
          .send({ error: "The image must be a valid https URL." });
        return;
      }
    }
    const updateDoc = {};
    if (Object.keys(updates).length > 0) updateDoc.$set = updates;
    if (clearImage) updateDoc.$unset = { image: "" };
    if (Object.keys(updateDoc).length > 0) {
      await db.categoriesCollection.updateOne({ _id: id }, updateDoc);
    }
    let booksUpdated = 0;
    if (updates.name) {
      const books = await db.booksCollection.updateMany(
        { category: record.name },
        { $set: { category: updates.name } }
      );
      booksUpdated = books.modifiedCount;
    }
    const category = await db.categoriesCollection.findOne({ _id: id });
    res.send({ category, booksUpdated });
  } catch (error) {
    res.status(500).send({ error: "Could not update the category" });
  }
};

// DELETE /admin/categories/:id — delete a category. Refused with 409
// while any book references the category name.
const deleteCategory = async (req, res) => {
  try {
    const id = objectIdOrNull(req.params.id);
    if (!id) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const record = await db.categoriesCollection.findOne({ _id: id });
    if (!record) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const inUse = await db.booksCollection.countDocuments({
      category: record.name,
    });
    if (inUse > 0) {
      res.status(409).send({
        error: `Cannot delete "${record.name}" — ${inUse} book(s) use this category.`,
      });
      return;
    }
    await db.categoriesCollection.deleteOne({ _id: id });
    res.send({ deleted: true, categoryId: req.params.id });
  } catch (error) {
    res.status(500).send({ error: "Could not delete the category" });
  }
};

// GET /admin/users — user list for librarians and admins (the dashboard
// needs names for the borrow tracking summary and the lend dialog; the
// admin-only GET /users stays as the full management list).
const listAdminUsers = async (req, res) => {
  try {
    const users = await db.usersCollection
      .find({}, { projection: { email: 1, name: 1, role: 1 } })
      .sort({ name: 1 })
      .toArray();
    res.send(users);
  } catch (error) {
    res.status(500).send({ error: "Could not load users" });
  }
};

// POST /admin/users — create a member record for a walk-in visitor who
// has no online account yet, so the librarian can lend to them and
// track their borrows. When the person later signs up online with the
// same email, GET /profile returns this existing profile (auto-create
// only fires when missing), so their history and role carry over.
const createUser = async (req, res) => {
  try {
    const email =
      typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).send({ error: "A valid email is required." });
      return;
    }
    if (!name) {
      res.status(400).send({ error: "A name is required." });
      return;
    }
    const taken = await db.usersCollection.findOne({ email });
    if (taken) {
      res
        .status(409)
        .send({ error: `A user with the email ${email} already exists.` });
      return;
    }
    const doc = {
      email,
      name,
      phone:
        typeof req.body?.phone === "string" ? req.body.phone.trim() : "",
      address:
        typeof req.body?.address === "string"
          ? req.body.address.trim()
          : "",
      role: "member",
      createdAt: new Date(),
    };
    const result = await db.usersCollection.insertOne(doc);
    res.status(201).send({ ...doc, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ error: "Could not create the user" });
  }
};

// PUT /admin/users/:email — edit a user's profile fields (name, phone,
// address ONLY). Role has its own endpoint and email its own flow —
// neither is accepted here.
const updateUserProfile = async (req, res) => {
  try {
    const email = req.params.email;
    const updates = {};
    ["name", "phone", "address"].forEach((field) => {
      if (typeof req.body[field] === "string") {
        updates[field] = req.body[field].trim();
      }
    });
    if (Object.keys(updates).length === 0) {
      res.status(400).send({ error: "No profile fields to update." });
      return;
    }
    const result = await db.usersCollection.updateOne(
      { email },
      { $set: updates }
    );
    if (result.matchedCount === 0) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const profile = await db.usersCollection.findOne({ email });
    res.send(profile);
  } catch (error) {
    res.status(500).send({ error: "Could not update the user profile" });
  }
};

// DELETE /admin/users/:email — remove a user (mistaken entries, cleanup).
// An admin cannot delete their own account; a user with an active borrow
// cannot be deleted. The profile, wishlist entries and notifications go;
// borrow history records stay — they are the library's records.
const deleteUser = async (req, res) => {
  try {
    const email = req.params.email;
    const callerEmail = getTokenEmail(req.decode);
    if (
      callerEmail &&
      callerEmail.toLowerCase() === email.toLowerCase()
    ) {
      res
        .status(403)
        .send({ error: "You cannot delete your own account" });
      return;
    }
    const user = await db.usersCollection.findOne({ email });
    if (!user) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const activeBorrows = await db.borrowCollection.countDocuments({
      email,
      ...activeBorrowFilter,
    });
    if (activeBorrows > 0) {
      res.status(409).send({
        error: `Cannot delete ${email} — they have ${activeBorrows} active borrow(s).`,
      });
      return;
    }
    await db.usersCollection.deleteOne({ email });
    const wishlists = await db.wishlistCollection.deleteMany({ email });
    const notifications = await db.notificationsCollection.deleteMany({
      email,
    });
    res.send({
      deleted: true,
      email,
      wishlistsRemoved: wishlists.deletedCount,
      notificationsRemoved: notifications.deletedCount,
    });
  } catch (error) {
    res.status(500).send({ error: "Could not delete the user" });
  }
};

// GET /admin/users/:email/borrows — ALL borrows (active + returned) for
// one user, newest first.
const getUserBorrows = async (req, res) => {
  try {
    const email = req.params.email;
    const user = await db.usersCollection.findOne({ email });
    if (!user) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const borrows = await db.borrowCollection
      .find({ email })
      .sort({ borrowedDate: -1 })
      .toArray();
    res.send(borrows);
  } catch (error) {
    res.status(500).send({ error: "Could not load the user's borrows" });
  }
};

// POST /admin/borrows — lend a book to a user on their behalf (walk-in
// members, phone requests). Mirrors POST /borrow: same 5-day return
// rule, same 3-active-borrows limit, same out-of-stock guard — but the
// borrower is the named user, not the caller. The quantity is decremented
// here (the member flow decrements from the client).
const adminLendBorrow = async (req, res) => {
  try {
    const userEmail =
      typeof req.body?.userEmail === "string"
        ? req.body.userEmail.trim()
        : "";
    if (!userEmail) {
      res.status(400).send({ error: "A user email is required." });
      return;
    }
    const user = await db.usersCollection.findOne({ email: userEmail });
    if (!user) {
      res
        .status(404)
        .send({ error: `No user found with the email ${userEmail}.` });
      return;
    }
    const id = objectIdOrNull(req.body?.bookId);
    if (!id) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const book = await db.booksCollection.findOne({ _id: id });
    if (!book) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const returnDate = returnDateFromBody(req.body);
    const dateError = validateReturnDate(returnDate);
    if (dateError) {
      res.status(400).send({ error: dateError });
      return;
    }
    if (quantityOf(book) < 1) {
      res.status(400).send({ error: "This book is out of stock." });
      return;
    }
    const activeCount = await countActiveBorrows(
      db.borrowCollection,
      userEmail
    );
    if (activeCount >= MAX_ACTIVE_BORROWS) {
      res.status(400).send({ error: "Borrow limit reached (3 books)" });
      return;
    }
    const borrow = {
      name: user.name || userEmail,
      bookName: book.name || "",
      bookImage: book.imageUrl || "",
      bookCategorie: book.category || "",
      author: book.author || "",
      email: userEmail,
      bookId: book._id.toString(),
      retunDate: returnDate,
      borrowedDate: new Date().toISOString().split("T")[0],
      status: "borrowed",
    };
    const result = await db.borrowCollection.insertOne(borrow);
    await db.booksCollection.updateOne(
      { _id: id },
      { $set: { quantity: quantityOf(book) - 1 } }
    );
    res.status(201).send({ ...borrow, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ error: "Could not lend the book" });
  }
};

// PATCH /admin/borrows/:id — change the return date of an ACTIVE borrow.
// Admin override window: today .. today + 30 days (the member 5-day rule
// does not apply here).
const updateBorrowReturnDate = async (req, res) => {
  try {
    const id = objectIdOrNull(req.params.id);
    if (!id) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const record = await db.borrowCollection.findOne({ _id: id });
    if (!record) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    if (record.status === "returned") {
      res
        .status(400)
        .send({ error: "This book was already returned." });
      return;
    }
    const returnDate = returnDateFromBody(req.body);
    const dateError = validateReturnDate(
      returnDate,
      new Date(),
      ADMIN_MAX_RETURN_DAYS,
      0
    );
    if (dateError) {
      res.status(400).send({ error: dateError });
      return;
    }
    await db.borrowCollection.updateOne(
      { _id: id },
      { $set: { retunDate: returnDate } }
    );
    const updated = await db.borrowCollection.findOne({ _id: id });
    res.send(updated);
  } catch (error) {
    res.status(500).send({ error: "Could not update the return date" });
  }
};

// POST /admin/borrows/:id/return — mark a borrow returned on the
// borrower's behalf (book handed back at the desk). Sets status
// "returned" + returnedDate and restores the book quantity by 1 —
// the member flow restores the quantity from the client, the admin flow
// does it here so one call completes the return.
const adminReturnBorrow = async (req, res) => {
  try {
    const id = objectIdOrNull(req.params.id);
    if (!id) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const record = await db.borrowCollection.findOne({ _id: id });
    if (!record) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    if (record.status === "returned") {
      res
        .status(400)
        .send({ error: "This book was already returned." });
      return;
    }
    await db.borrowCollection.updateOne(
      { _id: id },
      {
        $set: {
          status: "returned",
          returnedDate: new Date().toISOString().split("T")[0],
        },
      }
    );
    let quantityRestored = false;
    const bookId = objectIdOrNull(record.bookId);
    if (bookId) {
      const book = await db.booksCollection.findOne({ _id: bookId });
      if (book) {
        const wasOutOfStock = quantityOf(book) < 1;
        await db.booksCollection.updateOne(
          { _id: bookId },
          { $set: { quantity: quantityOf(book) + 1 } }
        );
        quantityRestored = true;
        if (wasOutOfStock) {
          await notifyRestock(book._id, book.name);
        }
      }
    }
    const updated = await db.borrowCollection.findOne({ _id: id });
    res.send({ ...updated, quantityRestored });
  } catch (error) {
    res.status(500).send({ error: "Could not return the book" });
  }
};

module.exports = {
  getAdminStats,
  getAdminBorrows,
  createCategory,
  updateCategory,
  deleteCategory,
  listAdminUsers,
  createUser,
  updateUserProfile,
  deleteUser,
  getUserBorrows,
  adminLendBorrow,
  updateBorrowReturnDate,
  adminReturnBorrow,
};
