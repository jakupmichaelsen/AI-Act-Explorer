if (typeof document !== "undefined") {
const els = {
  status: document.getElementById("status"),
  fileName: document.getElementById("fileName"),
  settingsToggle: document.getElementById("settingsToggle"),
  settingsPanel: document.getElementById("settingsPanel"),
  apiKey: document.getElementById("apiKey"),
  clearKey: document.getElementById("clearKey"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  loadAiAct: document.getElementById("loadAiAct"),
  outline: document.getElementById("outline"),
  visning: document.getElementById("visning"),
  output: document.getElementById("output"),
  followup: document.getElementById("followup"),
  chatForm: document.getElementById("chatForm"),
  send: document.getElementById("send"),
};

const state = {
  sectionCache: new Map(),
  outlineLinks: [],
  activeIndex: -1,
  currentSectionKey: "",
};

const systemPrompt = "Forklar dele af AI-forordningen kort, klart og pædagogisk. Brug punktopstillinger og markdown.";
const followupPrompt = "Du er en hjælpsom juridisk assistent, der forklarer EU AI-forordningen klart og pædagogisk. Brug punktopstillinger og markdown.";
const officialAiActUrl = "https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng";
const localAiActMarkdownUrl = "/ai-act-official.md";
const apiKeyStorageKey = "aiActExplorerOpenAiKey";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(message, kind = "info") {
  els.status.textContent = message;
  els.status.dataset.kind = kind;
}

function setFileName(name) {
  els.fileName.textContent = name || "Ingen fil valgt.";
}

function setSettingsOpen(isOpen) {
  els.settingsPanel.hidden = !isOpen;
  els.settingsToggle.setAttribute("aria-expanded", String(isOpen));
  els.settingsToggle.classList.toggle("active", isOpen);
}

function getStoredApiKey() {
  try {
    return window.localStorage.getItem(apiKeyStorageKey) || "";
  } catch {
    return "";
  }
}

function setStoredApiKey(value) {
  try {
    if (value) {
      window.localStorage.setItem(apiKeyStorageKey, value);
    } else {
      window.localStorage.removeItem(apiKeyStorageKey);
    }
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

function resetDocumentState() {
  state.sectionCache.clear();
  state.outlineLinks = [];
  state.activeIndex = -1;
  state.currentSectionKey = "";
}

function setActiveLink(index) {
  state.activeIndex = index;
  state.outlineLinks.forEach((link, currentIndex) => {
    link.classList.toggle("active", currentIndex === index);
  });
}

function splitSections(content) {
  const sections = content.split(/(?=^#)/m).map((section) => section.trim()).filter(Boolean);
  return sections.length > 0 ? sections : [content.trim()];
}

function getSectionTitle(section) {
  const firstLine = section.split("\n")[0] || "Afsnit";
  const title = firstLine.replace(/^#+\s*/, "").trim();
  return title || "Afsnit";
}

function renderMessage(message) {
  if (message.role === "user") {
    return `
      <div class="chat-message user">
        <span class="role">Du</span>
        <div>${escapeHtml(message.content)}</div>
      </div>
    `;
  }

  const rendered = window.marked ? window.marked.parse(message.content) : `<pre>${escapeHtml(message.content)}</pre>`;
  return `
    <div class="chat-message assistant">
      <span class="role">AI</span>
      <div>${rendered}</div>
    </div>
  `;
}

function renderChat(sectionKey) {
  const entry = state.sectionCache.get(sectionKey);
  if (!entry) {
    els.output.innerHTML = `
      <div class="empty-state">
        Vælg et afsnit for at få en forklaring og stille opfølgende spørgsmål.
      </div>
    `;
    return;
  }

  els.output.innerHTML = entry.chat.map(renderMessage).join("");
  els.output.scrollTop = els.output.scrollHeight;
}

async function callAssistant(messages) {
  const response = await fetch("/api/explain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, apiKey: els.apiKey.value.trim() }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload.reply || "⚠️ Ingen svar.";
}

async function loadOfficialAiAct() {
  setStatus("Henter AI Act...", "pending");
  els.loadAiAct.disabled = true;
  els.output.innerHTML = '<div class="empty-state">⏳ Henter AI Act...</div>';

  try {
    const localResponse = await fetch(localAiActMarkdownUrl, { cache: "no-store" });
    if (localResponse.ok) {
      const markdown = await localResponse.text();
      if (markdown.trim()) {
        renderSections(markdown);
        setFileName("Regulation (EU) 2024/1689 (AI Act) - local snapshot");
        setStatus("AI Act er indlæst fra lokal snapshot.");
        return;
      }
    }

    const response = await fetch("/api/load-ai-act");
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }

    renderSections(payload.content);
    setFileName(`${payload.label} - official source`);
    setStatus("AI Act er indlæst.");
  } catch (error) {
    setStatus(`Kunne ikke hente AI Act: ${error.message || "Ukendt fejl"}`, "error");
    els.output.innerHTML = `
      <div class="empty-state">
        Kunne ikke hente AI Act automatisk.
        <a href="${officialAiActUrl}" target="_blank" rel="noreferrer">Åbn den officielle kilde</a>
        eller upload en fil manuelt.
      </div>
    `;
  } finally {
    els.loadAiAct.disabled = false;
  }
}

async function forklar(section, index = null) {
  state.currentSectionKey = section;

  if (state.sectionCache.has(section)) {
    renderChat(section);
    if (index !== null) setActiveLink(index);
    return;
  }

  setStatus("Henter forklaring...", "pending");
  els.output.innerHTML = '<div class="empty-state">⏳ Henter forklaring...</div>';
  els.send.disabled = true;

  try {
    const reply = await callAssistant([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Forklar følgende afsnit:\n\n${section}` },
    ]);

    state.sectionCache.set(section, {
      forklaring: reply,
      chat: [{ role: "assistant", content: reply }],
    });

    renderChat(section);
    if (index !== null) setActiveLink(index);
    setStatus("Forklaring klar.");
  } catch (error) {
    els.output.innerHTML = `
      <div class="empty-state">
        ❌ Fejl i API-kaldet: ${escapeHtml(error.message || "Ukendt fejl")}
      </div>
    `;
    setStatus("Kunne ikke hente forklaring.", "error");
  } finally {
    els.send.disabled = false;
  }
}

async function sendFollowup(event) {
  event.preventDefault();

  const question = els.followup.value.trim();
  if (!question || !state.currentSectionKey) return;

  const entry = state.sectionCache.get(state.currentSectionKey);
  if (!entry) return;

  els.followup.value = "";
  entry.chat.push({ role: "user", content: question });
  renderChat(state.currentSectionKey);
  setStatus("Sender opfølgning...", "pending");
  els.send.disabled = true;

  const messages = [
    { role: "system", content: followupPrompt },
    ...entry.chat,
  ];

  try {
    const reply = await callAssistant(messages);
    entry.chat.push({ role: "assistant", content: reply });
    renderChat(state.currentSectionKey);
    setStatus("Svar klar.");
  } catch (error) {
    entry.chat.push({
      role: "assistant",
      content: `❌ Fejl ved forespørgsel: ${error.message || "Ukendt fejl"}`,
    });
    renderChat(state.currentSectionKey);
    setStatus("Kunne ikke sende opfølgning.", "error");
  } finally {
    els.send.disabled = false;
  }
}

function renderSections(content) {
  const sections = splitSections(content);

  els.outline.innerHTML = "";
  els.visning.innerHTML = "";
  resetDocumentState();

  sections.forEach((section, index) => {
    const title = getSectionTitle(section);

    const outlineButton = document.createElement("button");
    outlineButton.type = "button";
    outlineButton.className = "outline-link";
    outlineButton.textContent = title;
    outlineButton.addEventListener("click", () => {
      document.getElementById(`section-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveLink(index);
    });
    els.outline.appendChild(outlineButton);
    state.outlineLinks.push(outlineButton);

    const article = document.createElement("article");
    article.className = "section-card";
    article.id = `section-${index}`;
    article.innerHTML = window.marked ? window.marked.parse(section) : `<pre>${escapeHtml(section)}</pre>`;
    article.addEventListener("click", () => forklar(section, index));
    els.visning.appendChild(article);
  });

  setStatus(`Indlæst ${sections.length} afsnit.`);
  els.output.innerHTML = `
    <div class="empty-state">
      Vælg et afsnit for at få en forklaring og stille opfølgende spørgsmål.
    </div>
  `;
}

function handleFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    renderSections(String(reader.result || ""));
    setFileName(file.name);
  };
  reader.onerror = () => {
    setStatus("Kunne ikke læse filen.", "error");
  };
  reader.readAsText(file);
}

els.apiKey.value = getStoredApiKey();
els.apiKey.addEventListener("input", () => {
  setStoredApiKey(els.apiKey.value.trim());
});

setSettingsOpen(false);

els.settingsToggle.addEventListener("click", () => {
  setSettingsOpen(els.settingsPanel.hidden);
});

els.clearKey.addEventListener("click", () => {
  els.apiKey.value = "";
  setStoredApiKey("");
  els.apiKey.focus();
});

els.chatForm.addEventListener("submit", sendFollowup);
els.loadAiAct.addEventListener("click", loadOfficialAiAct);
els.fileInput.addEventListener("change", (event) => {
  handleFile(event.target.files?.[0]);
});

els.dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropzone.classList.add("dragover");
});

els.dropzone.addEventListener("dragleave", () => {
  els.dropzone.classList.remove("dragover");
});

els.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropzone.classList.remove("dragover");
  handleFile(event.dataTransfer.files?.[0]);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.settingsPanel.hidden) {
    setSettingsOpen(false);
    els.settingsToggle.focus();
    return;
  }

  if (event.key === "Enter" && document.activeElement === els.followup) {
    event.preventDefault();
    els.chatForm.requestSubmit();
  }
});

loadOfficialAiAct();
}
