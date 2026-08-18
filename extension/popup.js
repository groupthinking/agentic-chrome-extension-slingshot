// Popup logic with Auth foundation (Issue #5)

const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const voiceBtn = document.getElementById("voice-btn");
const commitBtn = document.getElementById("commit-btn");
const deployBtn = document.getElementById("deploy-btn");
const authStatusEl = document.getElementById("auth-status");
const connectGithubBtn = document.getElementById("connect-github");
const disconnectBtn = document.getElementById("disconnect-btn");

function addMessage(role, text) {
  const div = document.createElement("div");
  div.style.marginBottom = "8px";
  div.innerHTML = `<strong>${role}:</strong> ${text}`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ======================
// AUTH LAYER
// ======================
async function refreshAuthStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        resolve(null);
        return;
      }

      if (response?.githubConnected) {
        authStatusEl.textContent = `Connected as ${response.githubUser || "GitHub user"}`;
        authStatusEl.className = "connected";
        connectGithubBtn.style.display = "none";
        disconnectBtn.style.display = "inline-block";
        commitBtn.disabled = false;
      } else {
        authStatusEl.textContent = "Not connected";
        authStatusEl.className = "disconnected";
        connectGithubBtn.style.display = "inline-block";
        disconnectBtn.style.display = "none";
        commitBtn.disabled = true;
      }

      resolve(response);
    });
  });
}

// Simple token paste flow (for development)
// In production this will be replaced by full OAuth using chrome.identity
connectGithubBtn?.addEventListener("click", async () => {
  const token = prompt(
    "Paste a GitHub Personal Access Token (repo scope)\n\n" +
    "Create one at: https://github.com/settings/tokens\n\n" +
    "For production we will switch to full OAuth."
  );

  if (!token || !token.trim()) return;

  // Optional: fetch user info
  let user = null;
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token.trim()}` }
    });
    if (res.ok) {
      const data = await res.json();
      user = data.login;
    }
  } catch (e) {
    console.warn("Could not fetch GitHub user", e);
  }

  chrome.runtime.sendMessage(
    {
      type: "SAVE_GITHUB_TOKEN",
      token: token.trim(),
      user
    },
    async (response) => {
      if (response?.success) {
        addMessage("System", `GitHub connected${user ? " as @" + user : ""}`);
        await refreshAuthStatus();
      } else {
        addMessage("System", "Failed to save token");
      }
    }
  );
});

disconnectBtn?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "DISCONNECT_ALL" }, async () => {
    addMessage("System", "Disconnected from GitHub");
    await refreshAuthStatus();
  });
});

// ======================
// CHAT (still skeleton)
// ======================
sendBtn.addEventListener("click", async () => {
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage("You", text);
  inputEl.value = "";

  addMessage("System", "Generating agent plan... (Issue #1 not implemented yet)");

  setTimeout(() => {
    addMessage("System", "Plan ready (simulated).");
    // Only enable deploy if we want, commit depends on auth
    deployBtn.disabled = false;
  }, 1000);
});

voiceBtn.addEventListener("click", () => {
  addMessage("System", "Voice input coming in Issue #1");
});

commitBtn.addEventListener("click", () => {
  addMessage("System", "GitHub commit flow → see Issue #3");
});

deployBtn.addEventListener("click", () => {
  addMessage("System", "Vercel deploy flow → see Issue #4");
});

// Init
addMessage("System", "Ready. Connect GitHub first (recommended), then describe your agent system.");
refreshAuthStatus();
