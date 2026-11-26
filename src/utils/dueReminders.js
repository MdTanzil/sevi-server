const db = require("../config/db");

// Due-date reminders: for each of the user's ACTIVE borrows, create an
// in-app notification when the book is due tomorrow (or today), and
// another when it goes overdue. One unread reminder per (user, book,
// kind) — no duplicates while one is still unread. When a book goes
// overdue, its stale due-soon reminder is removed. Reminders for books
// the user no longer has on loan (returned since the reminder was
// created) are pruned — read or unread — so the bell never shows a due
// reminder for a book that is already back.
//
// This runs lazily whenever the user's notifications are listed — the
// navbar bell polls that endpoint every minute while signed in — so no
// scheduler or background job is needed. All comparisons use UTC
// calendar dates, the same convention as the server's other date checks
// (the loan-extension overdue check). This never throws: a reminder
// failure must not break the notification list that triggered it.
const parseDateOnly = (value) => {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
};

const utcToday = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
};

const checkDueReminders = async (email) => {
  try {
    const active = await db.borrowCollection
      .find({ email, status: { $ne: "returned" } })
      .project({ bookId: 1, bookName: 1, retunDate: 1 })
      .toArray();
    const today = utcToday();
    const activeBookIds = new Set(
      active.map((borrow) => String(borrow.bookId))
    );

    // Prune: due reminders for books the user no longer has on loan
    // (returned since the reminder was created) — read or unread, so a
    // reminder that was already opened still disappears once the book
    // is back.
    await db.notificationsCollection.deleteMany({
      email,
      type: { $in: ["due-soon", "overdue"] },
      bookId: { $nin: [...activeBookIds] },
    });

    for (const borrow of active) {
      const due = parseDateOnly(borrow.retunDate);
      if (!due) continue;
      const daysUntilDue = Math.round((due - today) / 86400000);
      const bookId = borrow.bookId;
      const bookName = borrow.bookName || "A borrowed book";
      if (daysUntilDue < 0) {
        // Overdue: replace any due-soon reminder for this book, read or
        // not — its "due back on" wording is stale now.
        await db.notificationsCollection.deleteMany({
          email,
          type: "due-soon",
          bookId,
        });
        const existing = await db.notificationsCollection.findOne({
          email,
          type: "overdue",
          bookId,
          read: false,
        });
        if (existing) continue;
        await db.notificationsCollection.insertOne({
          email,
          type: "overdue",
          bookId,
          bookName,
          message: `"${bookName}" is overdue — it was due back on ${borrow.retunDate}. Please return it as soon as you can.`,
          read: false,
          createdAt: new Date().toISOString(),
        });
      } else if (daysUntilDue <= 1) {
        const existing = await db.notificationsCollection.findOne({
          email,
          type: "due-soon",
          bookId,
          read: false,
        });
        if (existing) continue;
        await db.notificationsCollection.insertOne({
          email,
          type: "due-soon",
          bookId,
          bookName,
          message: `"${bookName}" is due back on ${borrow.retunDate} — return it on time to avoid it going overdue.`,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error("Could not check due-date reminders:", error.message);
  }
};

module.exports = { checkDueReminders };
