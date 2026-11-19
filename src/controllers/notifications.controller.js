const { ObjectId } = require("mongodb");
const db = require("../config/db");
const getTokenEmail = require("../utils/tokenEmail");

// The notification owner's email always comes from the verified JWT
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

// GET /notifications — the token owner's notifications, newest first.
const getNotifications = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    const result = await db.notificationsCollection
      .find({ email })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Could not load your notifications" });
  }
};

// PATCH /notifications/:id/read — mark one notification as read. Only
// the owner can mark their own notification: a notification that belongs
// to someone else looks exactly like a missing one (404).
const markNotificationRead = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    let query;
    try {
      query = { _id: new ObjectId(req.params.id) };
    } catch {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const record = await db.notificationsCollection.findOne(query);
    if (!record || record.email !== email) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const result = await db.notificationsCollection.updateOne(query, {
      $set: { read: true },
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Could not mark the notification as read" });
  }
};

// PATCH /notifications/read-all — mark all of the token owner's
// notifications as read.
const markAllNotificationsRead = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    const result = await db.notificationsCollection.updateMany(
      { email, read: false },
      { $set: { read: true } }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Could not mark notifications as read" });
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
