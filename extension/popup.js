// Popup controller

let currentData = null;

const extractBtn = document.getElementById("extract-btn");
const latestBtn = document.getElementById("latest-btn");
const statusEl = document.getElementById("status");
const ticketMetaEl = document.getElementById("ticket-meta");
const ticketSubjectEl = document.getElementById("ticket-subject");
const ticketIdLabelEl = document.getElementById("ticket-id-label");
const ticketCommentCountEl = document.getElementById("ticket-comment-count");
const toolbarEl = document.getElementById("toolbar");
const filterBarEl = document.getElementById("filter-bar");
const conversationEl = document.getElementById("conversation");
const emptyStateEl = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input");
const hideInternalCheckbox = document.getElementById("hide-internal");
const stripQuotedCheckbox = document.getElementById("strip-quoted");
const includePromptCheckbox = document.getElementById("include-prompt");
const promptSectionEl = document.getElementById("prompt-section");
const promptToggleRow = document.getElementById("prompt-toggle-row");
const promptToggleIcon = document.getElementById("prompt-toggle-icon");
const promptBodyEl = document.getElementById("prompt-body");
const promptTextEl = document.getElementById("prompt-text");
const promptSavedEl = document.getElementById("prompt-saved");
const toastEl = document.getElementById("toast");

// --- Prompt storage ---

try {
  chrome.storage.local.get("systemPrompt", (result) => {
    if (result?.systemPrompt) promptTextEl.value = result.systemPrompt;
  });
} catch (_) {}

let saveTimer;
promptTextEl.addEventListener("input", () => {
  clearTimeout(saveTimer);
  promptSavedEl.textContent = "Saving…";
  saveTimer = setTimeout(() => {
    try {
      chrome.storage.local.set({ systemPrompt: promptTextEl.value }, () => {
        promptSavedEl.textContent = "Saved";
        setTimeout(() => { promptSavedEl.textContent = ""; }, 1500);
      });
    } catch (_) {
      promptSavedEl.textContent = "";
    }
  }, 600);
});

promptToggleRow.addEventListener("click", () => {
  const isOpen = promptBodyEl.style.display !== "none";
  promptBodyEl.style.display = isOpen ? "none" : "block";
  promptToggleIcon.classList.toggle("open", !isOpen);
});

function getPromptPrefix() {
  const text = promptTextEl.value.trim();
  if (!text || !includePromptCheckbox.checked) return "";
  return `${text}\n\n---\n\n`;
}

const QUOTE_SEPARATOR_RE = /^([-_]{4,}[\s\w]*(?:original|forwarded|reply)[\s\w]*[-_]{4,}|_{4,}|on .{5,120} wrote:\s*$|from:\s*.+\n(?:sent|date):\s*.+\nto:\s*.+\n(?:cc:\s*.+\n)?subject:\s*)/im;

function stripQuotedContent(text) {
  const match = text.match(QUOTE_SEPARATOR_RE);
  if (!match) return text;
  return text
    .slice(0, match.index)
    .split("\n")
    .filter((line) => !/^>/.test(line.trim()))
    .join("\n")
    .trim();
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2000);
}

function formatTimestamp(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return iso;
  }
}

function renderComments(comments) {
  conversationEl.innerHTML = "";

  if (!comments || comments.length === 0) {
    emptyStateEl.style.display = "block";
    return;
  }

  const searchTerm = searchInput.value.toLowerCase();
  const hideInternal = hideInternalCheckbox.checked;
  const doStripQuoted = stripQuotedCheckbox.checked;

  let visibleCount = 0;

  comments.forEach((c) => {
    const displayBody = doStripQuoted ? stripQuotedContent(c.body) : c.body;
    const isEmptyAfterStrip = doStripQuoted && displayBody === "";

    const matchesSearch =
      !searchTerm ||
      c.author.toLowerCase().includes(searchTerm) ||
      displayBody.toLowerCase().includes(searchTerm);
    const matchesFilter = !hideInternal || !c.internal;

    const div = document.createElement("div");
    div.className = "comment" + (c.internal ? " internal" : "");
    if (!matchesSearch || !matchesFilter || isEmptyAfterStrip) {
      div.classList.add("hidden");
    } else {
      visibleCount++;
    }

    const header = document.createElement("div");
    header.className = "comment-header";

    const author = document.createElement("span");
    author.className = "comment-author";
    author.textContent = c.author;

    const ts = document.createElement("span");
    ts.className = "comment-timestamp";
    ts.textContent = formatTimestamp(c.timestamp);

    header.appendChild(author);
    header.appendChild(ts);

    if (c.internal) {
      const badge = document.createElement("span");
      badge.className = "comment-badge";
      badge.textContent = "Internal";
      header.appendChild(badge);
    }

    const indexSpan = document.createElement("span");
    indexSpan.className = "comment-index";
    indexSpan.textContent = `#${c.index}`;
    header.appendChild(indexSpan);

    const body = document.createElement("div");
    body.className = "comment-body";
    body.textContent = displayBody;

    div.appendChild(header);
    div.appendChild(body);

    if (c.attachments && c.attachments.length > 0) {
      const attachmentsEl = document.createElement("div");
      attachmentsEl.className = "comment-attachments";
      c.attachments.forEach((att) => {
        const a = document.createElement("a");
        a.className = "attachment-link";
        a.href = att.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = (att.type === "image" ? "🖼 " : "📎 ") + att.name;
        a.title = att.name;
        attachmentsEl.appendChild(a);
      });
      div.appendChild(attachmentsEl);
    }

    conversationEl.appendChild(div);
  });

  emptyStateEl.style.display = visibleCount === 0 ? "block" : "none";
}

function showResults(data) {
  currentData = data;

  statusEl.style.display = "none";

  ticketMetaEl.style.display = "block";
  ticketSubjectEl.textContent = data.subject || "(No subject)";
  ticketIdLabelEl.textContent = data.ticketId ? `Ticket #${data.ticketId}` : "";
  ticketCommentCountEl.textContent = `${data.commentCount} message${data.commentCount !== 1 ? "s" : ""}`;

  const fieldsRow = document.getElementById("ticket-fields-row");
  fieldsRow.innerHTML = "";
  if (data.fields) {
    Object.entries(data.fields).forEach(([key, val]) => {
      const span = document.createElement("span");
      span.style.cssText = "background:#e0f2fe;color:#0369a1;border-radius:3px;padding:1px 6px;font-size:10px;white-space:nowrap;";
      span.textContent = `${key}: ${val}`;
      fieldsRow.appendChild(span);
    });
  }

  toolbarEl.style.display = "flex";
  filterBarEl.style.display = "flex";
  promptSectionEl.style.display = "block";

  renderComments(data.comments);
}

function showError(msg) {
  statusEl.textContent = msg;
  statusEl.className = "error";
  statusEl.style.display = "block";
}

function showLoading() {
  currentData = null;
  statusEl.textContent = "Extracting ticket…";
  statusEl.className = "";
  statusEl.style.display = "block";
  ticketMetaEl.style.display = "none";
  toolbarEl.style.display = "none";
  filterBarEl.style.display = "none";
  promptSectionEl.style.display = "none";
  conversationEl.innerHTML = "";
  emptyStateEl.style.display = "none";
  searchInput.value = "";
  hideInternalCheckbox.checked = false;
  stripQuotedCheckbox.checked = false;
  includePromptCheckbox.checked = false;
}

function setBothDisabled(val) {
  extractBtn.disabled = val;
  latestBtn.disabled = val;
}

extractBtn.addEventListener("click", () => {
  setBothDisabled(true);
  showLoading();

  chrome.runtime.sendMessage({ action: "extractFromActiveTab" }, (response) => {
    setBothDisabled(false);
    if (chrome.runtime.lastError) {
      showError("Extension error: " + chrome.runtime.lastError.message);
      return;
    }
    if (!response || !response.success) {
      showError(response?.error || "Failed to extract ticket.");
      return;
    }
    showResults(response.data);
  });
});

latestBtn.addEventListener("click", () => {
  setBothDisabled(true);
  showLoading();

  chrome.runtime.sendMessage({ action: "extractFromActiveTab" }, (response) => {
    setBothDisabled(false);
    if (chrome.runtime.lastError) {
      showError("Extension error: " + chrome.runtime.lastError.message);
      return;
    }
    if (!response || !response.success) {
      showError(response?.error || "Failed to extract ticket.");
      return;
    }
    const data = response.data;
    const latest = data.comments[data.comments.length - 1];
    showResults({ ...data, comments: latest ? [latest] : [], commentCount: latest ? 1 : 0 });
  });
});

// --- Copy helpers ---

function toPlainText(data) {
  const lines = [
    `Ticket: ${data.ticketId ? "#" + data.ticketId : ""}  ${data.subject}`,
    `URL: ${data.url}`,
    `Extracted: ${formatTimestamp(data.extractedAt)}`,
  ];
  if (data.fields && Object.keys(data.fields).length > 0) {
    Object.entries(data.fields).forEach(([k, v]) => lines.push(`${k}: ${v}`));
  }
  lines.push("");
  data.comments.forEach((c) => {
    lines.push(`--- Message #${c.index} ---`);
    lines.push(`From: ${c.author}${c.internal ? " [Internal]" : ""}`);
    if (c.timestamp) lines.push(`Date: ${formatTimestamp(c.timestamp)}`);
    lines.push("");
    lines.push(c.body);
    if (c.attachments && c.attachments.length > 0) {
      lines.push("");
      c.attachments.forEach((att) => lines.push(`Attachment: ${att.name} (${att.url})`));
    }
    lines.push("");
  });
  return lines.join("\n");
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 100);
}

function fetchAttachmentAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "fetchAttachmentFromTab", url }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        reject(new Error(response?.error || "fetch failed"));
      } else {
        resolve(response.dataUrl);
      }
    });
  });
}

async function downloadChat(data) {
  const folder = `zendesk-${data.ticketId || "ticket"}`;
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const chatFilename = `chat_${timestamp}.txt`;

  const text = getPromptPrefix() + toPlainText(data);
  const blob = new Blob([text], { type: "text/plain" });
  const blobUrl = URL.createObjectURL(blob);
  chrome.downloads.download(
    { url: blobUrl, filename: `${folder}/${chatFilename}`, saveAs: false },
    () => URL.revokeObjectURL(blobUrl)
  );

  const seen = new Set();
  const attachments = [];
  data.comments.forEach((c) => {
    (c.attachments || []).forEach((att) => {
      if (seen.has(att.url)) return;
      seen.add(att.url);
      attachments.push(att);
    });
  });

  if (attachments.length === 0) {
    showToast("Downloading chat");
    return;
  }

  showToast(`Downloading chat + ${attachments.length} attachment${attachments.length !== 1 ? "s" : ""}`);

  for (const att of attachments) {
    const name = sanitizeFilename(att.name || "attachment");
    const dest = `${folder}/attachments/${name}`;
    try {
      // Try fetching via content script (preserves auth session)
      const dataUrl = await fetchAttachmentAsDataUrl(att.url);
      chrome.downloads.download({ url: dataUrl, filename: dest, saveAs: false });
    } catch (_) {
      // CORS or fetch failure — fall back to direct download using browser cookie jar
      chrome.downloads.download({ url: att.url, filename: dest, saveAs: false }, (id) => {
        if (chrome.runtime.lastError || id === undefined) {
          console.warn("Attachment download failed:", att.name, att.url, chrome.runtime.lastError?.message);
          showToast(`Could not download: ${att.name}`);
        }
      });
    }
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(
    () => showToast("Copied!"),
    () => showToast("Copy failed")
  );
}

document.getElementById("copy-text-btn").addEventListener("click", () => {
  if (!currentData) return;
  copyToClipboard(getPromptPrefix() + toPlainText(currentData));
});

document.getElementById("copy-json-btn").addEventListener("click", () => {
  if (!currentData) return;
  const payload = includePromptCheckbox.checked && promptTextEl.value.trim()
    ? { systemPrompt: promptTextEl.value.trim(), ...currentData }
    : currentData;
  copyToClipboard(JSON.stringify(payload, null, 2));
});

document.getElementById("download-chat-btn").addEventListener("click", () => {
  if (!currentData) return;
  downloadChat(currentData);
});

// --- Filters ---

searchInput.addEventListener("input", () => {
  if (currentData) renderComments(currentData.comments);
});

hideInternalCheckbox.addEventListener("change", () => {
  if (currentData) renderComments(currentData.comments);
});

stripQuotedCheckbox.addEventListener("change", () => {
  if (currentData) renderComments(currentData.comments);
});
