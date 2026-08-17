const { createApp } = require("./app");
const config = require("./config");
const db = require("./db");

db.open();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`SQLite database: ${config.databasePath}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
