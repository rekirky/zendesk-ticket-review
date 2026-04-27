# Zendesk Ticket Extractor

A Chrome extension for extracting the full conversation history from a Zendesk ticket, ready to copy into AI tools, documentation, or anywhere else.

## Features

- **Extract full conversation** — all messages in chronological order with author, timestamp, and internal/public status
- **Latest update only** — one-click extraction of just the most recent message
- **Attachment support** — inline images and file attachments are listed per message with direct links
- **Signature stripping** — automatically removes email signatures (English and multilingual: German, French, Spanish, Dutch)
- **Filter and search** — filter messages by keyword or hide internal notes
- **Three copy formats:**
  - **Text** — plain readable format for pasting into emails or documents
  - **JSON** — structured data for feeding into AI tools or scripts
  - **Markdown** — formatted output with inline images rendered, suitable for Notion, GitHub, etc.

## Installation

This extension is not published to the Chrome Web Store. Load it manually as an unpacked extension:

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the `extension/` folder
5. The Zendesk Ticket Extractor icon will appear in your toolbar

## Usage

1. Navigate to a Zendesk ticket (URL must contain `/tickets/`)
2. Click the extension icon in the Chrome toolbar
3. Click **Extract Ticket** to load the full conversation, or **Latest Update** for the most recent message only
4. Use the **Filter messages** box to search by author name or message content
5. Check **Hide internal** to exclude internal notes from the view
6. Click one of the copy buttons to copy the conversation to your clipboard:
   - **Copy as Text** — plain text with message separators
   - **Copy as JSON** — full structured data including attachments array
   - **Copy as Markdown** — formatted with headings, inline images, and attachment links

## Notes

- Works with Zendesk's Agent Workspace (Polaris UI) at `*.zendesk.com`
- If multiple tickets are open in tabs, the extension extracts only the currently visible ticket
- Signatures are stripped from the end of messages based on common closing phrases — if a message is unexpectedly truncated, the sign-off pattern may have matched mid-body
- Attachment links are the live Zendesk URLs and require an active Zendesk session to open
- The extension operates entirely locally — no data is sent anywhere outside your browser

## Project structure

```
extension/
├── manifest.json       # Chrome extension manifest (MV3)
├── background.js       # Service worker — relays messages between popup and content script
├── content.js          # Runs on Zendesk pages — extracts ticket data from the DOM
├── popup.html          # Extension popup UI
├── popup.js            # Popup controller — rendering, filtering, copy logic
└── icons/              # Extension icons (16px, 48px, 128px)
```
