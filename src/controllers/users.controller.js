const db = require("../config/db");
const getTokenEmail = require("../utils/tokenEmail");
const { isAdminEmail, roleForEmail, isValidRole } = require("../utils/roles");

// The caller's email always comes from the verified JWT (req.decode).
// Returns null and sends a 401 when the token carries no email.
const getCallerEmail = (req, res) => {
  const email = getTokenEmail(req.decode);
  if (!email) {
    res.status(401).send({ status: "unAuthorized Access", code: "401" });
    return null;
  }
  return email;
};

// Find the caller's profile, creating it on first access. Admin emails are
// promoted to admin even when the profile already exists, so setting
// ADMIN_EMAILS after the first login still takes effect.
const ensureProfile = async (email, nameFromToken) => {
  let profile = await db.usersCollection.findOne({ email });
  if (!profile) {
    const doc = {
      email,
      name: nameFromToken || "",
      phone: "",
      address: "",
      role: roleForEmail(email),
      createdAt: new Date(),
    };
    await db.usersCollection.insertOne(doc);
    profile = doc;
  } else if (isAdminEmail(email) && profile.role !== "admin") {
    await db.usersCollection.updateOne(
      { email },
      { $set: { role: "admin" } }
    );
    profile = { ...profile, role: "admin" };
  }
  return profile;
};

// get the caller's own profile (auto-created on first access)
const getProfile = async (req, res) => {
  const email = getCallerEmail(req, res);
  if (!email) return;
  const nameFromToken =
    req.decode && typeof req.decode === "object"
      ? req.decode.name
      : undefined;
  const profile = await ensureProfile(email, nameFromToken);
  res.send(profile);
};

// update the caller's own name, phone and address. Role and email can never
// be changed through this endpoint.
const updateProfile = async (req, res) => {
  const email = getCallerEmail(req, res);
  if (!email) return;
  await ensureProfile(email);
  const updates = {};
  ["name", "phone", "address"].forEach((field) => {
    if (typeof req.body[field] === "string") {
      updates[field] = req.body[field].trim();
    }
  });
  if (Object.keys(updates).length > 0) {
    await db.usersCollection.updateOne({ email }, { $set: updates });
  }
  const profile = await db.usersCollection.findOne({ email });
  res.send(profile);
};

// migrate the caller's profile and borrows to a new email address. The JWT
// proves control of the OLD email; the client only calls this after Firebase
// confirms the email change (verifyBeforeUpdateEmail).
const updateEmail = async (req, res) => {
  const email = getCallerEmail(req, res);
  if (!email) return;
  const newEmail =
    typeof req.body.newEmail === "string" ? req.body.newEmail.trim() : "";
  if (!newEmail || !newEmail.includes("@")) {
    res.status(400).send({ error: "A valid new email is required" });
    return;
  }
  if (newEmail.toLowerCase() === email.toLowerCase()) {
    res.status(400).send({ error: "The new email must be different" });
    return;
  }
  const taken = await db.usersCollection.findOne({ email: newEmail });
  if (taken) {
    res.status(409).send({ error: "That email is already in use" });
    return;
  }
  await db.usersCollection.updateOne({ email }, { $set: { email: newEmail } });
  await db.borrowCollection.updateMany(
    { email },
    { $set: { email: newEmail } }
  );
  res.send({ success: true, email: newEmail });
};

// list all users (admin only)
const listUsers = async (req, res) => {
  const users = await db.usersCollection
    .find({}, { projection: { email: 1, name: 1, role: 1, createdAt: 1 } })
    .sort({ createdAt: 1 })
    .toArray();
  res.send(users);
};

// change a user's role (admin only). An admin cannot change their own role,
// so the last admin can never lock themselves out.
const updateUserRole = async (req, res) => {
  const callerEmail = getCallerEmail(req, res);
  if (!callerEmail) return;
  const targetEmail = req.params.email;
  const { role } = req.body;
  if (!isValidRole(role)) {
    res.status(400).send({ error: "Invalid role" });
    return;
  }
  if (targetEmail.toLowerCase() === callerEmail.toLowerCase()) {
    res.status(403).send({ error: "You cannot change your own role" });
    return;
  }
  const result = await db.usersCollection.updateOne(
    { email: targetEmail },
    { $set: { role } }
  );
  if (result.matchedCount === 0) {
    res.status(404).send({ status: "Not Found", code: "404" });
    return;
  }
  res.send({ success: true, email: targetEmail, role });
};

module.exports = {
  ensureProfile,
  getProfile,
  updateProfile,
  updateEmail,
  listUsers,
  updateUserRole,
};
