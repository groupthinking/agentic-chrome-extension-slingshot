// Service Worker — Secure Token Vault + Auth Architecture
// Issue #5 foundation

const STORAGE_KEYS = {
  GITHUB_TOKEN: "githubToken",
  VERCEL_TOKEN: "vercelToken",
  GITHUB_USER: "githubUser",
  CONNECTED_AT: "connectedAt"
};

// Helper: Get tokens securely
async function getTokens() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [STORAGE_KEYS.GITHUB_TOKEN, STORAGE_KEYS.VERCEL_TOKEN, STORAGE_KEYS.GITHUB_USER],
      (result) => resolve(result)
    );
  });
}

// Helper: Save tokens
async function saveTokens({ githubToken, vercelToken, githubUser }) {
  const data = {};
  if (githubToken !== undefined) data[STORAGE_KEYS.GITHUB_TOKEN] = githubToken;
  if (vercelToken !== undefined) data[STORAGE_KEYS.VERCEL_TOKEN] = vercelToken;
  if (githubUser !== undefined) data[STORAGE_KEYS.GITHUB_USER] = githubUser;
  data[STORAGE_KEYS.CONNECTED_AT] = new Date().toISOString();

  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve(true));
  });
}

// Helper: Clear all auth data
async function clearTokens() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(
      [
        STORAGE_KEYS.GITHUB_TOKEN,
        STORAGE_KEYS.VERCEL_TOKEN,
        STORAGE_KEYS.GITHUB_USER,
        STORAGE_KEYS.CONNECTED_AT
      ],
      () => resolve(true)
    );
  });
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case "GET_AUTH_STATUS": {
          const tokens = await getTokens();
          sendResponse({
            githubConnected: Boolean(tokens[STORAGE_KEYS.GITHUB_TOKEN]),
            vercelConnected: Boolean(tokens[STORAGE_KEYS.VERCEL_TOKEN]),
            githubUser: tokens[STORAGE_KEYS.GITHUB_USER] || null
          });
          break;
        }

        case "SAVE_GITHUB_TOKEN": {
          await saveTokens({
            githubToken: message.token,
            githubUser: message.user || null
          });
          sendResponse({ success: true });
          break;
        }

        case "SAVE_VERCEL_TOKEN": {
          await saveTokens({ vercelToken: message.token });
          sendResponse({ success: true });
          break;
        }

        case "DISCONNECT_ALL": {
          await clearTokens();
          sendResponse({ success: true });
          break;
        }

        case "GET_TOKENS": {
          // Only return tokens to trusted extension pages
          const tokens = await getTokens();
          sendResponse(tokens);
          break;
        }

        default:
          sendResponse({ error: "Unknown message type" });
      }
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();

  return true; // Keep the message channel open for async response
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Agentic Builder] Installed — Auth vault ready");
});
