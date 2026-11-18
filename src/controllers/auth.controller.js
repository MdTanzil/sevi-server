const jwt = require("jsonwebtoken");

// jwt token create request
const createToken = async (req, res) => {
  const body = req.body;
  // console.log(body);
  //generating Token
  const token = jwt.sign(body, process.env.SECRET_KEY, { expiresIn: "10h" });
  // console.log(token);
  // sending Token in cookies with a status
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
    .send({ success: true });
};

// jwt token clear request (logout). The cookie options must match the ones
// used when the cookie was set, otherwise the browser will not clear it.
const logout = async (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
    .send({ success: true });
};

module.exports = { createToken, logout };
