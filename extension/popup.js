// Popup logic with Auth foundation (Issue #5)

const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const voiceBtn = document.getElementById("voice-btn");
const commitBtn = document.getElementById("commit-btn");
const deployBtn = document.getElementById("deploy-btn");
const authStatusEl = document.getElementById("auth-status");
const connectGithubBtn = document.getElementById("connect-github");
const connectVercelBtn = document.getElementById("connect-vercel");
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
let isGitHubConnected = false;
let isVercelConnected = false;
let latestGeneratedPlan = null;
let conversationHistory = [];
let latestCommitContext = null;
let lastVercelTarget = null;
let deploymentPollHandle = null;
let activeDeploymentId = null;

function normalizeConversationRole(role) {
  if (role === "You" || role === "Voice") return "user";
  if (role === "Plan") return "assistant";
  return "system";
}

function addMessage(role, text) {
  conversationHistory.push({
    role: normalizeConversationRole(role),
    text: String(text || "").trim()
  });

  if (conversationHistory.length > 50) {
    conversationHistory = conversationHistory.slice(-50);
  }

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

function updateCommitButtonState() {
  commitBtn.disabled = !isGitHubConnected || !latestGeneratedPlan;
}

function updateDeployButtonState() {
  deployBtn.disabled = !isGitHubConnected || !latestCommitContext || Boolean(activeDeploymentId);
}

function clearDeploymentPoll() {
  if (deploymentPollHandle) {
    clearTimeout(deploymentPollHandle);
    deploymentPollHandle = null;
  }
  activeDeploymentId = null;
  updateDeployButtonState();
}

function normalizeUrl(value) {
  if (!value || typeof value !== "string") return null;
  return value.startsWith("http") ? value : `https://${value}`;
}

function parseVercelScopeInput(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return { teamId: "", teamSlug: "", scopeLabel: "" };
  }

  if (/^team_/i.test(normalized)) {
    return { teamId: normalized, teamSlug: "", scopeLabel: normalized };
  }

  return { teamId: "", teamSlug: normalized, scopeLabel: normalized };
}

function formatDeploymentStatusMessage(status) {
  const state = status?.readyState || "UNKNOWN";
  if (state === "READY") {
    return `Deployment ready: ${normalizeUrl(status.liveUrl) || "Live URL unavailable."}`;
  }

  if (state === "ERROR" || state === "CANCELED" || state === "BLOCKED") {
    const details = status?.errorMessage ? ` ${status.errorMessage}` : "";
    return `Deployment ${state.toLowerCase()}.${details}`.trim();
  }

  return `Deployment status: ${state.toLowerCase()}...`;
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
  latestGeneratedPlan = plan;
  latestCommitContext = null;
  clearDeploymentPoll();
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
  updateCommitButtonState();
  updateDeployButtonState();
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

async function ensureVercelToken() {
  const authState = await refreshAuthStatus();
  if (authState?.vercelConnected) return true;

  const token = prompt("Paste your Vercel access token to enable one-click deploys:");
  if (!token || !token.trim()) return false;

  const saveResponse = await sendRuntimeMessage({
    type: "SAVE_VERCEL_TOKEN",
    token: token.trim()
  });

  if (!saveResponse?.success) {
    addMessage("System", `Vercel link failed: ${saveResponse?.error || "Unknown error"}`);
    return false;
  }

  addMessage("System", "Vercel access token saved.");
  await refreshAuthStatus();
  return true;
}

function pollDeploymentStatus({ deploymentId, teamId, teamSlug, lastState = "" }) {
  deploymentPollHandle = window.setTimeout(async () => {
    const response = await sendRuntimeMessage({
      type: "GET_VERCEL_DEPLOYMENT_STATUS",
      deploymentId,
      teamId,
      teamSlug
    });

    if (!response?.success) {
      addMessage("System", `Deployment status check failed: ${response?.error || "Unknown error"}`);
      clearDeploymentPoll();
      return;
    }

    if (response.readyState !== lastState) {
      addMessage("System", formatDeploymentStatusMessage(response));
    }

    if (["READY", "ERROR", "CANCELED", "BLOCKED"].includes(response.readyState)) {
      clearDeploymentPoll();
      return;
    }

    pollDeploymentStatus({
      deploymentId,
      teamId,
      teamSlug,
      lastState: response.readyState
    });
  }, 4000);
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

function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function escapeDoubleQuoted(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n");
}

function buildGeneratedFilesFromPlan(plan) {
  const safeUseCase = toSlug(plan.useCase) || "agent-system";
  const title = `${plan.useCase} (${plan.industry})`;
  const generatedAt = new Date().toISOString();
  const workflowText = plan.workflowSteps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  const agentsText = plan.agents
    .map((agent) => `- ${agent.name} (${agent.role}): ${agent.goal}`)
    .join("\n");
  const assistantTurns = conversationHistory
    .filter((entry) => entry.role === "assistant")
    .map((entry) => entry.text)
    .join("\n\n")
    .slice(0, 1200);

  const readme = `# Generated Agent Project: ${title}

Generated at: ${generatedAt}

## Scope
- Industry: ${plan.industry}
- Use case: ${plan.useCase}

## Agents
${agentsText}

## Workflow
${workflowText}

## Conversation Context
${assistantTurns || "No assistant context captured."}
`;

  const crewAiPython = `"""CrewAI-style scaffold generated by Agentic Builder."""

AGENTS = [
${plan.agents
  .map(
    (agent) =>
      `    {"name": "${escapeDoubleQuoted(agent.name)}", "role": "${escapeDoubleQuoted(agent.role)}", "goal": "${escapeDoubleQuoted(agent.goal)}"}`
  )
  .join(",\n")}
]

WORKFLOW_STEPS = [
${plan.workflowSteps.map((step) => `    "${escapeDoubleQuoted(step)}"`).join(",\n")}
]

def run():
    print("CrewAI scaffold initialized.")
    for agent in AGENTS:
        print(f"- {agent['name']} ({agent['role']}): {agent['goal']}")
    for index, step in enumerate(WORKFLOW_STEPS, start=1):
        print(f"{index}. {step}")


if __name__ == "__main__":
    run()
`;

  const langGraphPython = `"""LangGraph-style scaffold generated by Agentic Builder."""

NODES = [
${plan.agents
  .map((agent) => `    "${escapeDoubleQuoted(agent.name)}"`)
  .join(",\n")}
]

EDGES = [
${graphState.edges
  .map((edge) => {
    const source = graphState.nodes.find((node) => node.id === edge.source)?.name || edge.source;
    const target = graphState.nodes.find((node) => node.id === edge.target)?.name || edge.target;
    return `    ("${escapeDoubleQuoted(source)}", "${escapeDoubleQuoted(target)}")`;
  })
  .join(",\n")}
]

def build_graph():
    print("Nodes:")
    for node in NODES:
        print(f"- {node}")
    print("Edges:")
    for source, target in EDGES:
        print(f"{source} -> {target}")


if __name__ == "__main__":
    build_graph()
`;

  const planJson = JSON.stringify(
    {
      generatedAt,
      industry: plan.industry,
      useCase: plan.useCase,
      agents: plan.agents,
      workflowSteps: plan.workflowSteps,
      diagram: makeExportPayload()
    },
    null,
    2
  );

  return {
    suggestedBasePath: `generated/${safeUseCase}`,
    files: [
      { path: "README.md", content: readme },
      { path: "crewai/crew.py", content: crewAiPython },
      { path: "langgraph/graph.py", content: langGraphPython },
      { path: "plan.json", content: planJson }
    ]
  };
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

      isGitHubConnected = Boolean(response?.githubConnected);
      isVercelConnected = Boolean(response?.vercelConnected);
      const githubLabel = isGitHubConnected
        ? `GitHub @${response.githubUser || "user"}`
        : "GitHub not connected";
      const vercelLabel = isVercelConnected ? "Vercel linked" : "Vercel not linked";

      authStatusEl.textContent = `${githubLabel} • ${vercelLabel}`;
      authStatusEl.className = isGitHubConnected ? "connected" : "disconnected";
      connectGithubBtn.style.display = isGitHubConnected ? "none" : "inline-block";
      if (connectVercelBtn) {
        connectVercelBtn.textContent = isVercelConnected ? "Relink Vercel" : "Link Vercel";
      }
      disconnectBtn.style.display = isGitHubConnected || isVercelConnected ? "inline-block" : "none";
      updateCommitButtonState();
      updateDeployButtonState();

      resolve(response);
    });
  });
}

connectGithubBtn?.addEventListener("click", async () => {
  connectGithubBtn.disabled = true;
  addMessage("System", "Starting GitHub OAuth...");
  try {
    const response = await sendRuntimeMessage({ type: "CONNECT_GITHUB_OAUTH" });
    if (!response?.success) {
      addMessage("System", `GitHub OAuth failed: ${response?.error || "Unknown error"}`);
      return;
    }

    addMessage("System", `GitHub connected as @${response.githubUser || "user"}`);
    await refreshAuthStatus();
  } finally {
    connectGithubBtn.disabled = false;
  }
});

connectVercelBtn?.addEventListener("click", async () => {
  connectVercelBtn.disabled = true;
  try {
    await ensureVercelToken();
  } finally {
    connectVercelBtn.disabled = false;
  }
});

disconnectBtn?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "DISCONNECT_ALL" }, async () => {
    clearDeploymentPoll();
    addMessage("System", "Disconnected from GitHub and Vercel.");
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

commitBtn.addEventListener("click", async () => {
  if (!latestGeneratedPlan) {
    addMessage("System", "Generate a plan before committing to GitHub.");
    return;
  }

  const repoInput = prompt("Target repository (owner/repo):");
  if (!repoInput || !repoInput.trim()) return;

  const [owner, repo] = repoInput
    .trim()
    .split("/")
    .map((segment) => segment.trim());
  if (!owner || !repo) {
    addMessage("System", "Repository format must be owner/repo.");
    return;
  }

  const { suggestedBasePath, files } = buildGeneratedFilesFromPlan(latestGeneratedPlan);
  const basePathInput = prompt("Target path inside repo:", suggestedBasePath);
  if (basePathInput === null) return;

  const branchInput = prompt("Branch to commit to (leave empty for default branch):", "");
  if (branchInput === null) return;

  addMessage("System", `Committing ${files.length} generated files to ${owner}/${repo}...`);

  const response = await sendRuntimeMessage({
    type: "COMMIT_GENERATED_AGENT_CODE",
    owner,
    repo,
    branch: branchInput.trim(),
    basePath: basePathInput.trim(),
    files,
    conversation: conversationHistory,
    plan: latestGeneratedPlan
  });

  if (!response?.success) {
    addMessage("System", `GitHub commit failed: ${response?.error || "Unknown error"}`);
    return;
  }

  addMessage(
    "System",
    `Committed to ${owner}/${repo}@${response.branch} (${response.commitSha.slice(0, 7)}): ${response.commitMessage}`
  );
  latestCommitContext = {
    owner,
    repo,
    branch: response.branch,
    basePath: basePathInput.trim(),
    commitSha: response.commitSha
  };
  updateDeployButtonState();
});

deployBtn.addEventListener("click", async () => {
  if (!latestCommitContext) {
    addMessage("System", "Commit the generated files to GitHub before deploying to Vercel.");
    return;
  }

  const hasVercelToken = await ensureVercelToken();
  if (!hasVercelToken) {
    addMessage("System", "Vercel access token is required to deploy.");
    return;
  }

  let deploymentTarget = lastVercelTarget;
  if (!deploymentTarget) {
    const projectInput = prompt("Vercel project name or ID:", latestCommitContext.repo);
    if (projectInput === null) return;

    const project = projectInput.trim();
    if (!project) {
      addMessage("System", "Vercel project name or ID is required.");
      return;
    }

    const scopeInput = prompt(
      "Optional Vercel team slug or team_ ID (leave blank for your personal account):",
      ""
    );
    if (scopeInput === null) return;

    deploymentTarget = {
      project,
      ...parseVercelScopeInput(scopeInput)
    };
    lastVercelTarget = deploymentTarget;
  }

  activeDeploymentId = "starting";
  updateDeployButtonState();
  addMessage(
    "System",
    `Starting Vercel deployment for ${deploymentTarget.project} from ${latestCommitContext.owner}/${latestCommitContext.repo}@${latestCommitContext.branch}...`
  );

  const response = await sendRuntimeMessage({
    type: "CREATE_VERCEL_DEPLOYMENT",
    owner: latestCommitContext.owner,
    repo: latestCommitContext.repo,
    branch: latestCommitContext.branch,
    project: deploymentTarget.project,
    teamId: deploymentTarget.teamId,
    teamSlug: deploymentTarget.teamSlug
  });

  if (!response?.success) {
    clearDeploymentPoll();
    addMessage("System", `Vercel deploy failed: ${response?.error || "Unknown error"}`);
    return;
  }

  activeDeploymentId = response.deploymentId || null;
  updateDeployButtonState();
  addMessage(
    "System",
    `Deployment created from commit ${response.commitSha.slice(0, 7)}. ${formatDeploymentStatusMessage(response)}`
  );

  if (!activeDeploymentId || ["READY", "ERROR", "CANCELED", "BLOCKED"].includes(response.readyState)) {
    clearDeploymentPoll();
    return;
  }

  pollDeploymentStatus({
    deploymentId: activeDeploymentId,
    teamId: deploymentTarget.teamId,
    teamSlug: deploymentTarget.teamSlug,
    lastState: response.readyState
  });
});

// Init
if (diagramPlaceholderTextEl) {
  diagramPlaceholderTextEl.textContent = DEFAULT_DIAGRAM_PLACEHOLDER;
}
setConnectMode(false);
addMessage("System", "Ready. Connect GitHub, then describe your goal by typing or voice.");
refreshAuthStatus();
