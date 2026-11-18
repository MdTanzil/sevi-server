const jwt = require("jsonwebtoken");

// jwt authentication middleware

const verifyToken = (req, res, next) => {
  //Coockies ache kina check koro
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).send({ status: "unAuthorized Access", code: "401" });
    return;
  }

  jwt.verify(token, process.env.SECRET_KEY, (error, decode) => {
    if (error) {
      res.status(401).send({ status: "unAuthorized Access", code: "401" });
      return;
    }
    // console.log(decode);
    req.decode = decode;
    next();
  });
};

module.exports = verifyToken;
