const express = require("express");
const { signup, login, socialLogin, socialCallback } = require("../controllers/userController");
const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/social", socialLogin);
router.get("/callback", socialCallback);

module.exports = router;
