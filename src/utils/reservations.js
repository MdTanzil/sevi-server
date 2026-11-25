const { ObjectId } = require("mongodb");
const db = require("../config/db");

// When a book's quantity goes from 0 to above 0, the first
// `availableCount` people in the reservation queue get one in-app
// notification each — the book they reserved is available. A user who
// already has an UNREAD reservation notification for the same book does
// not get a second one (the first one still tells them it is back).
// This never throws: a notification failure must not break the stock
// update that triggered it.
const notifyReservists = async (bookId, bookName, availableCount) => {
  try {
    if (!availableCount || availableCount < 1) return;
    const queue = await db.reservationsCollection
      .find({ bookId })
      .sort({ createdAt: 1 })
      .limit(availableCount)
      .project({ email: 1 })
      .toArray();
    for (const { email } of queue) {
      const existing = await db.notificationsCollection.findOne({
        email,
        type: "reservation",
        bookId,
        read: false,
      });
      if (existing) continue;
      await db.notificationsCollection.insertOne({
        email,
        type: "reservation",
        bookId,
        bookName,
        message: `The book you reserved, "${bookName}", is available now — borrow it while copies last.`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error(
      "Could not create reservation notifications:",
      error.message
    );
  }
};

// Borrowing fulfils a reservation: remove the borrower's reservation for
// this book, if they had one. Reservation records store bookId as an
// ObjectId while borrow records store it as a string, so both forms are
// matched. Never throws: a failed cleanup must not fail the borrow.
const clearReservationForBorrow = async (email, bookId) => {
  try {
    const forms = [bookId];
    try {
      forms.push(new ObjectId(bookId));
    } catch {
      // Not an ObjectId string — the string form is enough.
    }
    await db.reservationsCollection.deleteOne({
      email,
      bookId: { $in: forms },
    });
  } catch (error) {
    console.error(
      "Could not clear the reservation for a borrow:",
      error.message
    );
  }
};

module.exports = { notifyReservists, clearReservationForBorrow };
