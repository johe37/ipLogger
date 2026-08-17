const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const config = require("./config");
const { toVisitRow, parsePayload } = require("./lib/visit");
const { numberValue } = require("./lib/util");

let db;
let statements;

function open() {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  db = new DatabaseSync(config.databasePath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT,
      country TEXT,
      city TEXT,
      region TEXT,
      region_code TEXT,
      postal_code TEXT,
      continent TEXT,
      latitude TEXT,
      longitude TEXT,
      timezone TEXT,
      asn INTEGER,
      as_organization TEXT,
      colo TEXT,
      http_protocol TEXT,
      user_agent TEXT,
      method TEXT,
      url TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip);
    CREATE INDEX IF NOT EXISTS idx_visits_country ON visits(country);
  `);

  statements = {
    insert: db.prepare(`
      INSERT INTO visits (
        ip, country, city, region, region_code, postal_code, continent,
        latitude, longitude, timezone, asn, as_organization, colo,
        http_protocol, user_agent, method, url, payload, created_at
      ) VALUES (
        @ip, @country, @city, @region, @region_code, @postal_code, @continent,
        @latitude, @longitude, @timezone, @asn, @as_organization, @colo,
        @http_protocol, @user_agent, @method, @url, @payload, @created_at
      )
    `),
    selectById: db.prepare(`
      SELECT
        id, ip, country, city, region, region_code, postal_code, continent,
        latitude, longitude, timezone, asn, as_organization, colo,
        http_protocol, user_agent, method, url, payload, created_at
      FROM visits
      WHERE id = ?
    `),
    count: db.prepare("SELECT COUNT(*) AS total FROM visits"),
    uniqueIps: db.prepare(
      "SELECT COUNT(DISTINCT ip) AS total FROM visits WHERE ip IS NOT NULL AND ip != ''"
    ),
    countries: db.prepare(
      "SELECT COUNT(DISTINCT country) AS total FROM visits WHERE country IS NOT NULL AND country != ''"
    ),
    lastSeen: db.prepare(
      "SELECT created_at FROM visits ORDER BY created_at DESC, id DESC LIMIT 1"
    )
  };

  return db;
}

function close() {
  if (!db) return;
  try {
    db.close();
  } catch {
    // already closed
  }
  db = undefined;
  statements = undefined;
}

function insertVisit(data) {
  open();
  statements.insert.run(toVisitRow(data));
}

function getStats() {
  open();
  const last = statements.lastSeen.get();
  return {
    total: numberValue(statements.count.get().total),
    uniqueIps: numberValue(statements.uniqueIps.get().total),
    countries: numberValue(statements.countries.get().total),
    lastSeen: last ? last.created_at : null
  };
}

function listVisits({ q = "", country = "", limit, offset } = {}) {
  open();
  const where = [];
  const params = {};

  if (q) {
    where.push(`(
      instr(lower(COALESCE(ip, '')), @q) > 0 OR
      instr(lower(COALESCE(city, '')), @q) > 0 OR
      instr(lower(COALESCE(region, '')), @q) > 0 OR
      instr(lower(COALESCE(country, '')), @q) > 0 OR
      instr(lower(COALESCE(as_organization, '')), @q) > 0 OR
      instr(lower(COALESCE(user_agent, '')), @q) > 0
    )`);
    params.q = q.toLowerCase();
  }

  if (country) {
    where.push("country = @country");
    params.country = country.toUpperCase();
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `
      SELECT
        id, ip, country, city, region, as_organization, user_agent,
        url, created_at
      FROM visits
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT @limit OFFSET @offset
    `
    )
    .all({ ...params, limit, offset });

  const total = numberValue(
    db.prepare(`SELECT COUNT(*) AS total FROM visits ${whereSql}`).get(params)
      .total
  );

  return {
    total,
    limit,
    offset,
    visits: rows.map((row) => ({
      ...row,
      id: numberValue(row.id)
    }))
  };
}

function getVisit(id) {
  open();
  const row = statements.selectById.get(id);
  if (!row) return null;

  return {
    ...row,
    id: numberValue(row.id),
    asn: row.asn == null ? null : numberValue(row.asn),
    payload: parsePayload(row.payload)
  };
}

module.exports = {
  open,
  close,
  insertVisit,
  getStats,
  listVisits,
  getVisit
};
