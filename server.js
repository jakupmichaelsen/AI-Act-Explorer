const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const rootDir = __dirname;
const publicDir = rootDir;
const preferredPort = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new Error("Request body too large.");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function isSafeMessage(message) {
  return (
    message &&
    typeof message === "object" &&
    ["system", "user", "assistant", "developer"].includes(message.role) &&
    typeof message.content === "string"
  );
}

async function proxyToOpenAI(messages) {
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: openAiModel,
      messages,
      temperature: 0.4,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.error || `OpenAI request failed with HTTP ${response.status}`);
  }

  return payload.choices?.[0]?.message?.content || "⚠️ Ingen forklaring.";
}

async function serveStatic(req, res, requestPath) {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.join(publicDir, relativePath);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(path.resolve(publicDir))) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const data = await fs.readFile(resolvedPath);
    const extension = path.extname(resolvedPath).toLowerCase();
    const contentType = contentTypes[extension] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/explain") {
      const rawBody = await readRequestBody(req);
      let body = {};
      if (rawBody) {
        try {
          body = JSON.parse(rawBody);
        } catch {
          sendJson(res, 400, { error: "Invalid JSON body." });
          return;
        }
      }
      const messages = Array.isArray(body.messages) ? body.messages.filter(isSafeMessage) : [];

      if (messages.length === 0) {
        sendJson(res, 400, { error: "Missing messages array." });
        return;
      }

      const reply = await proxyToOpenAI(messages.slice(0, 20));
      sendJson(res, 200, { reply });
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res, url.pathname);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Internal server error" });
  }
});

function listenOn(port) {
  server.listen(port, host, () => {
    console.log(`AI Act Explorer running at http://127.0.0.1:${port}`);
  });
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const nextPort = server.address()?.port ? Number(server.address().port) + 1 : preferredPort + 1;
    if (nextPort <= preferredPort + 10) {
      console.log(`Port ${preferredPort} is busy, trying ${nextPort}...`);
      listenOn(nextPort);
      return;
    }
  }

  console.error(error);
  process.exit(1);
});

listenOn(preferredPort);
