const cors = require("cors");
const express = require("express");
const dashboardRoutes = require("./routes/dashboard");
const healthRoutes = require("./routes/health");
const ingestRoutes = require("./routes/ingest");

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "64kb" }));
  app.use(healthRoutes);
  app.use(ingestRoutes);
  app.use(dashboardRoutes);
  return app;
}

module.exports = { createApp };
