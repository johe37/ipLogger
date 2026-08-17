const db = require("../db");
const { enrich } = require("../lib/geo");
const { fromRequest } = require("../lib/visit");

function shouldSkip(path) {
  if (path === "/health" || path === "/health-raccoon.jpg") return true;
  if (path === "/favicon.ico" || path === "/robots.txt") return true;
  if (path === "/api/log") return true;
  if (path === "/api/stats" || path.startsWith("/api/visits")) return true;
  return false;
}

async function logVisit(req, res, next) {
  if (shouldSkip(req.path)) {
    req.visit = null;
    return next();
  }

  let data = fromRequest(req);
  let geo = { source: "headers", error: "" };
  let log = { ok: true, status: 200, error: "" };

  ({ data, geo } = await enrich(data));
  try {
    db.insertVisit(data);
    console.log(
      "Logged visit:",
      data.method,
      data.url,
      data.ip,
      data.city || "-",
      data.country || "-",
      data.asOrganization || "-"
    );
  } catch (err) {
    console.error("Failed to persist visit:", err);
    log = { ok: false, status: 500, error: String(err) };
  }

  req.visit = { data, geo, log };
  next();
}

module.exports = { logVisit, shouldSkip };
