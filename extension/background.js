// Service Worker — Secure Token Vault + Auth Architecture
// Issue #5 foundation

const STORAGE_KEYS = {
  GITHUB_TOKEN: "githubToken",
  VERCEL_TOKEN: "vercelToken",
  XAI_API_KEY: "xaiApiKey",
  GITHUB_USER: "githubUser",
  CONNECTED_AT: "connectedAt"
};

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_OAUTH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_OAUTH_SCOPES = ["repo", "read:user"];

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

function getGitHubClientId() {
  const clientId = chrome.runtime.getManifest()?.oauth2?.client_id;
  if (!clientId || clientId.includes("REPLACE_WITH_GITHUB_OAUTH_CLIENT_ID")) {
    throw new Error(
      "GitHub OAuth is not configured. Set oauth2.client_id in extension/manifest.json."
    );
  }
  return clientId;
}

function randomString(length = 64) {
  if (length <= 0) return "";
  const byteLength = Math.ceil((length * 3) / 4) + 8;
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toBase64Url(bytes).slice(0, length);
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toBase64Url(new Uint8Array(digest));
}

async function githubRequest(path, { token, method = "GET", body } = {}) {
  const headers = {
    Accept: "application/vnd.github+json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw formatGitHubError(response.status, errorText, response.headers);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function formatGitHubError(status, errorText, headers) {
  const parsedMessage = parseGitHubErrorMessage(errorText);

  if (status === 404) {
    return new Error("GitHub 404: Repository, branch, or path not found.");
  }

  if (status === 403) {
    const remaining = headers.get("x-ratelimit-remaining");
    if (remaining === "0" || /rate limit/i.test(parsedMessage)) {
      const reset = headers.get("x-ratelimit-reset");
      const resetMessage = reset
        ? ` Retry after ${new Date(Number(reset) * 1000).toISOString()}.`
        : "";
      return new Error(`GitHub rate limit exceeded.${resetMessage}`);
    }

    return new Error(
      "GitHub permission denied. Ensure your token has repo access and repository permissions."
    );
  }

  if (status === 401) {
    return new Error("GitHub authentication failed. Please reconnect GitHub.");
  }

  if (status === 422) {
    return new Error(`GitHub validation error: ${parsedMessage}`);
  }

  return new Error(`GitHub API error (${status}): ${parsedMessage}`);
}

function parseGitHubErrorMessage(errorText) {
  if (!errorText) return "Unknown GitHub error.";
  try {
    const parsed = JSON.parse(errorText);
    if (typeof parsed?.error_description === "string") return parsed.error_description;
    if (typeof parsed?.message === "string") return parsed.message;
    if (typeof parsed?.error === "string") return parsed.error;
  } catch (_err) {
    // Keep raw text fallback when the payload is not JSON.
  }

  return errorText.slice(0, 300);
}

function normalizeRelativePath(path) {
  return (path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/")
    .trim();
}

function joinPath(basePath, filePath) {
  const base = normalizeRelativePath(basePath);
  const file = normalizeRelativePath(filePath);

  if (!base) return file;
  if (!file) return base;
  return `${base}/${file}`;
}

async function connectGitHubOAuth() {
  const clientId = getGitHubClientId();
  const redirectUri = chrome.identity.getRedirectURL("github");
  const codeVerifier = randomString(96);
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const state = randomString(32);

  const authUrl = new URL(GITHUB_OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", GITHUB_OAUTH_SCOPES.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const callbackUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true
  });

  if (!callbackUrl) {
    throw new Error("GitHub OAuth canceled before completion.");
  }

  const callback = new URL(callbackUrl);
  if (callback.searchParams.get("state") !== state) {
    throw new Error("GitHub OAuth state mismatch. Please retry.");
  }

  const oauthError = callback.searchParams.get("error");
  if (oauthError) {
    const oauthDescription = callback.searchParams.get("error_description") || oauthError;
    throw new Error(`GitHub OAuth failed: ${oauthDescription}`);
  }

  const code = callback.searchParams.get("code");
  if (!code) {
    throw new Error("GitHub OAuth did not return an authorization code.");
  }

  const tokenResponse = await fetch(GITHUB_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri
    })
  });

  const tokenPayloadText = await tokenResponse.text();
  if (!tokenResponse.ok) {
    throw formatGitHubError(tokenResponse.status, tokenPayloadText, tokenResponse.headers);
  }

  const tokenPayload = tokenPayloadText ? JSON.parse(tokenPayloadText) : {};
  if (!tokenPayload.access_token) {
    throw new Error(
      `GitHub OAuth token exchange failed: ${parseGitHubErrorMessage(tokenPayloadText)}`
    );
  }

  const user = await githubRequest("/user", { token: tokenPayload.access_token });
  const githubUser = typeof user?.login === "string" ? user.login : null;

  await saveTokens({
    githubToken: tokenPayload.access_token,
    githubUser
  });

  return { githubUser };
}

function generateCommitMessage({ conversation = [], plan }) {
  const lastUserPrompt = [...conversation]
    .reverse()
    .find((entry) => entry && entry.role === "user" && typeof entry.text === "string")?.text;

  const cleanedPrompt = (lastUserPrompt || "")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "")
    .trim();

  const useCase = typeof plan?.useCase === "string" ? plan.useCase.trim() : "";
  const industry = typeof plan?.industry === "string" ? plan.industry.trim() : "";
  const scope = useCase || cleanedPrompt || "agent workflow";
  const suffix = industry ? ` for ${industry}` : "";
  let message = `feat(agent): scaffold ${scope}${suffix}`;
  if (message.length > 140) {
    message = `${message.slice(0, 137).trimEnd()}...`;
  }
  return message;
}

async function commitFilesToGitHub({
  token,
  owner,
  repo,
  branch,
  files,
  commitMessage
}) {
  const repository = await githubRequest(`/repos/${owner}/${repo}`, { token });
  const targetBranch = branch || repository.default_branch;
  if (!targetBranch) {
    throw new Error("Could not determine a target branch for commit.");
  }

  const encodedBranch = targetBranch.split("/").map(encodeURIComponent).join("/");
  const ref = await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/${encodedBranch}`, {
    token
  });
  const parentCommitSha = ref?.object?.sha;
  if (!parentCommitSha) {
    throw new Error("Could not determine the latest commit SHA for branch.");
  }

  const parentCommit = await githubRequest(
    `/repos/${owner}/${repo}/git/commits/${parentCommitSha}`,
    { token }
  );
  const baseTreeSha = parentCommit?.tree?.sha;
  if (!baseTreeSha) {
    throw new Error("Could not load base tree SHA for commit.");
  }

  const tree = [];
  for (const file of files) {
    if (!file?.path || typeof file?.content !== "string") continue;
    const blob = await githubRequest(`/repos/${owner}/${repo}/git/blobs`, {
      token,
      method: "POST",
      body: {
        content: file.content,
        encoding: "utf-8"
      }
    });

    tree.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha
    });
  }

  if (tree.length === 0) {
    throw new Error("No files provided for GitHub commit.");
  }

  const newTree = await githubRequest(`/repos/${owner}/${repo}/git/trees`, {
    token,
    method: "POST",
    body: {
      base_tree: baseTreeSha,
      tree
    }
  });

  const newCommit = await githubRequest(`/repos/${owner}/${repo}/git/commits`, {
    token,
    method: "POST",
    body: {
      message: commitMessage,
      tree: newTree.sha,
      parents: [parentCommitSha]
    }
  });

  await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/${encodedBranch}`, {
    token,
    method: "PATCH",
    body: {
      sha: newCommit.sha,
      force: false
    }
  });

  return {
    branch: targetBranch,
    commitSha: newCommit.sha,
    commitUrl: newCommit.html_url
  };
}

async function autoCommitGeneratedCode({
  owner,
  repo,
  branch,
  basePath,
  files,
  conversation,
  plan
}) {
  const tokens = await getTokens();
  const githubToken = tokens[STORAGE_KEYS.GITHUB_TOKEN];
  if (!githubToken) {
    throw new Error("GitHub is not connected.");
  }

  const normalizedOwner = (owner || "").trim();
  const normalizedRepo = (repo || "").trim();
  if (!normalizedOwner || !normalizedRepo) {
    throw new Error("Repository owner and name are required.");
  }

  const normalizedFiles = (Array.isArray(files) ? files : [])
    .map((file) => ({
      path: joinPath(basePath, file?.path),
      content: typeof file?.content === "string" ? file.content : ""
    }))
    .filter((file) => Boolean(file.path));

  if (normalizedFiles.length === 0) {
    throw new Error("No generated files were provided for commit.");
  }

  const commitMessage = generateCommitMessage({ conversation, plan });
  const result = await commitFilesToGitHub({
    token: githubToken,
    owner: normalizedOwner,
    repo: normalizedRepo,
    branch: (branch || "").trim(),
    files: normalizedFiles,
    commitMessage
  });

  return {
    ...result,
    commitMessage
  };
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

        case "CONNECT_GITHUB_OAUTH": {
          const result = await connectGitHubOAuth();
          sendResponse({ success: true, githubUser: result.githubUser || null });
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

        case "COMMIT_GENERATED_AGENT_CODE": {
          const result = await autoCommitGeneratedCode({
            owner: message.owner,
            repo: message.repo,
            branch: message.branch,
            basePath: message.basePath,
            files: message.files,
            conversation: message.conversation,
            plan: message.plan
          });
          sendResponse({
            success: true,
            branch: result.branch,
            commitSha: result.commitSha,
            commitUrl: result.commitUrl,
            commitMessage: result.commitMessage
          });
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
