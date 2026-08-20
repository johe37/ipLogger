const path = require("node:path");
const cors = require("cors");
const express = require("express");
const config = require("./config");
const { logVisit } = require("./middleware/logVisit");
const dashboardRoutes = require("./routes/dashboard");
const healthRoutes = require("./routes/health");
const ipRoutes = require("./routes/ip");

function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors());
  app.use("/css", express.static(path.join(config.publicDir, "css")));
  app.use("/css", (_req, res) => {
    res.status(404).type("text/plain").send("Not found");
  });
  app.use(logVisit);
  app.use(healthRoutes);
  app.use(dashboardRoutes);
  app.use(ipRoutes);
  return app;
}

module.exports = { createApp };
