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

function renderPage(messages, { errorMessage = "", contentDraft = "" } = {}) {
  const messageCountLabel = `${messages.length} ${
    messages.length === 1 ? "message" : "messages"
  }`;

  const messageItems =
    messages.length === 0
      ? `
          <li class="empty-state">
            <div>
              <h3>No messages yet</h3>
              <p>Add the first note to start the shared feed.</p>
            </div>
          </li>
        `
      : messages
          .map(
            (message) => `
              <li class="message-card">
                <div class="timestamp">${formatTimestamp(message.created_at)}</div>
                <p class="message-copy">${escapeHtml(message.content)}</p>
              </li>
            `
          )
          .join("");

  const errorHtml = errorMessage
    ? `<div class="alert" role="alert">${escapeHtml(errorMessage)}</div>`
    : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Feedback / Notes</title>
        <style>
          :root {
            color-scheme: light;
            --bg: #f5ede2;
            --bg-deep: #ead9c5;
            --panel: rgba(255, 255, 255, 0.78);
            --panel-strong: #fffdf9;
            --ink: #1d2433;
            --muted: #5e687a;
            --line: rgba(29, 36, 51, 0.12);
            --accent: #c96a3d;
            --accent-deep: #9b4d2f;
            --accent-soft: rgba(201, 106, 61, 0.14);
            --shadow: 0 26px 64px rgba(28, 34, 45, 0.12);
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            min-height: 100vh;
            font-family: "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif;
            color: var(--ink);
            background:
              radial-gradient(circle at top left, rgba(255, 255, 255, 0.92), transparent 36%),
              radial-gradient(circle at bottom right, rgba(201, 106, 61, 0.18), transparent 30%),
              linear-gradient(135deg, var(--bg) 0%, var(--bg-deep) 100%);
          }

          .main {
            min-height: 100vh;
            padding: 28px 18px 42px;
          }

          .page {
            width: min(1120px, 100%);
            margin: 0 auto;
            display: grid;
            gap: 24px;
          }

          .top-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.95fr);
            gap: 24px;
          }

          .panel,
          .hero {
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 28px;
            box-shadow: var(--shadow);
            backdrop-filter: blur(14px);
          }

          .hero {
            position: relative;
            overflow: hidden;
            padding: clamp(28px, 4vw, 44px);
          }

          .hero::after {
            content: "";
            position: absolute;
            right: -56px;
            bottom: -68px;
            width: 220px;
            height: 220px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(201, 106, 61, 0.26), transparent 70%);
          }

          .eyebrow {
            display: inline-flex;
            align-items: center;
            padding: 8px 12px;
            border-radius: 999px;
            border: 1px solid var(--line);
            background: rgba(255, 255, 255, 0.72);
            color: var(--muted);
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          h1 {
            position: relative;
            margin: 18px 0 12px;
            max-width: 10ch;
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(2.7rem, 5vw, 4.6rem);
            line-height: 0.98;
          }

          .lead {
            position: relative;
            margin: 0;
            max-width: 52ch;
            color: var(--muted);
            font-size: 1.02rem;
            line-height: 1.7;
          }

          .stats {
            position: relative;
            margin-top: 24px;
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
          }

          .stat {
            min-width: 150px;
            padding: 14px 16px;
            border: 1px solid var(--line);
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.7);
          }

          .stat-value {
            font-size: 1.2rem;
            font-weight: 700;
          }

          .stat-label {
            margin-top: 4px;
            color: var(--muted);
            font-size: 0.86rem;
          }

          .composer {
            padding: 28px;
            display: flex;
            flex-direction: column;
            gap: 18px;
          }

          .composer h2,
          .section-title {
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            line-height: 1.1;
          }

          .composer h2 {
            font-size: 1.9rem;
          }

          .composer-copy,
          .section-copy {
            margin: 0;
            color: var(--muted);
            line-height: 1.65;
          }

          .alert {
            padding: 14px 16px;
            border: 1px solid rgba(201, 106, 61, 0.35);
            border-radius: 18px;
            background: #fff1ea;
            color: #8b3f23;
            font-weight: 700;
          }

          .field-label {
            display: block;
            margin-bottom: 10px;
            font-size: 0.92rem;
            font-weight: 700;
          }

          textarea {
            width: 100%;
            min-height: 160px;
            resize: vertical;
            padding: 16px 18px;
            border: 1px solid var(--line);
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.96);
            color: var(--ink);
            font: inherit;
            line-height: 1.55;
            box-shadow: inset 0 1px 2px rgba(29, 36, 51, 0.05);
          }

          textarea:focus {
            outline: 3px solid rgba(201, 106, 61, 0.18);
            border-color: rgba(201, 106, 61, 0.4);
          }

          .composer-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
          }

          .hint {
            margin: 0;
            max-width: 28ch;
            color: var(--muted);
            font-size: 0.92rem;
            line-height: 1.55;
          }

          button {
            border: none;
            border-radius: 999px;
            padding: 14px 22px;
            background: linear-gradient(135deg, var(--accent) 0%, #da8a46 100%);
            color: #fff;
            font: inherit;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 16px 32px rgba(155, 77, 47, 0.24);
            transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
          }

          button:hover {
            transform: translateY(-1px);
            box-shadow: 0 18px 34px rgba(155, 77, 47, 0.28);
            filter: brightness(1.03);
          }

          button:active {
            transform: translateY(0);
          }

          .messages {
            padding: 28px;
          }

          .section-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 18px;
            flex-wrap: wrap;
            margin-bottom: 18px;
          }

          .section-title {
            font-size: clamp(1.9rem, 4vw, 2.5rem);
          }

          .count-pill {
            padding: 10px 14px;
            border-radius: 999px;
            background: var(--accent-soft);
            color: var(--accent-deep);
            font-size: 0.92rem;
            font-weight: 700;
            white-space: nowrap;
          }

          .message-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
          }

          .message-card,
          .empty-state {
            padding: 20px;
            border: 1px solid var(--line);
            border-radius: 22px;
            background: var(--panel-strong);
            box-shadow: 0 10px 24px rgba(29, 36, 51, 0.06);
          }

          .message-card {
            display: flex;
            flex-direction: column;
            gap: 14px;
            min-height: 180px;
          }

          .timestamp {
            align-self: flex-start;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(29, 36, 51, 0.06);
            color: var(--muted);
            font-size: 0.82rem;
            font-weight: 700;
          }

          .message-copy {
            margin: 0;
            font-size: 1rem;
            line-height: 1.65;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
          }

          .empty-state {
            display: grid;
            place-items: center;
            min-height: 240px;
            border-style: dashed;
            background: rgba(255, 255, 255, 0.55);
            text-align: center;
          }

          .empty-state h3 {
            margin: 0 0 10px;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 1.65rem;
          }

          .empty-state p {
            margin: 0;
            color: var(--muted);
            line-height: 1.6;
          }

          @media (max-width: 860px) {
            .top-grid {
              grid-template-columns: 1fr;
            }

            h1 {
              max-width: 12ch;
            }
          }

          @media (max-width: 640px) {
            .main {
              padding: 18px 14px 32px;
            }

            .panel,
            .hero {
              border-radius: 24px;
            }

            .composer,
            .messages {
              padding: 22px;
            }
          }
        </style>
      </head>
      <body>
        <main class="main">
          <div class="page">
            <section class="top-grid">
              <header class="hero">
                <div class="eyebrow">Shared team board</div>
                <h1>Feedback and notes with a calmer UI.</h1>
                <p class="lead">
                  Capture quick updates, bug reports, and handoff notes in one
                  shared place. The app is still fully server-rendered by Express
                  and backed by MySQL, just presented with more breathing room.
                </p>
                <div class="stats">
                  <div class="stat">
                    <div class="stat-value">${messages.length}</div>
                    <div class="stat-label">${messageCountLabel} saved</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">Express</div>
                    <div class="stat-label">server-rendered interface</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">MySQL</div>
                    <div class="stat-label">persistent shared storage</div>
                  </div>
                </div>
              </header>

              <section class="panel composer">
                <div>
                  <h2>Add a new message</h2>
                  <p class="composer-copy">
                    Keep it short or leave a fuller note. Newest entries appear
                    at the top of the feed.
                  </p>
                </div>

                ${errorHtml}

                <form method="POST" action="/add">
                  <label class="field-label" for="content">Your message</label>
                  <textarea
                    id="content"
                    name="content"
                    placeholder="Write a quick update, reminder, or piece of feedback..."
                    required
                  >${escapeHtml(contentDraft)}</textarea>
                  <div class="composer-footer">
                    <p class="hint">Simple, fast, and still friendly on smaller screens.</p>
                    <button type="submit">Post Message</button>
                  </div>
                </form>
              </section>
            </section>

            <section class="panel messages">
              <div class="section-head">
                <div>
                  <div class="eyebrow">Recent activity</div>
                  <h2 class="section-title">Stored messages</h2>
                  <p class="section-copy">
                    Latest notes appear first so fresh updates stay visible.
                  </p>
                </div>
                <div class="count-pill">${messageCountLabel}</div>
              </div>

              <ul class="message-list">
                ${messageItems}
              </ul>
            </section>
          </div>
        </main>
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
      res.status(400).send(renderPage(messages, { errorMessage: "Message cannot be empty." }));
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

    try {
      const messages = await getMessages();
      res.status(500).send(
        renderPage(messages, {
          errorMessage: "Could not save the message. Please check the database connection.",
          contentDraft: content,
        })
      );
    } catch (loadError) {
      console.error("Error loading messages after save failure:", loadError);
      res.status(500).send("<h1>Could not save the message.</h1><p>Please check the database connection.</p>");
    }
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
