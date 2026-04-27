// Service worker — relays messages between popup and content script.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "fetchAttachmentFromTab") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ success: false, error: "No active tab" });
        return;
      }
      chrome.tabs.sendMessage(tab.id, { action: "fetchAsDataUrl", url: message.url }, sendResponse);
    });
    return true;
  }

  if (message.action === "extractFromActiveTab") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ success: false, error: "No active tab found" });
        return;
      }

      const url = tab.url || "";
      if (!url.includes("zendesk.com")) {
        sendResponse({
          success: false,
          error: "This page is not a Zendesk ticket. Navigate to a Zendesk ticket and try again.",
        });
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: "extractTicket" }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not yet injected — inject it manually then retry
          chrome.scripting.executeScript(
            { target: { tabId: tab.id }, files: ["content.js"] },
            () => {
              if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
              }
              chrome.tabs.sendMessage(tab.id, { action: "extractTicket" }, (r) => {
                sendResponse(r || { success: false, error: "No response from content script" });
              });
            }
          );
        } else {
          sendResponse(response || { success: false, error: "No response from content script" });
        }
      });
    });
    return true; // keep channel open for async response
  }
});
