const { ObjectId } = require("mongodb");
const db = require("../config/db");
const getTokenEmail = require("../utils/tokenEmail");

// Reviews live in their own collection; the book's own `rating` field
// (a 0-10 catalog value) is unrelated. Review ratings are 1-5 stars and
// the average is computed on read, so there is no denormalised value to
// keep in sync.
const MAX_REVIEW_TEXT_LENGTH = 1000;
const MAX_REVIEWER_NAME_LENGTH = 100;

// The reviewer's email always comes from the verified JWT (req.decode),
// never from the request body or query string. Returns null and sends a
// 401 when the token carries no email.
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

// Validate a review body: rating must be an integer from 1 to 5, text
// (optional) at most MAX_REVIEW_TEXT_LENGTH characters. Returns an error
// message string, or null when valid.
const validateReviewInput = (body) => {
  const { rating, text } = body || {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return "A star rating from 1 to 5 is required.";
  }
  if (text !== undefined && text !== null && typeof text !== "string") {
    return "The review text must be a string.";
  }
  if (typeof text === "string" && text.length > MAX_REVIEW_TEXT_LENGTH) {
    return `The review text must be at most ${MAX_REVIEW_TEXT_LENGTH} characters.`;
  }
  return null;
};

// Average of the review ratings, rounded to one decimal, or null when
// there are no reviews yet.
const averageRating = (reviews) => {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
};

// Public shape of a review: the reviewer's email is never exposed —
// ownership is conveyed with `isMine` instead (true only when the
// caller is signed in and the review is theirs).
const publicReview = (review, callerEmail) => ({
  _id: review._id,
  bookId: review.bookId,
  rating: review.rating,
  text: review.text,
  reviewerName: review.reviewerName,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  isMine: callerEmail ? review.email === callerEmail : false,
});

// GET /books/:bookId/reviews — public, newest first. Returns the
// reviews plus the average rating and the review count.
const getBookReviews = async (req, res) => {
  try {
    const bookId = parseId(req.params.bookId, res, "book");
    if (!bookId) return;
    const book = await db.booksCollection.findOne({ _id: bookId });
    if (!book) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const reviews = await db.reviewsCollection
      .find({ bookId })
      .sort({ createdAt: -1 })
      .toArray();
    const callerEmail = getTokenEmail(req.decode);
    res.send({
      reviews: reviews.map((review) => publicReview(review, callerEmail)),
      average: averageRating(reviews),
      count: reviews.length,
    });
  } catch (error) {
    res.status(500).send({ error: "Could not load the reviews" });
  }
};

// POST /books/:bookId/reviews — one review per user per book; a second
// review returns 409 (edit the existing one instead). The reviewer name
// is a display label from the client (their Firebase display name); the
// email always comes from the JWT.
const addBookReview = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    const bookId = parseId(req.params.bookId, res, "book");
    if (!bookId) return;
    const inputError = validateReviewInput(req.body);
    if (inputError) {
      res.status(400).send({ error: inputError });
      return;
    }
    const book = await db.booksCollection.findOne({ _id: bookId });
    if (!book) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const existing = await db.reviewsCollection.findOne({ email, bookId });
    if (existing) {
      res.status(409).send({
        error: "You have already reviewed this book. Edit your review instead.",
      });
      return;
    }
    const rawName = req.body?.reviewerName;
    const reviewerName =
      typeof rawName === "string" && rawName.trim() !== ""
        ? rawName.trim().slice(0, MAX_REVIEWER_NAME_LENGTH)
        : email;
    const review = {
      email,
      bookId,
      rating: req.body.rating,
      text: (req.body.text || "").trim(),
      reviewerName,
      createdAt: new Date().toISOString(),
    };
    const result = await db.reviewsCollection.insertOne(review);
    res.status(201).send({ ...publicReview(review, email), _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ error: "Could not save the review" });
  }
};

// PUT /books/:bookId/reviews/:reviewId — the owner edits their own
// review (rating and/or text). The reviewer name stays as first saved.
const updateBookReview = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    const bookId = parseId(req.params.bookId, res, "book");
    if (!bookId) return;
    const reviewId = parseId(req.params.reviewId, res, "review");
    if (!reviewId) return;
    const inputError = validateReviewInput(req.body);
    if (inputError) {
      res.status(400).send({ error: inputError });
      return;
    }
    const review = await db.reviewsCollection.findOne({
      _id: reviewId,
      bookId,
    });
    if (!review) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    if (review.email !== email) {
      res.status(403).send({ status: "Forbidden", code: "403" });
      return;
    }
    const updatedAt = new Date().toISOString();
    await db.reviewsCollection.updateOne(
      { _id: reviewId },
      {
        $set: {
          rating: req.body.rating,
          text: (req.body.text || "").trim(),
          updatedAt,
        },
      }
    );
    res.send(
      publicReview(
        { ...review, rating: req.body.rating, text: (req.body.text || "").trim(), updatedAt },
        email
      )
    );
  } catch (error) {
    res.status(500).send({ error: "Could not update the review" });
  }
};

// DELETE /books/:bookId/reviews/:reviewId — the owner, or an admin
// (moderation), removes a review.
const deleteBookReview = async (req, res) => {
  try {
    const email = getOwnerEmail(req, res);
    if (!email) return;
    const bookId = parseId(req.params.bookId, res, "book");
    if (!bookId) return;
    const reviewId = parseId(req.params.reviewId, res, "review");
    if (!reviewId) return;
    const review = await db.reviewsCollection.findOne({
      _id: reviewId,
      bookId,
    });
    if (!review) {
      res.status(404).send({ status: "Not Found", code: "404" });
      return;
    }
    const isOwner = review.email === email;
    let isAdmin = false;
    if (!isOwner) {
      const profile = await db.usersCollection.findOne({ email });
      isAdmin = profile?.role === "admin";
    }
    if (!isOwner && !isAdmin) {
      res.status(403).send({ status: "Forbidden", code: "403" });
      return;
    }
    const result = await db.reviewsCollection.deleteOne({ _id: reviewId });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Could not delete the review" });
  }
};

module.exports = {
  MAX_REVIEW_TEXT_LENGTH,
  getBookReviews,
  addBookReview,
  updateBookReview,
  deleteBookReview,
};
