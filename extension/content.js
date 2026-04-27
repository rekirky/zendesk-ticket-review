// Zendesk Ticket Extractor - Content Script
// Runs in the context of Zendesk pages to extract ticket conversations.

(function () {
  "use strict";

  // --- Selector strategies for different Zendesk UI versions ---

  const SELECTORS = {
    // Ticket subject
    subject: [
      '[data-test-id="ticket-subject"]',
      ".ticket-title",
      "h1.ticket-title",
      '[aria-label="Ticket subject"]',
      ".pane-header h1",
    ],
    // Ticket ID
    ticketId: [
      '[data-test-id="ticket-id"]',
      ".ticket-id",
      "#ticket_id",
      'a[href*="/tickets/"]',
    ],
    // Individual message/comment containers
    // Zendesk Agent Workspace (Polaris) uses omni-log-comment-item ARTICLE elements
    comments: [
      '[data-test-id="omni-log-comment-item"]',
      '[data-test-id="ticket-comment"]',
      ".comment",
      ".event.event-comment",
      '[class*="EventItem"]',
      ".ticket-event",
      '[data-comment-id]',
    ],
    // Author name within a comment
    author: [
      '[data-test-id="omni-log-comment-user-link"]',
      '[data-test-id="omni-log-item-sender"]',
      '[data-test-id="comment-author"]',
      ".author",
      ".comment-author",
      '[class*="authorName"]',
      ".name",
      "strong",
    ],
    // Timestamp within a comment
    timestamp: [
      '[data-test-id="timestamp-relative"]',
      "time",
      '[data-test-id="comment-timestamp"]',
      ".timestamp",
      ".time",
      '[class*="timestamp"]',
    ],
    // Body text within a comment
    body: [
      '[data-test-id="omni-log-message-content"]',
      '[data-test-id="omni-log-item-message"]',
      '[data-test-id="comment-body"]',
      ".zd-comment",
      ".comment-body",
      ".event-description",
      '[class*="CommentBody"]',
    ],
    // Whether comment is public or private/internal
    visibility: [
      '[data-test-id="omni-log-internal-note-tag"]',
      '[data-test-id="comment-type"]',
      ".comment-type",
      '[aria-label*="internal"]',
      '[aria-label*="private"]',
    ],
  };

  function firstMatch(root, selectors) {
    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch (_) {}
    }
    return null;
  }

  function allMatches(root, selectors) {
    for (const sel of selectors) {
      try {
        const els = root.querySelectorAll(sel);
        if (els.length > 0) return Array.from(els);
      } catch (_) {}
    }
    return [];
  }

  function cleanText(el) {
    if (!el) return "";
    // Preserve line breaks by replacing <br> with newlines before getting text
    const clone = el.cloneNode(true);
    clone.querySelectorAll("br").forEach((br) => {
      br.replaceWith("\n");
    });
    clone.querySelectorAll("p, div, blockquote").forEach((block) => {
      if (!block.textContent.endsWith("\n")) {
        block.appendChild(document.createTextNode("\n"));
      }
    });
    return clone.textContent
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const SIGN_OFF_RE = /^(regards|kind regards|best regards|warm regards|best wishes|many thanks|thanks|thank you|cheers|sincerely|yours (faithfully|sincerely|truly)|freundliche gr[uü][ßs]e|mit freundlichen gr[uü][ßs]en|viele gr[uü][ßs]e|herzliche gr[uü][ßs]e|cordialement|bien cordialement|salutations|saludos|un saludo|atentamente|met vriendelijke groet|groeten)[,.]?\s*$/i;

  function stripSignature(text) {
    const delimMatch = text.match(/\n--[ ]?\n/);
    if (delimMatch) return text.slice(0, delimMatch.index).trim();

    const lines = text.split("\n");
    const scanFrom = Math.max(0, lines.length - 50);
    for (let i = scanFrom; i < lines.length; i++) {
      if (SIGN_OFF_RE.test(lines[i].trim())) {
        return lines.slice(0, i).join("\n").trim();
      }
    }
    return text;
  }

  // Matches the start of forwarded/quoted email content
  const QUOTE_SEPARATOR_RE = /^([-_]{4,}[\s\w]*(?:original|forwarded|reply)[\s\w]*[-_]{4,}|_{4,}|on .{5,120} wrote:\s*$|from:\s*.+\n(?:sent|date):\s*.+\nto:\s*.+\n(?:cc:\s*.+\n)?subject:\s*)/im;

  function stripQuotedContent(text) {
    const match = text.match(QUOTE_SEPARATOR_RE);
    if (!match) return text;
    // Also strip any trailing blank lines left by > quote lines above the separator
    return text
      .slice(0, match.index)
      .split("\n")
      .filter((line, i, arr) => {
        // Drop leading > lines at the tail of the remaining content
        if (/^>/.test(line.trim())) return false;
        return true;
      })
      .join("\n")
      .trim();
  }

  function extractTicketId() {
    // Try URL first — most reliable
    const match = window.location.pathname.match(/\/tickets\/(\d+)/);
    if (match) return match[1];

    const el = firstMatch(document, SELECTORS.ticketId);
    if (!el) return null;
    const numMatch = el.textContent.match(/\d+/);
    return numMatch ? numMatch[0] : null;
  }

  function extractSubject() {
    const el = firstMatch(document, SELECTORS.subject);
    return el ? cleanText(el) : document.title;
  }

  function isInternal(commentEl) {
    // Zendesk Agent Workspace: aria-label on the article starts with "Internal note"
    const ariaLabel = (commentEl.getAttribute("aria-label") || "").toLowerCase();
    if (ariaLabel.startsWith("internal note")) return true;

    const visEl = firstMatch(commentEl, SELECTORS.visibility);
    if (visEl) {
      const text = visEl.textContent.toLowerCase();
      const label = (visEl.getAttribute("aria-label") || "").toLowerCase();
      if (
        text.includes("internal") ||
        text.includes("private") ||
        label.includes("internal") ||
        label.includes("private")
      ) {
        return true;
      }
    }
    // Check individual class tokens on the comment element itself
    return [...commentEl.classList].some((c) => /^(internal|private)$/i.test(c));
  }

  function attachmentName(url, fallbackText) {
    try {
      const u = new URL(url);
      return u.searchParams.get("name") || fallbackText || u.pathname.split("/").pop() || "attachment";
    } catch (_) {
      return fallbackText || "attachment";
    }
  }

  function extractAttachments(bodyEl) {
    if (!bodyEl) return [];
    const attachments = [];
    const seen = new Set();

    bodyEl.querySelectorAll("img").forEach((img) => {
      const src = img.src;
      if (!src || src.startsWith("data:") || seen.has(src)) return;
      seen.add(src);
      attachments.push({ name: attachmentName(src, img.alt || ""), url: src, type: "image" });
    });

    bodyEl.querySelectorAll("a[href]").forEach((a) => {
      const href = a.href;
      if (!href || seen.has(href)) return;
      if (!href.includes("attachment") && !a.hasAttribute("download")) return;
      seen.add(href);
      attachments.push({ name: attachmentName(href, a.textContent.trim()), url: href, type: "file" });
    });

    return attachments;
  }

  function getActiveConversationRoot() {
    // Find the visible conversation container to avoid picking up comments
    // from other open ticket tabs that Zendesk keeps in the DOM
    const candidates = [
      '[data-test-id="omni-log-container"]',
      '[data-test-id="ticket-main-conversation"]',
    ];
    for (const sel of candidates) {
      const els = Array.from(document.querySelectorAll(sel));
      const visible = els.find(
        (el) => el.offsetParent !== null && el.offsetWidth > 0
      );
      if (visible) return visible;
    }
    return document;
  }

  function extractComments() {
    const root = getActiveConversationRoot();
    const commentEls = allMatches(root, SELECTORS.comments);
    if (commentEls.length === 0) return [];

    return commentEls.map((el, index) => {
      const authorEl = firstMatch(el, SELECTORS.author);
      const timestampEl = firstMatch(el, SELECTORS.timestamp);
      const bodyEl = firstMatch(el, SELECTORS.body);

      const author = authorEl ? cleanText(authorEl) : "Unknown";
      const timestamp =
        timestampEl?.getAttribute("datetime") ||
        timestampEl?.getAttribute("title") ||
        cleanText(timestampEl) ||
        "";
      const body = stripSignature(cleanText(bodyEl || el));
      const internal = isInternal(el);
      const attachments = extractAttachments(bodyEl);

      return {
        index: index + 1,
        author,
        timestamp,
        body,
        internal,
        attachments,
      };
    });
  }

  function extractTicket() {
    const ticketId = extractTicketId();
    const subject = extractSubject();
    const comments = extractComments();
    const url = window.location.href;

    return {
      ticketId,
      subject,
      url,
      extractedAt: new Date().toISOString(),
      commentCount: comments.length,
      comments,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "extractTicket") {
      try {
        const data = extractTicket();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }

    if (message.action === "fetchAsDataUrl") {
      fetch(message.url, { credentials: "include" })
        .then((r) => r.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () =>
            sendResponse({ success: true, dataUrl: reader.result });
          reader.readAsDataURL(blob);
        })
        .catch((err) => sendResponse({ success: false, error: err.message }));
    }

    return true;
  });
})();
