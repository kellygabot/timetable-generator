const express = require("express");
const path = require("path"); // Added this to fix path.join error
const localtunnel = require("localtunnel");
const app = express();
const PORT = 3000; // Capitalized to match your preference

// 1. Middleware (Must come BEFORE routes)
app.use(express.json());
app.use(express.static("public"));

// 2. Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app.html"));
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/generate", (req, res) => {
  const data = req.body;
  console.log("Data received for timetable:", data);
  res.json({ message: "Timetable generated successfully!", data: data });
});

// 3. Start Server (Only call this ONCE)
const server = app.listen(PORT, async () => {
  console.log(`Local Server: http://localhost:${PORT}`);

  // This creates the automated localtunnel link
  try {
    const tunnel = await localtunnel({ port: PORT });
    console.log(`Public Link (localtunnel): ${tunnel.url}`);

    tunnel.on("close", () => {
      console.log("Public link closed");
    });
  } catch (err) {
    console.error("Error creating tunnel:", err);
  }
});
