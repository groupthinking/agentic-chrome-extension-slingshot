# Agentic Builder — Chrome Extension

## Current Status (Issue #1 + #5 Implemented)

- Secure token vault using `chrome.storage.local`
- Auth status bar in the popup
- Connect / Disconnect GitHub flow (Personal Access Token for now)
- Text input funnel that calls Grok (xAI) and returns structured agent plans
- Voice capture via Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- Live editable agent diagram in popup (drag nodes, create/reconnect/delete edges, rename nodes)
- Diagram export as `JSON` and `Mermaid` (`.mmd`)
- Clean message-passing architecture between popup and service worker
- Ready for full OAuth upgrade later

## How to load

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension/` folder

## Testing Auth

1. Click **Connect GitHub**
2. Paste a GitHub Personal Access Token (needs `repo` scope)
3. The status bar should turn green and show your username
4. Click **Disconnect** to clear tokens

> For production we will replace the prompt with a proper OAuth flow using `chrome.identity` + a GitHub OAuth App.

## Testing Chat + Voice Funnel

1. Open the popup and type a broad product idea in the input.
2. On first run, paste your xAI API key when prompted.
3. Click **Send** (or press Enter). The popup should show:
   - detected industry
   - specific use-case
   - a clean list of agents and roles
   - a high-level workflow sequence
4. Click **🎙️** to start voice capture, speak your prompt, then click **⏹️** to stop.
5. Confirm transcript appears in input and can be sent through the same Grok funnel.

## Testing Diagram Editing + Export

1. Generate a plan using the chat input.
2. Confirm nodes render for each agent and edges render for flow.
3. Drag nodes to reposition them.
4. Click **Connect: Off** to turn connect mode on, then click source node and target node to create an edge.
5. Click an edge once to enter reconnect mode, select a new source node and target node.
6. Double-click any edge to delete it.
7. Double-click any node to rename it.
8. Click **Export JSON** and **Export Mermaid** and confirm files download.

## Open Issues

- [#1](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/1) Chat / Voice Funneling ✅ core implemented
- [#2](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/2) React Flow Diagram
- [#3](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/3) GitHub OAuth + Auto Commit
- [#4](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/4) Vercel One-Click Deploy
- [#5](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/5) Secure Token Vault ✅ (foundation done)
