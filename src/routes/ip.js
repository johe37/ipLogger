const express = require("express");
const { fromRequest } = require("../lib/visit");

const router = express.Router();

router.post("/api/log", (_req, res) => {
  res.status(410).json({
    error: "Gone",
    message: "The Worker ingest API is removed. Requests to this host are logged directly."
  });
});

router.use((req, res) => {
  const debug = Object.prototype.hasOwnProperty.call(req.query, "debug");
  const recorded = req.visit;
  const data = recorded ? recorded.data : fromRequest(req);
  const log = recorded
    ? recorded.log
    : { ok: true, status: 204, error: "skipped" };
  const geo = recorded ? recorded.geo : { source: "headers", error: "" };

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
