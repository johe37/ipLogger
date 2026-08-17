const path = require("node:path");

module.exports = {
  port: Number(process.env.PORT) || 3000,
  dashboardUser: process.env.DASHBOARD_USER || "admin",
  dashboardPassword: process.env.DASHBOARD_PASSWORD || "",
  databasePath:
    process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "visits.db"),
  publicDir: path.join(__dirname, "public")
};
