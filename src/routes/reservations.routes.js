const express = require("express");
const verifyToken = require("../middlewares/verifyToken");
const optionalToken = require("../middlewares/optionalToken");
const {
  getBookReservations,
  getMyReservations,
  addReservation,
  deleteReservation,
} = require("../controllers/reservations.controller");

const router = express.Router();

// Reading a book's queue is public; optionalToken only adds the `isMine`
// flag for signed-in callers. Reserving or cancelling needs a signed-in
// user.
router.get("/books/:bookId/reservations", optionalToken, getBookReservations);
router.get("/reservations", verifyToken, getMyReservations);
router.post("/books/:bookId/reservations", verifyToken, addReservation);
router.delete(
  "/books/:bookId/reservations/:reservationId",
  verifyToken,
  deleteReservation
);

module.exports = router;
