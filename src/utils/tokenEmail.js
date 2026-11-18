// Extract the user's email from a decoded JWT payload.
//
// Login issues { email } object payloads. A plain string payload is handled
// too, so tokens issued before the payload shape was standardized keep
// working. Returns null when the token carries no email.
const getTokenEmail = (decoded) => {
  if (!decoded) return null;
  if (typeof decoded === "string") return decoded;
  return decoded.email || null;
};

module.exports = getTokenEmail;
