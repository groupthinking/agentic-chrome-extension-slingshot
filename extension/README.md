# Agentic Builder — Chrome Extension

## Current Status (Issue #5 Implemented)

- Secure token vault using `chrome.storage.local`
- Auth status bar in the popup
- Connect / Disconnect GitHub flow (Personal Access Token for now)
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

## Open Issues

- [#1](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/1) Chat / Voice Funneling
- [#2](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/2) React Flow Diagram
- [#3](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/3) GitHub OAuth + Auto Commit
- [#4](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/4) Vercel One-Click Deploy
- [#5](https://github.com/groupthinking/agentic-chrome-extension-slingshot/issues/5) Secure Token Vault ✅ (foundation done)
