// Basic popup logic (skeleton)
// In production this will call Grok API + manage React Flow

const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const voiceBtn = document.getElementById("voice-btn");
const commitBtn = document.getElementById("commit-btn");
const deployBtn = document.getElementById("deploy-btn");

function addMessage(role, text) {
  const div = document.createElement("div");
  div.style.marginBottom = "8px";
  div.innerHTML = `<strong>${role}:</strong> ${text}`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

sendBtn.addEventListener("click", async () => {
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage("You", text);
  inputEl.value = "";

  // TODO: Call Grok API here and funnel into agents
  addMessage("System", "Generating agent plan... (skeleton)");

  // Simulate success so buttons unlock
  setTimeout(() => {
    addMessage("System", "Plan ready. You can now commit & deploy.");
    commitBtn.disabled = false;
    deployBtn.disabled = false;
  }, 1200);
});

voiceBtn.addEventListener("click", () => {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    addMessage("System", "Speech recognition not supported in this browser.");
    return;
  }
  addMessage("System", "Voice input not fully wired yet (skeleton).");
});

commitBtn.addEventListener("click", () => {
  addMessage("System", "GitHub commit flow not implemented yet (see Issue #3).");
});

deployBtn.addEventListener("click", () => {
  addMessage("System", "Vercel deploy flow not implemented yet (see Issue #4).");
});

// Initial message
addMessage("System", "Ready. Describe the multi-agent system you want to build.");
