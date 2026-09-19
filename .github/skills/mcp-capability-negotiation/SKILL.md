---
name: mcp-capability-negotiation
description: Validate and apply baseline MCP host/client/server capability negotiation for this repository.
---

Use this skill when asked to configure, verify, or troubleshoot MCP usage in this repository.

## Goal

Ensure baseline MCP negotiation is functional for context-aware agent workflows.

## Host / Client / Server model

- **Host:** coordinates clients, security boundaries, and authorization.
- **Client:** talks 1:1 with a server and sends `_meta` protocol/client capabilities.
- **Server:** exposes focused tools/resources/prompts and responds with declared capabilities.

## Capability negotiation baseline

1. Call `server/discover` before specialized requests when possible.
2. Ensure requests include protocol version and client capabilities metadata.
3. Use only capabilities both client and server declare.
4. Keep servers isolated; never assume cross-server shared conversation context.

## Repository-specific checks

- [ ] `.vscode/mcp.json` exists and contains valid JSON
- [ ] `filesystem` server is scoped to this workspace
- [ ] `github` MCP server is configured for PR/issues/actions context
- [ ] Security-sensitive data is never stored in skill/config files
- [ ] Manual verification notes are added to PR summary

## When reviewing MCP changes

- Verify smallest-possible config delta.
- Confirm no extra privileged tools/servers were added without justification.
- Include explicit pass/fail notes for baseline negotiation readiness.
