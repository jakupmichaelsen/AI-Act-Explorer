const { proxyToOpenAI } = require("../lib/openai");

function isSafeMessage(message) {
  return (
    message &&
    typeof message === "object" &&
    ["system", "user", "assistant", "developer"].includes(message.role) &&
    typeof message.content === "string"
  );
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

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const rawBody = await readRequestBody(req);
    let body = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Invalid JSON body." }));
        return;
      }
    }

    const messages = Array.isArray(body.messages) ? body.messages.filter(isSafeMessage) : [];
    if (messages.length === 0) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Missing messages array." }));
      return;
    }

    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const reply = await proxyToOpenAI(messages.slice(0, 20), apiKey);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ reply }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error.message || "Internal server error" }));
  }
};
