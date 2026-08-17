const path = require("node:path");
const express = require("express");
const config = require("../config");

const router = express.Router();

router.get("/health", (req, res) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    return res.sendFile(path.join(config.publicDir, "health.html"));
  }

  res.type("text/plain").send("Service is running. Nice IP you've got there.");
});

router.get("/health-raccoon.jpg", (_req, res) => {
  res.sendFile(path.join(config.publicDir, "health-raccoon.jpg"));
});

module.exports = router;
