// Normalize the optional book metadata fields before saving:
// trim text fields (drop them when empty) and coerce year/pages to
// numbers (drop them when missing or not a number). All other fields
// are left exactly as they arrive.
const normalizeBook = (book) => {
  const normalized = { ...book };
  ["isbn", "publisher", "language"].forEach((field) => {
    const value = normalized[field];
    if (value === undefined || value === null) {
      delete normalized[field];
    } else if (typeof value === "string") {
      normalized[field] = value.trim();
      if (!normalized[field]) delete normalized[field];
    }
  });
  ["publishedYear", "pages"].forEach((field) => {
    const value = normalized[field];
    if (value === undefined || value === null || value === "") {
      delete normalized[field];
      return;
    }
    const num = Number(value);
    if (Number.isNaN(num)) delete normalized[field];
    else normalized[field] = num;
  });
  return normalized;
};

module.exports = normalizeBook;
