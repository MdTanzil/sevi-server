const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notifications.controller");

const router = express.Router();

// "read-all" must come before ":id/read" — otherwise Express would treat
// "read-all" as a notification id.
router.get("/notifications", verifyToken, getNotifications);
router.patch(
  "/notifications/read-all",
  verifyToken,
  markAllNotificationsRead
);
router.patch("/notifications/:id/read", verifyToken, markNotificationRead);

module.exports = router;
