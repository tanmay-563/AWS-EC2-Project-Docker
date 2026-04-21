const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.urlencoded({ extended: false }));

// Create a reusable MySQL connection pool.
// The connection details come from environment variables so the app can connect
// to an external database service such as AWS RDS instead of assuming MySQL
// is running on the same machine.
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "feedback_app",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function renderPage(messages, errorMessage = "") {
  const messageItems =
    messages.length === 0
      ? "<li>No messages yet. Add the first one.</li>"
      : messages
          .map(
            (message) => `
              <li>
                <strong>${formatTimestamp(message.created_at)}</strong><br>
                ${escapeHtml(message.content)}
              </li>
            `
          )
          .join("");

  const errorHtml = errorMessage
    ? `<p style="color: red;">${escapeHtml(errorMessage)}</p>`
    : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Feedback / Notes</title>
      </head>
      <body>
        <h1>Feedback / Notes</h1>
        <p>This page is server-rendered by Express, and every message is stored in MySQL.</p>

        ${errorHtml}

        <form method="POST" action="/add">
          <label for="content">New message:</label><br>
          <input
            id="content"
            name="content"
            type="text"
            placeholder="Write a short note"
            required
          >
          <button type="submit">Add Message</button>
        </form>

        <h2>Stored messages</h2>
        <ul>
          ${messageItems}
        </ul>
      </body>
    </html>
  `;
}

// This startup query makes sure the required table exists before the app starts
// handling requests. It uses the same schema requested for the project.
async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Fetch query: read every saved message from MySQL so any EC2 instance can show
// the same shared state when the app is deployed behind a load balancer.
async function getMessages() {
  const [rows] = await pool.query(`
    SELECT id, content, created_at
    FROM messages
    ORDER BY created_at DESC, id DESC
  `);

  return rows;
}

// Route: GET / renders the full HTML page on the server with all saved messages.
app.get("/", async (req, res) => {
  try {
    const messages = await getMessages();
    res.send(renderPage(messages));
  } catch (error) {
    console.error("Error loading messages:", error);
    res.status(500).send("<h1>Could not load messages.</h1><p>Please check the database connection.</p>");
  }
});

// Route: POST /add reads the submitted form value and writes it to MySQL.
app.post("/add", async (req, res) => {
  const content = (req.body.content || "").trim();

  if (!content) {
    try {
      const messages = await getMessages();
      res.status(400).send(renderPage(messages, "Message cannot be empty."));
    } catch (error) {
      console.error("Error loading messages after validation failure:", error);
      res.status(400).send("<h1>Message cannot be empty.</h1>");
    }
    return;
  }

  try {
    // Insert query: save the new message into MySQL so the data remains
    // stateful and shared across all running application instances.
    await pool.query("INSERT INTO messages (content) VALUES (?)", [content]);
    res.redirect("/");
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).send("<h1>Could not save the message.</h1><p>Please check the database connection.</p>");
  }
});

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Application failed to start:", error);
    process.exit(1);
  }
}

startServer();
