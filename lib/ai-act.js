const AI_ACT_SOURCE_URLS = [
  "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R1689",
  "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
  "https://op.europa.eu/o/opportal-service/download-handler?identifier=dc8116a1-3fe6-11ef-865a-01aa75ed71a1&format=xhtml&language=en&productionSystem=cellar&part=",
];
const AI_ACT_PUBLICATION_URL = "https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng";
const AI_ACT_LABEL = "Regulation (EU) 2024/1689 (AI Act)";
const FETCH_HEADERS = {
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

function decodeHtmlEntities(value) {
  return String(value)
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function htmlToText(html) {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|tr|td|th|table|h[1-6]|li|ul|ol|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLine(line) {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function isChapterLine(line) {
  return /^CHAPTER\s+[IVXLC]+\b/i.test(line);
}

function isAnnexLine(line) {
  return /^ANNEX\s+[IVXLC]+\b/i.test(line);
}

function isArticleLine(line) {
  return /^Article\s+\d+[A-Z]?\b/i.test(line);
}

function isSectionHeading(line) {
  return /^[A-Z][A-Z0-9 ,;:'"()\-\/]+$/.test(line) && line.length <= 140;
}

function isNoiseLine(line) {
  return !line || line === "* * *" || line === "•" || line === "|" || /^\/html;$/i.test(line);
}

function extractRelevantLines(text) {
  return text
    .split("\n")
    .map(normalizeLine)
    .filter((line) => !isNoiseLine(line));
}

function buildMarkdownFromLines(lines) {
  const sections = [];
  const preamble = [];
  let current = [];
  let context = [];
  let sawMainText = false;
  let pendingSubtitle = false;

  const flushCurrent = () => {
    if (current.length) {
      sections.push(current.join("\n"));
      current = [];
    }
  };

  const flushPreambleIntoFirstSection = () => {
    if (!preamble.length) {
      return;
    }

    if (sections.length > 0) {
      sections[0] = `${preamble.join("\n\n")}\n\n${sections[0]}`;
    } else if (current.length > 0) {
      current.unshift(preamble.join("\n\n"));
    } else {
      sections.push(preamble.join("\n\n"));
    }
  };

  for (const line of lines) {
    if (/^HAVE ADOPTED THIS REGULATION:?$/i.test(line)) {
      sawMainText = true;
      preamble.push(line);
      pendingSubtitle = false;
      continue;
    }

    if (!sawMainText) {
      preamble.push(line);
      pendingSubtitle = false;
      continue;
    }

    if (isChapterLine(line) || isAnnexLine(line)) {
      context = [line];
      pendingSubtitle = true;
      continue;
    }

    if (pendingSubtitle && isSectionHeading(line)) {
      context = context.concat(line);
      pendingSubtitle = false;
      continue;
    }

    if (isArticleLine(line)) {
      flushCurrent();
      current.push(`# ${line}`);
      if (context.length) {
        current.push(`*${context.join(" · ")}*`);
      }
      pendingSubtitle = true;
      continue;
    }

    if (pendingSubtitle && current.length > 0 && !/^\d+[.)]/.test(line) && line.length <= 120) {
      current.push(`**${line}**`);
      pendingSubtitle = false;
      continue;
    }

    if (!current.length) {
      preamble.push(line);
    } else {
      current.push(line);
      pendingSubtitle = false;
    }
  }

  flushCurrent();
  flushPreambleIntoFirstSection();

  if (!sections.length) {
    return "";
  }

  return sections.join("\n\n");
}

async function fetchOfficialAiActMarkdown() {
  let response = null;
  let sourceUrl = "";
  let lastError = null;

  for (const url of AI_ACT_SOURCE_URLS) {
    try {
      const candidate = await fetch(url, {
        headers: FETCH_HEADERS,
        redirect: "follow",
      });
      if (!candidate.ok) {
        lastError = new Error(`Failed to fetch AI Act source (${candidate.status})`);
        continue;
      }

      response = candidate;
      sourceUrl = url;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw lastError || new Error("Failed to fetch AI Act source.");
  }

  const html = await response.text();
  const text = htmlToText(html);
  if (
    /Page not found|The document was not found|Empty response from search API|Failed to get publication details/i.test(text) ||
    /JavaScript is disabled|verify that you're not a robot|enable JavaScript/i.test(text) ||
    text.length < 10000 ||
    !/\bArticle\s+1\b/i.test(text) ||
    !/HAVE ADOPTED THIS REGULATION/i.test(text)
  ) {
    throw new Error(`Official source did not return the regulation text from ${sourceUrl}.`);
  }

  const lines = extractRelevantLines(text);
  const markdown = buildMarkdownFromLines(lines);

  if (!markdown) {
    throw new Error("Could not extract the AI Act text from the official source.");
  }

  return {
    content: markdown,
    label: AI_ACT_LABEL,
    sourceUrl: AI_ACT_PUBLICATION_URL,
    sourceTextUrl: sourceUrl || AI_ACT_SOURCE_URLS[0],
  };
}

module.exports = {
  AI_ACT_LABEL,
  AI_ACT_PUBLICATION_URL,
  AI_ACT_SOURCE_URLS,
  fetchOfficialAiActMarkdown,
};
