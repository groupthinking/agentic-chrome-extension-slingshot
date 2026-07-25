# DISCOVER

## Core Problem, Target Segment(s), and Value Gap
The idea addresses the friction in building/deploying agentic AI systems via a conversational Chrome extension (forked from Nanobrowser, using React Flow for diagrams, CrewAI for agents, GitHub/Vercel APIs for coding/deployment).

**Target segments:**
- Indie devs / PMs (majority of Chrome extension power users)
- Enterprises adopting AI agents (still early, high projected value)
- No-coders / technical founders seeking "convo-to-deploy" tools

**Value gap:** Existing tools (v0, Cursor, Copilot, standalone CrewAI) handle pieces but lack a seamless browser-native funnel that goes from voice/chat → live agent diagram → GitHub code → one-click Vercel deploy.

## 3 Validated Customer Personas
1. **Indie Dev** (25-35) — Pain: setup time. Goal: ship MVPs fast.
2. **PM / Entrepreneur** (30-45) — Pain: non-technical barrier to agents. Goal: turn ideas into live systems without hiring.
3. **Enterprise DevOps** (35-50) — Pain: security & compliance. Goal: governed, auditable agent deployments.

## Market Demand Signals & Competitor Shortfalls
- AI agents market growing rapidly; Chrome extension ecosystem still large and under-served for true agentic builders.
- Competitors (Vercel v0, Cursor, CrewAI platforms) leave gaps in end-to-end browser experience + automatic repo + deploy.
- Common failure points: OAuth/token handling, Manifest V3 permissions, GitHub API edge cases (404s, rate limits), Vercel webhook/deploy auth.

## Reality vs Perception & Economic Value
**Perception:** "Working prototype in one afternoon."
**Reality:** 2–4 weeks minimum for solid auth, error handling, Chrome store readiness, and security review.

**Economic potential:**
- Freemium model ($0 / $9–$29/mo)
- Realistic early MRR: $10k–$50k if product-market fit is hit
- Upside in enterprise contracts, but requires strong security story

**Biggest assumptions that will get you stuck:**
1. Seamless GitHub + Vercel OAuth in a Chrome extension (token storage, refresh, scopes)
2. Chrome Web Store approval for powerful scripting/activeTab permissions
3. "One-click deploy" actually working without user account linking and error recovery
4. Users will trust an extension that writes to their GitHub repos

## Key Takeaways
- Demand is real. Ease of build is overstated.
- Biggest risk is auth + permissions + trust, not the agent logic itself.
- Economic value exists but only after solving the deployment friction that everyone else also struggles with.
