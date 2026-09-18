// Service Worker — Secure Token Vault + Auth Architecture
// Issue #5 foundation

const STORAGE_KEYS = {
  GITHUB_TOKEN: "githubToken",
  VERCEL_TOKEN: "vercelToken",
  XAI_API_KEY: "xaiApiKey",
  GITHUB_USER: "githubUser",
  CONNECTED_AT: "connectedAt"
};

// Helper: Get tokens securely
async function getTokens() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [
        STORAGE_KEYS.GITHUB_TOKEN,
        STORAGE_KEYS.VERCEL_TOKEN,
        STORAGE_KEYS.XAI_API_KEY,
        STORAGE_KEYS.GITHUB_USER
      ],
      (result) => resolve(result)
    );
  });
}

// Helper: Save tokens
async function saveTokens({ githubToken, vercelToken, xaiApiKey, githubUser }) {
  const data = {};
  if (githubToken !== undefined) data[STORAGE_KEYS.GITHUB_TOKEN] = githubToken;
  if (vercelToken !== undefined) data[STORAGE_KEYS.VERCEL_TOKEN] = vercelToken;
  if (xaiApiKey !== undefined) data[STORAGE_KEYS.XAI_API_KEY] = xaiApiKey;
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
        STORAGE_KEYS.XAI_API_KEY,
        STORAGE_KEYS.GITHUB_USER,
        STORAGE_KEYS.CONNECTED_AT
      ],
      () => resolve(true)
    );
  });
}

async function callGrokFunnel({ userInput }) {
  const tokens = await getTokens();
  const xaiApiKey = tokens[STORAGE_KEYS.XAI_API_KEY];

  if (!xaiApiKey) {
    throw new Error("Missing xAI API key. Save it in the extension before generating plans.");
  }

  const systemPrompt =
    "You are an AI product architect that transforms broad user goals into a focused multi-agent build plan. " +
    "Always funnel from broad idea to specific industry and use-case, then to concrete agent roles and workflow. " +
    "Return ONLY valid JSON with this shape: " +
    '{"industry":"string","useCase":"string","agents":[{"name":"string","role":"string","goal":"string"}],"workflowSteps":["string"]}. ' +
    "Keep output concise and practical.";

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${xaiApiKey}`
    },
    body: JSON.stringify({
      model: "grok-3-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Grok request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Grok response was empty or malformed.");
  }

  return { content };
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

        case "SAVE_XAI_TOKEN": {
          await saveTokens({ xaiApiKey: message.token });
          sendResponse({ success: true });
          break;
        }

        case "GENERATE_AGENT_PLAN": {
          const result = await callGrokFunnel({ userInput: message.userInput || "" });
          sendResponse({ success: true, content: result.content });
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
