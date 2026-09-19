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
const diagramNodesEl = document.getElementById("diagram-nodes");
const diagramEdgesEl = document.getElementById("diagram-edges");
const diagramPlaceholderTextEl = diagramPlaceholderEl?.querySelector("p");
const toggleConnectBtn = document.getElementById("toggle-connect-btn");
const exportJsonBtn = document.getElementById("export-json-btn");
const exportMermaidBtn = document.getElementById("export-mermaid-btn");
const DEFAULT_DIAGRAM_PLACEHOLDER = "Diagram will appear here after the first plan is generated.";

let activeRecognition = null;
let isSendingPlan = false;
let graphState = {
  nodes: [],
  edges: [],
  connectMode: false,
  pendingSourceNodeId: null,
  reconnectEdgeId: null,
  reconnectSourceNodeId: null
};
let dragState = null;

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

function setConnectMode(enabled) {
  graphState.connectMode = enabled;
  if (!enabled) {
    graphState.pendingSourceNodeId = null;
  }

  if (toggleConnectBtn) {
    toggleConnectBtn.textContent = `Connect: ${enabled ? "On" : "Off"}`;
  }

  renderDiagram();
}

function clearReconnectMode() {
  graphState.reconnectEdgeId = null;
  graphState.reconnectSourceNodeId = null;
}

function setGraphFromPlan(plan) {
  const containerWidth = diagramPlaceholderEl?.clientWidth || 360;
  const nodeWidth = 120;
  const leftPadding = 16;
  const horizontalGap = 18;
  const maxColumns = Math.max(1, Math.floor((containerWidth - leftPadding * 2) / (nodeWidth + horizontalGap)));

  graphState.nodes = plan.agents.map((agent, index) => {
    const col = index % maxColumns;
    const row = Math.floor(index / maxColumns);
    return {
      id: `agent-${index + 1}`,
      name: agent.name,
      role: agent.role,
      goal: agent.goal,
      x: leftPadding + col * (nodeWidth + horizontalGap),
      y: 16 + row * 84
    };
  });

  graphState.edges = [];
  for (let i = 0; i < graphState.nodes.length - 1; i += 1) {
    graphState.edges.push({
      id: `edge-${i + 1}`,
      source: graphState.nodes[i].id,
      target: graphState.nodes[i + 1].id,
      label: plan.workflowSteps[i] || ""
    });
  }

  graphState.pendingSourceNodeId = null;
  clearReconnectMode();
  renderDiagram();
}

function getNodeById(nodeId) {
  return graphState.nodes.find((node) => node.id === nodeId) || null;
}

function updatePlaceholderVisibility() {
  if (!diagramPlaceholderTextEl) return;
  diagramPlaceholderTextEl.style.display = graphState.nodes.length > 0 ? "none" : "flex";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hasEdge(source, target) {
  return graphState.edges.some((edge) => edge.source === source && edge.target === target);
}

function renderDiagram() {
  if (!diagramNodesEl || !diagramEdgesEl) return;

  diagramNodesEl.textContent = "";
  diagramEdgesEl.textContent = "";

  updatePlaceholderVisibility();

  const nodeCenters = new Map();
  for (const node of graphState.nodes) {
    nodeCenters.set(node.id, {
      x: node.x + 60,
      y: node.y + 30
    });
  }

  const reconnectEdge = graphState.reconnectEdgeId
    ? graphState.edges.find((edge) => edge.id === graphState.reconnectEdgeId)
    : null;

  for (const edge of graphState.edges) {
    const sourceCenter = nodeCenters.get(edge.source);
    const targetCenter = nodeCenters.get(edge.target);
    if (!sourceCenter || !targetCenter) continue;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(sourceCenter.x));
    line.setAttribute("y1", String(sourceCenter.y));
    line.setAttribute("x2", String(targetCenter.x));
    line.setAttribute("y2", String(targetCenter.y));
    line.setAttribute("class", reconnectEdge?.id === edge.id ? "diagram-edge reconnect-target" : "diagram-edge");
    line.dataset.edgeId = edge.id;

    line.addEventListener("click", (event) => {
      event.stopPropagation();

      if (graphState.reconnectEdgeId === edge.id) {
        clearReconnectMode();
        renderDiagram();
        return;
      }

      graphState.reconnectEdgeId = edge.id;
      graphState.reconnectSourceNodeId = null;
      graphState.pendingSourceNodeId = null;
      addMessage("System", "Reconnect mode: click a source node, then a target node.");
      renderDiagram();
    });

    line.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      graphState.edges = graphState.edges.filter((item) => item.id !== edge.id);
      clearReconnectMode();
      renderDiagram();
      addMessage("System", "Edge removed.");
    });

    diagramEdgesEl.appendChild(line);
  }

  for (const node of graphState.nodes) {
    const nodeEl = document.createElement("div");
    nodeEl.className = "diagram-node";

    if (graphState.pendingSourceNodeId === node.id) {
      nodeEl.classList.add("connect-source");
    }

    if (graphState.reconnectSourceNodeId === node.id) {
      nodeEl.classList.add("reconnect-source");
    }

    if (reconnectEdge?.target === node.id) {
      nodeEl.classList.add("reconnect-target");
    }

    nodeEl.style.left = `${node.x}px`;
    nodeEl.style.top = `${node.y}px`;

    const nameEl = document.createElement("div");
    nameEl.className = "diagram-node-name";
    nameEl.textContent = node.name;

    const roleEl = document.createElement("div");
    roleEl.className = "diagram-node-role";
    roleEl.textContent = node.role;

    nodeEl.appendChild(nameEl);
    nodeEl.appendChild(roleEl);

    nodeEl.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      dragState = {
        nodeId: node.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startNodeX: node.x,
        startNodeY: node.y
      };
      event.preventDefault();
    });

    nodeEl.addEventListener("click", () => {
      if (graphState.reconnectEdgeId) {
        if (!graphState.reconnectSourceNodeId) {
          graphState.reconnectSourceNodeId = node.id;
          addMessage("System", "Reconnect mode: source selected. Click the new target node.");
          renderDiagram();
          return;
        }

        if (graphState.reconnectSourceNodeId === node.id) {
          addMessage("System", "Reconnect mode: target must be a different node.");
          return;
        }

        graphState.edges = graphState.edges.map((edge) => {
          if (edge.id !== graphState.reconnectEdgeId) return edge;
          return {
            ...edge,
            source: graphState.reconnectSourceNodeId,
            target: node.id
          };
        });

        clearReconnectMode();
        addMessage("System", "Edge reconnected.");
        renderDiagram();
        return;
      }

      if (!graphState.connectMode) return;

      if (!graphState.pendingSourceNodeId) {
        graphState.pendingSourceNodeId = node.id;
        renderDiagram();
        return;
      }

      if (graphState.pendingSourceNodeId === node.id) {
        graphState.pendingSourceNodeId = null;
        renderDiagram();
        return;
      }

      if (hasEdge(graphState.pendingSourceNodeId, node.id)) {
        graphState.pendingSourceNodeId = null;
        addMessage("System", "That connection already exists.");
        renderDiagram();
        return;
      }

      graphState.edges.push({
        id: `edge-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        source: graphState.pendingSourceNodeId,
        target: node.id,
        label: ""
      });
      graphState.pendingSourceNodeId = null;
      addMessage("System", "Edge created.");
      renderDiagram();
    });

    nodeEl.addEventListener("dblclick", () => {
      const renamed = prompt("Rename node", node.name);
      if (!renamed || !renamed.trim()) return;
      node.name = renamed.trim();
      renderDiagram();
      addMessage("System", `Node renamed to ${node.name}.`);
    });

    diagramNodesEl.appendChild(nodeEl);
  }
}

window.addEventListener("mousemove", (event) => {
  if (!dragState || !diagramPlaceholderEl) return;

  const node = getNodeById(dragState.nodeId);
  if (!node) {
    dragState = null;
    return;
  }

  const containerRect = diagramPlaceholderEl.getBoundingClientRect();
  const nextX = dragState.startNodeX + (event.clientX - dragState.startClientX);
  const nextY = dragState.startNodeY + (event.clientY - dragState.startClientY);

  node.x = clamp(nextX, 0, Math.max(0, containerRect.width - 120));
  node.y = clamp(nextY, 0, Math.max(0, containerRect.height - 60));
  renderDiagram();
});

window.addEventListener("mouseup", () => {
  dragState = null;
});

if (toggleConnectBtn) {
  toggleConnectBtn.addEventListener("click", () => {
    clearReconnectMode();
    setConnectMode(!graphState.connectMode);
  });
}

function makeExportPayload() {
  return {
    nodes: graphState.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      role: node.role,
      goal: node.goal,
      position: { x: node.x, y: node.y }
    })),
    edges: graphState.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label || ""
    }))
  };
}

function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toMermaid() {
  const exportPayload = makeExportPayload();
  const lines = ["graph LR"];
  const idMap = new Map();

  exportPayload.nodes.forEach((node, index) => {
    const mapped = `N${index + 1}`;
    idMap.set(node.id, mapped);
    const label = `${node.name.replace(/"/g, "'")} (${node.role.replace(/"/g, "'")})`;
    lines.push(`  ${mapped}["${label}"]`);
  });

  exportPayload.edges.forEach((edge) => {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    if (!source || !target) return;

    const label = edge.label ? `|${edge.label.replace(/[|\"]/g, "")}|` : "";
    lines.push(`  ${source} -->${label} ${target}`);
  });

  return lines.join("\n");
}

if (exportJsonBtn) {
  exportJsonBtn.addEventListener("click", () => {
    if (graphState.nodes.length === 0) {
      addMessage("System", "No diagram to export yet.");
      return;
    }

    const content = JSON.stringify(makeExportPayload(), null, 2);
    downloadText("agent-diagram.json", content, "application/json");
    addMessage("System", "Diagram exported as JSON.");
  });
}

if (exportMermaidBtn) {
  exportMermaidBtn.addEventListener("click", () => {
    if (graphState.nodes.length === 0) {
      addMessage("System", "No diagram to export yet.");
      return;
    }

    const mermaid = toMermaid();
    downloadText("agent-diagram.mmd", mermaid, "text/plain");
    addMessage("System", "Diagram exported as Mermaid.");
  });
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
  setGraphFromPlan(plan);
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
if (diagramPlaceholderTextEl) {
  diagramPlaceholderTextEl.textContent = DEFAULT_DIAGRAM_PLACEHOLDER;
}
setConnectMode(false);
addMessage("System", "Ready. Connect GitHub, then describe your goal by typing or voice.");
refreshAuthStatus();
