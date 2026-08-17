const express = require("express");
const db = require("../db");
const { requireIngestAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/api/log", requireIngestAuth, (req, res) => {
  const data = req.body && typeof req.body === "object" ? req.body : {};
  console.log("Received log:", data);

  try {
    db.insertVisit(data);
  } catch (err) {
    console.error("Failed to persist visit:", err);
  }

  res.status(200).json({ status: "ok" });
});

module.exports = router;
