# PLAN (PRD)

## Product Overview
Conversational Chrome extension that turns natural language into a live multi-agent system with visual diagram, code generation, GitHub commit, and one-click Vercel deployment.

## User Stories
- As an indie dev I want to speak or type a goal so I get a working agent system deployed.
- As a PM I want an editable diagram + automatic code so the team can collaborate.
- As DevOps I want OAuth + audit trail so nothing is written without explicit approval.

## Top 5 MVP Features (RICE prioritized)
1. Chat / Voice Funneling (highest)
2. React Flow live diagram
3. GitHub OAuth + commit
4. Vercel one-click deploy
5. Secure token vault (chrome.storage + OAuth2)

## Tech Stack
- Frontend: React + @xyflow/react + Chrome Manifest V3
- Agent logic: CrewAI (Python backend on Render/Fly)
- Diagrams: Mermaid / React Flow
- Auth: GitHub OAuth2 + Vercel
- LLM: xAI Grok API

## Roadmap
- Month 1: Core funnel + diagram + GitHub commit (MVP)
- Month 2: Vercel deploy + error recovery + analytics
- Month 3: Enterprise features + Chrome store launch

## Success Metrics
- Installs, successful deploys %, 7-day retention, MRR
