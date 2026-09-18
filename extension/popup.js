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
const diagramPlaceholderEl = document.getElementById("react-flow-placeholder");
const DEFAULT_DIAGRAM_PLACEHOLDER = "Diagram will appear here after the first plan is generated.";
let activeRecognition = null;
let isSendingPlan = false;

function addMessage(role, text) {
  const div = document.createElement("div");
  div.style.marginBottom = "8px";
  const label = document.createElement("strong");
  label.textContent = `${role}: `;
  const body = document.createElement("span");
  body.textContent = text;
  div.appendChild(label);
  div.appendChild(body);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function extractJsonObject(text) {
  const direct = text.trim();
  if (direct.startsWith("{") && direct.endsWith("}")) {
    return direct;
  }

  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (blockMatch?.[1]) {
    return blockMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return null;
}

function parsePlan(rawContent) {
  const jsonText = extractJsonObject(rawContent);
  if (!jsonText) return null;

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return null;
  }

  const industry = typeof parsed.industry === "string" ? parsed.industry.trim() : "";
  const useCase = typeof parsed.useCase === "string" ? parsed.useCase.trim() : "";
  const agents = Array.isArray(parsed.agents)
    ? parsed.agents
        .map((agent) => ({
          name: typeof agent?.name === "string" ? agent.name.trim() : "",
          role: typeof agent?.role === "string" ? agent.role.trim() : "",
          goal: typeof agent?.goal === "string" ? agent.goal.trim() : ""
        }))
        .filter((agent) => agent.name && agent.role && agent.goal)
    : [];
  const workflowSteps = Array.isArray(parsed.workflowSteps)
    ? parsed.workflowSteps
        .filter((step) => typeof step === "string")
        .map((step) => step.trim())
        .filter(Boolean)
    : [];

  if (!industry || !useCase || agents.length === 0 || workflowSteps.length === 0) {
    return null;
  }

  return { industry, useCase, agents, workflowSteps };
}

function renderPlan(plan) {
  const lines = [
    `Industry: ${plan.industry}`,
    `Use case: ${plan.useCase}`,
    "Agents:"
  ];

  for (const agent of plan.agents) {
    lines.push(`- ${agent.name} (${agent.role}): ${agent.goal}`);
  }

  lines.push("Workflow:");
  plan.workflowSteps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });

  addMessage("Plan", lines.join(" "));

  if (diagramPlaceholderEl) {
    diagramPlaceholderEl.textContent = "";
    const summary = document.createElement("div");
    summary.style.padding = "10px";
    summary.style.width = "100%";
    summary.style.fontSize = "12px";
    summary.style.lineHeight = "1.5";
    summary.textContent = `${plan.industry} • ${plan.useCase}\n${plan.agents
      .map((agent) => `${agent.name} -> ${agent.role}`)
      .join(" | ")}`;
    diagramPlaceholderEl.appendChild(summary);
  }
}

async function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

async function ensureXaiToken() {
  const tokenState = await sendRuntimeMessage({ type: "GET_TOKENS" });
  if (tokenState?.xaiApiKey) return true;

  const key = prompt("Paste your xAI API key to enable Grok planning:");
  if (!key || !key.trim()) return false;

  const saveResponse = await sendRuntimeMessage({
    type: "SAVE_XAI_TOKEN",
    token: key.trim()
  });

  return Boolean(saveResponse?.success);
}

async function generateAgentPlanFromInput(text) {
  if (isSendingPlan) return;
  isSendingPlan = true;
  sendBtn.disabled = true;
  inputEl.disabled = true;

  try {
    const hasKey = await ensureXaiToken();
    if (!hasKey) {
      addMessage("System", "xAI API key is required to generate plans.");
      return;
    }

    addMessage("You", text);
    inputEl.value = "";
    addMessage("System", "Generating agent plan with Grok...");

    const response = await sendRuntimeMessage({
      type: "GENERATE_AGENT_PLAN",
      userInput: text
    });

    if (!response?.success) {
      const err = response?.error || "Unknown error";
      addMessage("System", `Plan generation failed: ${err}`);
      return;
    }

    const plan = parsePlan(response.content || "");
    if (!plan) {
      addMessage("System", "Received an invalid plan format from Grok. Please retry with a clearer prompt.");
      return;
    }

    renderPlan(plan);
    deployBtn.disabled = false;
  } finally {
    isSendingPlan = false;
    sendBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }
}

function initVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceBtn.disabled = true;
    voiceBtn.title = "Web Speech API is not available in this browser.";
    return;
  }

  voiceBtn.addEventListener("click", () => {
    if (activeRecognition) {
      activeRecognition.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    activeRecognition = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    voiceBtn.textContent = "⏹️";
    addMessage("System", "Listening...");

    recognition.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript?.trim() || "";
      if (!transcript) return;
      inputEl.value = inputEl.value ? `${inputEl.value} ${transcript}` : transcript;
      addMessage("Voice", transcript);
    };

    recognition.onerror = (event) => {
      addMessage("System", `Voice error: ${event.error}`);
    };

    recognition.onend = () => {
      activeRecognition = null;
      voiceBtn.textContent = "🎙️";
    };

    recognition.start();
  });
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
// CHAT + FUNNELING
// ======================
sendBtn.addEventListener("click", async () => {
  const text = inputEl.value.trim();
  if (!text) return;
  await generateAgentPlanFromInput(text);
});

inputEl.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  await generateAgentPlanFromInput(text);
});

initVoiceInput();

commitBtn.addEventListener("click", () => {
  addMessage("System", "GitHub commit flow → see Issue #3");
});

deployBtn.addEventListener("click", () => {
  addMessage("System", "Vercel deploy flow → see Issue #4");
});

// Init
if (diagramPlaceholderEl) {
  diagramPlaceholderEl.textContent = DEFAULT_DIAGRAM_PLACEHOLDER;
}
addMessage("System", "Ready. Connect GitHub, then describe your goal by typing or voice.");
refreshAuthStatus();
