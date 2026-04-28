# Zendesk Ticket Extractor

A Chrome extension for extracting the full conversation history from a Zendesk ticket, ready to copy into AI tools, documentation, or anywhere else.

## Features

- **Extract full conversation** — all messages in chronological order with author, timestamp, and internal/public status
- **Latest update only** — one-click extraction of just the most recent message
- **Ticket fields** — automatically extracts dropdown fields (Product, Region, Priority, etc.) from the ticket sidebar and includes them in exports
- **Attachment support** — inline images and file attachments (including log files) are listed per message with direct download links; images are placed inline at the position they appear in the original message
- **Download Chat** — saves the full conversation as `chat.txt` plus all attachments into a named folder in your Downloads directory (`zendesk-{id}/`)
- **Signature stripping** — automatically removes email signatures (English and multilingual: German, French, Spanish, Dutch)
- **Quoted content stripping** — optionally removes forwarded/replied email chains from within messages, hiding messages that contain nothing but quoted content
- **Filter and search** — filter messages by keyword, hide internal notes, or strip quoted content
- **System prompt** — save a reusable prompt (e.g. for an AI tool) that gets prepended to any export when "Include prompt" is checked; prompt persists across sessions
- **Two copy formats:**
  - **Copy as Text** — plain readable format for pasting into emails or AI tools
  - **Copy as JSON** — full structured data including ticket fields, comments, and attachments array

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
4. Ticket fields (Product, Region, Priority, etc.) appear as coloured pills in the header
5. Use the filter bar to narrow the conversation:
   - **Filter messages** — search by author name or message content
   - **Hide internal** — exclude internal notes
   - **Strip quoted** — remove forwarded/replied email chains; hides messages that are entirely quoted content
   - **Include prompt** — prepend your saved system prompt to any export
6. Click **System prompt** to expand the prompt editor — type your prompt and it saves automatically
7. Export the conversation:
   - **Copy as Text** — plain text with ticket fields, message separators, and attachment references
   - **Copy as JSON** — structured data including all fields, comments, and attachments
   - **Download Chat** — saves `chat.txt` and all attachments to `Downloads/zendesk-{id}/`

## Notes

- Works with Zendesk's Agent Workspace (Polaris UI) at `*.zendesk.com`
- If multiple tickets are open in tabs, the extension extracts only the currently visible ticket
- Signatures are stripped from the end of messages based on common closing phrases — if a message is unexpectedly truncated, the sign-off pattern may have matched mid-body
- Quoted content stripping looks for standard email separators (`-----Original Message-----`, `On [date] wrote:`, Outlook `From:/Sent:/To:` headers, `>` quoted lines)
- Attachment downloads use your active Zendesk session; some attachments on external domains may not be downloadable depending on CORS policy
- The system prompt is stored locally in the extension's storage and is never transmitted anywhere
- The extension operates entirely locally — no data is sent anywhere outside your browser

## Project structure

```
extension/
├── manifest.json       # Chrome extension manifest (MV3)
├── background.js       # Service worker — relays messages between popup and content script
├── content.js          # Runs on Zendesk pages — extracts ticket data, fields, and attachments from the DOM
├── popup.html          # Extension popup UI
├── popup.js            # Popup controller — rendering, filtering, copy/download logic
└── icons/              # Extension icons (16px, 48px, 128px)
```
