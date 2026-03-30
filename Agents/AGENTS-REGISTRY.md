# Claude Code Agents — Global Registry

This file is the authoritative registry of all Claude Code agents installed at `~/ClaudeSystem/Agents/` (symlinked to `~/.claude/agents/`). Loaded globally across all projects via `~/.claude/CLAUDE.md`.

**To see what agents you have:** Ask Claude "what agents do I have?" or "do I have an agent for X?"

---

## Folder Structure

```
~/ClaudeSystem/Agents/
  mine/                 ← agents you created yourself
  local/                ← downloaded third-party agents
  AGENTS-REGISTRY.md   ← this file
```

> This is the **global** registry. Project-specific agents are tracked in `<project-root>/.claude/PROJECT-AGENTS.md`.

---

## Installed Agents

| Agent | Description | Role | Type | Source |
|---|---|---|---|---|

---

## Type Reference

| Type | Meaning |
|---|---|
| Mine | Agent you created yourself |
| Local file | Downloaded from a third-party source |

---

## Security Reminder

Agents replace Claude's system prompt entirely. Before installing any third-party agent, use the `add-agent` skill which enforces a strict security review — specifically checking for `bypassPermissions`, `mcpServers` declarations, and unusual tool access.
