// Service worker (Manifest V3)
// Handles OAuth, token storage, and long-running tasks

chrome.runtime.onInstalled.addListener(() => {
  console.log("Agentic Builder installed");
});

// Placeholder for OAuth token management
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TOKENS") {
    chrome.storage.local.get(["githubToken", "vercelToken"], (result) => {
      sendResponse(result);
    });
    return true; // async
  }
});
