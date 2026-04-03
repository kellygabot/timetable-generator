const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;

// Middleware to handle JSON data
app.use(express.json());

// Serve static files (HTML, CSS, JS) from a folder named 'public'
app.use(express.static("public"));

// Serve the app UI at the root route.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app.html"));
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Example API Route for your generator
app.post("/generate", (req, res) => {
  const data = req.body;
  console.log("Data received for timetable:", data);

  // This is where your logic will eventually go
  res.json({ message: "Timetable generated successfully!", data: data });
});

app.listen(PORT, () => {
  console.log(`Server is moving at http://localhost:${PORT}`);
});
