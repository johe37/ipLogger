const config = require("../config");
const { safeEqual } = require("../lib/util");

function requireIngestAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (authHeader !== `Bearer ${config.logSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function requireDashboardAuth(req, res, next) {
  if (!config.dashboardPassword) {
    return res.status(503).json({
      error: "DASHBOARD_PASSWORD is not set"
    });
  }

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    return challenge(res);
  }

  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return challenge(res);
  }

  const sep = decoded.indexOf(":");
  const user = sep === -1 ? decoded : decoded.slice(0, sep);
  const password = sep === -1 ? "" : decoded.slice(sep + 1);

  if (
    !safeEqual(user, config.dashboardUser) ||
    !safeEqual(password, config.dashboardPassword)
  ) {
    return challenge(res);
  }

  next();
}

function challenge(res) {
  res.set("WWW-Authenticate", 'Basic realm="IP Logger dashboard"');
  return res.status(401).send("Authentication required");
}

module.exports = {
  requireIngestAuth,
  requireDashboardAuth
};
