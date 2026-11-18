// User roles: member (default), librarian (manages books), admin
// (manages users). A librarian is not an admin: user management stays
// admin-only.
const ROLES = ["member", "librarian", "admin"];

// Emails listed in ADMIN_EMAILS become admins automatically on first login
// (and are re-promoted on every profile read, so setting the variable later
// still works).
const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const isAdminEmail = (email) =>
  !!email && getAdminEmails().includes(email.toLowerCase());

const roleForEmail = (email) => (isAdminEmail(email) ? "admin" : "member");

const isValidRole = (role) => ROLES.includes(role);

module.exports = {
  ROLES,
  getAdminEmails,
  isAdminEmail,
  roleForEmail,
  isValidRole,
};
