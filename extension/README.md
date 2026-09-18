# Agentic Builder — Chrome Extension

## Current Status (Issue #1 + #5 Implemented)

- Secure token vault using `chrome.storage.local`
- Auth status bar in the popup
- Connect / Disconnect GitHub flow (Personal Access Token for now)
- Text input funnel that calls Grok (xAI) and returns structured agent plans
- Voice capture via Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
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

## Open Issues

- [#1](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/1) Chat / Voice Funneling ✅ core implemented
- [#2](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/2) React Flow Diagram
- [#3](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/3) GitHub OAuth + Auto Commit
- [#4](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/4) Vercel One-Click Deploy
- [#5](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/5) Secure Token Vault ✅ (foundation done)
