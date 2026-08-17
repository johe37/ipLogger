const cors = require("cors");
const express = require("express");
const dashboardRoutes = require("./routes/dashboard");
const healthRoutes = require("./routes/health");
const ipRoutes = require("./routes/ip");

function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors());
  app.use(healthRoutes);
  app.use(dashboardRoutes);
  app.use(ipRoutes);
  return app;
}

module.exports = { createApp };
