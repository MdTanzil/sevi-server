const express = require("express");
const { createToken, logout } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/jwt", createToken);
router.post("/logout", logout);

module.exports = router;
