const openAiModel = process.env.OPENAI_MODEL || "gpt-4o";

async function proxyToOpenAI(messages, openAiApiKey) {
  const apiKey = openAiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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

module.exports = { proxyToOpenAI };
