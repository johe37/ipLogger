const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.LOG_SECRET || "change-me-to-a-strong-secret";

app.use(cors());
app.use(express.json());

// Simple health check
app.get("/", (req, res) => {
  res.send("IP Logger is running");
});

// The endpoint your Worker will call
app.post("/api/log", (req, res) => {
  // Check secret token
  const authHeader = req.headers.authorization || "";
  if (authHeader !== `Bearer ${SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const data = req.body;
  console.log("Received log:", data);   // You will see this in Render logs

  // TODO: Later you can save to database here
  // For now we just accept and log it

  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
