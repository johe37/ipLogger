const path = require("node:path");
const express = require("express");
const config = require("../config");
const db = require("../db");
const { clampInt } = require("../lib/util");
const { requireDashboardAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/dashboard", requireDashboardAuth, (_req, res) => {
  res.sendFile(path.join(config.publicDir, "dashboard.html"));
});

router.get("/api/stats", requireDashboardAuth, (_req, res) => {
  res.json(db.getStats());
});

router.get("/api/visits", requireDashboardAuth, (req, res) => {
  const limit = clampInt(req.query.limit, 100, 1, 500);
  const offset = clampInt(req.query.offset, 0, 0, 1_000_000);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const country =
    typeof req.query.country === "string" ? req.query.country.trim() : "";

  res.json(db.listVisits({ q, country, limit, offset }));
});

router.get("/api/visits/:id", requireDashboardAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const visit = db.getVisit(id);
  if (!visit) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(visit);
});

module.exports = router;
