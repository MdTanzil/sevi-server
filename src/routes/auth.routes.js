const express = require("express");
const { createToken } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/jwt", createToken);

module.exports = router;
