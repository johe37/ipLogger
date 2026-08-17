const express = require("express");

const router = express.Router();

router.get("/", (_req, res) => {
  res.send("IP Logger is running");
});

module.exports = router;
