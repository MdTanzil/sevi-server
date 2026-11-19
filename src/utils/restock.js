const db = require("../config/db");

// Book quantities are stored exactly as sent (the web form sends them as
// strings), so numeric work converts defensively: non-numeric or missing
// quantities count as 0.
const quantityOf = (book) => {
  const qty = Number(book?.quantity);
  return Number.isFinite(qty) ? qty : 0;
};

// Restock notifications: when a book's quantity goes from 0 to above 0,
// every user who wishlisted it gets one in-app notification. A user who
// already has an UNREAD restock notification for the same book does not
// get a second one — the first one still tells them the book is back.
// This never throws: a notification failure must not break the stock
// update that triggered it.
const notifyRestock = async (bookId, bookName) => {
  try {
    const entries = await db.wishlistCollection
      .find({ bookId })
      .project({ email: 1 })
      .toArray();
    const emails = [...new Set(entries.map((entry) => entry.email))];
    for (const email of emails) {
      const existing = await db.notificationsCollection.findOne({
        email,
        type: "restock",
        bookId,
        read: false,
      });
      if (existing) continue;
      await db.notificationsCollection.insertOne({
        email,
        type: "restock",
        bookId,
        bookName,
        message: `"${bookName}" is back in stock — you can borrow it now.`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Could not create restock notifications:", error.message);
  }
};

module.exports = { quantityOf, notifyRestock };
