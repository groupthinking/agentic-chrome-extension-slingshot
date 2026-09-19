# Agentic Builder — Chrome Extension

## Current Status (Issue #1 + #3 + #5 Implemented)

- Secure token vault using `chrome.storage.local`
- Auth status bar in the popup
- GitHub OAuth2 flow via `chrome.identity.launchWebAuthFlow` (PKCE)
- Text input funnel that calls Grok (xAI) and returns structured agent plans
- Voice capture via Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- Live editable agent diagram in popup (drag nodes, create/reconnect/delete edges, rename nodes)
- Diagram export as `JSON` and `Mermaid` (`.mmd`)
- Auto-commit generated CrewAI/LangGraph-style scaffold files to a selected GitHub repository
- Clear GitHub API error handling for 404, rate limits, and permission errors
- Clean message-passing architecture between popup and service worker

## How to load

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension/` folder

## GitHub OAuth Setup

1. Create a GitHub OAuth App in your GitHub account settings.
2. Set Authorization callback URL to `https://<extension-id>.chromiumapp.org/github`.
3. Set `oauth2.client_id` in `extension/manifest.json`.
4. Reload the unpacked extension.

## Testing Auth

1. Click **Connect GitHub**.
2. Complete the OAuth consent flow.
3. The status bar should turn green and show your username.
4. Click **Disconnect** to clear stored credentials.

## Testing Chat + Voice Funnel

1. Open the popup and type a broad product idea in the input.
2. On first run, paste your xAI API key when prompted.
3. Click **Send** (or press Enter). The popup should show detected industry, use-case, agents, and workflow.
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

## Testing Auto Commit

1. Generate a plan.
2. Click **Commit to GitHub**.
3. Enter `owner/repo`, target path, and optional branch.
4. Confirm generated files are committed:
   - `README.md`
   - `crewai/crew.py`
   - `langgraph/graph.py`
   - `plan.json`
5. Confirm commit message is generated from conversation context and plan use-case.
6. Verify user-facing errors for missing repo/path (`404`), rate limit (`403`), and missing permissions (`403`).

## Open Issues

- [#1](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/1) Chat / Voice Funneling ✅ core implemented
- [#2](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/2) React Flow Diagram
- [#3](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/3) GitHub OAuth + Auto Commit ✅
- [#4](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/4) Vercel One-Click Deploy
- [#5](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/5) Secure Token Vault ✅ (foundation done)
