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
    comments: [
      '[data-test-id="ticket-comment"]',
      ".comment",
      ".event.event-comment",
      '[class*="EventItem"]',
      ".ticket-event",
      '[data-comment-id]',
    ],
    // Author name within a comment
    author: [
      '[data-test-id="comment-author"]',
      ".author",
      ".comment-author",
      '[class*="authorName"]',
      ".name",
      "strong",
    ],
    // Timestamp within a comment
    timestamp: [
      "time",
      '[data-test-id="comment-timestamp"]',
      ".timestamp",
      ".time",
      '[class*="timestamp"]',
    ],
    // Body text within a comment
    body: [
      '[data-test-id="comment-body"]',
      ".zd-comment",
      ".comment-body",
      ".event-description",
      '[class*="CommentBody"]',
      "[dir]",
    ],
    // Whether comment is public or private/internal
    visibility: [
      '[data-test-id="comment-type"]',
      ".comment-type",
      '[class*="internal"]',
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
    return clone.textContent.replace(/\n{3,}/g, "\n\n").trim();
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
    // Check classes on the comment element itself
    const cls = commentEl.className || "";
    return /internal|private/i.test(cls);
  }

  function extractComments() {
    const commentEls = allMatches(document, SELECTORS.comments);
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
      const body = cleanText(bodyEl || el);
      const internal = isInternal(el);

      return {
        index: index + 1,
        author,
        timestamp,
        body,
        internal,
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

  // Listen for extraction requests from the popup
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "extractTicket") {
      try {
        const data = extractTicket();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true; // keep channel open for async response
  });
})();
