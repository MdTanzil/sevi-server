const express = require("express");
const { getCategories } = require("../controllers/categories.controller");

const router = express.Router();

router.get("/categories", getCategories);

module.exports = router;
