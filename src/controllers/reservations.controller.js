const { ObjectId } = require("mongodb");
const db = require("../config/db");
const getTokenEmail = require("../utils/tokenEmail");
const { quantityOf } = require("../utils/restock");

// Reservations (the hold queue) live in their own collection. A member
// reserves a book that is out of stock; when the book comes back, the
// first people in the queue are notified (see utils/reservations.js).
// Reservations store bookId as an ObjectId, like wishlist entries.
const MAX_RESERVER_NAME_LENGTH = 100;

// The reserving user's email always comes from the verified JWT
// (req.decode), never from the request body or query string. Returns null
// and sends a 401 when the token carries no email.
const getOwnerEmail = (req, res) => {
  const email = getTokenEmail(req.decode);
  if (!email) {
    res.status(401).send({ status: "unAuthorized Access", code: "401" });
    return null;
  }
  return email;
};

// Parse an id from a route param. Returns the ObjectId, or null after
// sending a 400 for a malformed id.
const parseId = (value, res, what) => {
  try {
    return new ObjectId(value);
  } catch {
    res.status(400).send({ error: `A valid ${what} id is required.` });
    return null;
  }
};

// Public shape of a reservation: the reserver's email is never exposed —
// ownership is conveyed with `isMine` instead (true only when the
// caller is signed in and the reservation is theirs). `position` is the
// 1-based place in the queue (oldest reservation first).
const publicReservation = (reservation, position, callerEmail) => ({
  _id: reservation._id,
  bookId: reservation.bookId,
  reserverName: reservation.reserverName,
  createdAt: reservation.createdAt,
  position,
  isMine: callerEmail ? reservation.email === callerEmail : false,
});

// GET /books/:bookId/reservations — public, oldest first (the queue
// order). Returns { reservations, count }.
const getBookReservations = async (req, res) => {
  try {
    const bookId = parseId(req.params.bookId, res, "book");
    if (!bookId) return;
    const book = await db.booksCollection.findOne({ _id: bookId });
    if (!book) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const queue = await db.reservationsCollection
      .find({ bookId })
      .sort({ createdAt: 1 })
      .toArray();
    const callerEmail = getTokenEmail(req.decode);
    res.send({
      reservations: queue.map((reservation, index) =>
        publicReservation(reservation, index + 1, callerEmail)
      ),
      count: queue.length,
    });
  } catch (error) {
    res.status(500).send({ error: "Could not load the reservations" });
  }
};

// GET /reservations — the token owner's reservations, newest first. Each
// entry carries the book's current details (title, author, cover,
// quantity) and the caller's position in that book's queue, so the
// client needs no extra lookups.
const getMyReservations = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    const mine = await db.reservationsCollection
      .find({ email })
      .sort({ createdAt: -1 })
      .toArray();
    const bookIds = [...new Set(mine.map((entry) => entry.bookId))];
    const books = await db.booksCollection
      .find({ _id: { $in: bookIds } })
      .toArray();
    const byId = new Map(books.map((book) => [String(book._id), book]));
    const result = [];
    for (const entry of mine) {
      const book = byId.get(String(entry.bookId));
      if (!book) continue;
      const queue = await db.reservationsCollection
        .find({ bookId: entry.bookId })
        .sort({ createdAt: 1 })
        .project({ email: 1 })
        .toArray();
      const position =
        queue.findIndex((queued) => queued.email === email) + 1;
      result.push({
        _id: entry._id,
        bookId: entry.bookId,
        reserverName: entry.reserverName,
        createdAt: entry.createdAt,
        position,
        book: {
          _id: book._id,
          name: book.name,
          author: book.author,
          imageUrl: book.imageUrl,
          quantity: book.quantity,
        },
      });
    }
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Could not load your reservations" });
  }
};

// POST /books/:bookId/reservations — reserve an out-of-stock book. One
// reservation per user per book (409 on a second). The reserver name is
// a display label from the client (their Firebase display name); the
// email always comes from the JWT.
const addReservation = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    const bookId = parseId(req.params.bookId, res, "book");
    if (!bookId) return;
    const book = await db.booksCollection.findOne({ _id: bookId });
    if (!book) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    if (quantityOf(book) >= 1) {
      res.status(400).send({
        error: "Only out-of-stock books can be reserved — this one is available to borrow.",
      });
      return;
    }
    const existing = await db.reservationsCollection.findOne({
      email,
      bookId,
    });
    if (existing) {
      res.status(409).send({
        error: "You have already reserved this book.",
      });
      return;
    }
    const rawName = req.body?.reserverName;
    const reserverName =
      typeof rawName === "string" && rawName.trim() !== ""
        ? rawName.trim().slice(0, MAX_RESERVER_NAME_LENGTH)
        : email;
    const reservation = {
      email,
      bookId,
      reserverName,
      createdAt: new Date().toISOString(),
    };
    const result = await db.reservationsCollection.insertOne(reservation);
    const position =
      (await db.reservationsCollection.countDocuments({ bookId })) || 1;
    res
      .status(201)
      .send({ ...publicReservation(reservation, position, email), _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ error: "Could not save the reservation" });
  }
};

// DELETE /books/:bookId/reservations/:reservationId — the reserver, or
// an admin (moderation), cancels a reservation.
const deleteReservation = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    const bookId = parseId(req.params.bookId, res, "book");
    if (!bookId) return;
    const reservationId = parseId(req.params.reservationId, res, "reservation");
    if (!reservationId) return;
    const reservation = await db.reservationsCollection.findOne({
      _id: reservationId,
      bookId,
    });
    if (!reservation) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const isOwner = reservation.email === email;
    let isAdmin = false;
    if (!isOwner) {
      const profile = await db.usersCollection.findOne({ email });
      isAdmin = profile?.role === "admin";
    }
    if (!isOwner && !isAdmin) {
      res.status(403).send({ status: "Forbidden", code: "403" });
      return;
    }
    const result = await db.reservationsCollection.deleteOne({
      _id: reservationId,
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Could not cancel the reservation" });
  }
};

module.exports = {
  getBookReservations,
  getMyReservations,
  addReservation,
  deleteReservation,
};
