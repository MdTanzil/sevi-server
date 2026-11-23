const jwt = require("jsonwebtoken");

// Like verifyToken, but never rejects: when a valid token cookie is
// present, req.decode is set so the handler can personalise the
// response (e.g. flag the caller's own reviews); otherwise the request
// proceeds as anonymous. Use for public reads that behave slightly
// differently for signed-in users.
const optionalToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    next();
    return;
  }
  jwt.verify(token, process.env.SECRET_KEY, (error, decode) => {
    if (!error) {
      req.decode = decode;
    }
    next();
  });
};

module.exports = optionalToken;
