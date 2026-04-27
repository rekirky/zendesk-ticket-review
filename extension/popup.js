// Popup controller

let currentData = null;

const extractBtn = document.getElementById("extract-btn");
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
const toastEl = document.getElementById("toast");

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

  let visibleCount = 0;

  comments.forEach((c) => {
    const matchesSearch =
      !searchTerm ||
      c.author.toLowerCase().includes(searchTerm) ||
      c.body.toLowerCase().includes(searchTerm);
    const matchesFilter = !hideInternal || !c.internal;

    const div = document.createElement("div");
    div.className = "comment" + (c.internal ? " internal" : "");
    if (!matchesSearch || !matchesFilter) {
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
    body.textContent = c.body;

    div.appendChild(header);
    div.appendChild(body);
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

  toolbarEl.style.display = "flex";
  filterBarEl.style.display = "flex";

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
  conversationEl.innerHTML = "";
  emptyStateEl.style.display = "none";
  searchInput.value = "";
  hideInternalCheckbox.checked = false;
}

extractBtn.addEventListener("click", () => {
  extractBtn.disabled = true;
  showLoading();

  chrome.runtime.sendMessage({ action: "extractFromActiveTab" }, (response) => {
    extractBtn.disabled = false;
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

// --- Copy helpers ---

function toPlainText(data) {
  const lines = [
    `Ticket: ${data.ticketId ? "#" + data.ticketId : ""}  ${data.subject}`,
    `URL: ${data.url}`,
    `Extracted: ${formatTimestamp(data.extractedAt)}`,
    "",
  ];
  data.comments.forEach((c) => {
    lines.push(`--- Message #${c.index} ---`);
    lines.push(`From: ${c.author}${c.internal ? " [Internal]" : ""}`);
    if (c.timestamp) lines.push(`Date: ${formatTimestamp(c.timestamp)}`);
    lines.push("");
    lines.push(c.body);
    lines.push("");
  });
  return lines.join("\n");
}

function toMarkdown(data) {
  const lines = [
    `# Ticket ${data.ticketId ? "#" + data.ticketId : ""}: ${data.subject}`,
    "",
    `**URL:** ${data.url}  `,
    `**Extracted:** ${formatTimestamp(data.extractedAt)}  `,
    `**Messages:** ${data.commentCount}`,
    "",
    "---",
    "",
  ];
  data.comments.forEach((c) => {
    lines.push(
      `### #${c.index} — ${c.author}${c.internal ? " *(Internal)*" : ""}`
    );
    if (c.timestamp) lines.push(`*${formatTimestamp(c.timestamp)}*`);
    lines.push("");
    lines.push(c.body);
    lines.push("");
    lines.push("---");
    lines.push("");
  });
  return lines.join("\n");
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(
    () => showToast("Copied!"),
    () => showToast("Copy failed")
  );
}

document.getElementById("copy-text-btn").addEventListener("click", () => {
  if (!currentData) return;
  copyToClipboard(toPlainText(currentData));
});

document.getElementById("copy-json-btn").addEventListener("click", () => {
  if (!currentData) return;
  copyToClipboard(JSON.stringify(currentData, null, 2));
});

document.getElementById("copy-markdown-btn").addEventListener("click", () => {
  if (!currentData) return;
  copyToClipboard(toMarkdown(currentData));
});

// --- Filters ---

searchInput.addEventListener("input", () => {
  if (currentData) renderComments(currentData.comments);
});

hideInternalCheckbox.addEventListener("change", () => {
  if (currentData) renderComments(currentData.comments);
});
