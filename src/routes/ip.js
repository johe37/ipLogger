const express = require("express");
const db = require("../db");
const { enrich } = require("../lib/geo");
const { fromRequest } = require("../lib/visit");

const router = express.Router();

const skipLog = new Set(["/favicon.ico", "/robots.txt"]);

router.post("/api/log", (_req, res) => {
  res.status(410).json({
    error: "Gone",
    message: "The Worker ingest API is removed. Requests to this host are logged directly."
  });
});

router.use(async (req, res) => {
  const debug = Object.prototype.hasOwnProperty.call(req.query, "debug");
  const skip = skipLog.has(req.path);
  let log = { ok: true, status: skip ? 204 : 200, error: skip ? "skipped" : "" };
  let data = fromRequest(req);
  let geo = { source: "headers", error: "" };

  if (!skip) {
    ({ data, geo } = await enrich(data));
    try {
      db.insertVisit(data);
      console.log(
        "Logged visit:",
        data.ip,
        data.city || "-",
        data.country || "-",
        data.asOrganization || "-"
      );
    } catch (err) {
      console.error("Failed to persist visit:", err);
      log = { ok: false, status: 500, error: String(err) };
    }
  }

  if (req.path === "/favicon.ico") {
    return res.status(204).end();
  }

  const body = debug ? { ...data, _log: log, _geo: geo } : data;
  res.set({
    "Cache-Control": "no-store",
    "X-Log-Status": String(log.status),
    "X-Log-Error": log.error || ""
  });
  res.type("application/json").send(JSON.stringify(body, null, 2));
});

module.exports = router;
