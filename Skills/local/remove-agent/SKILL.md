---
name: remove-agent
description: Removes a Claude Code agent cleanly — deletes the agent file, removes the registry entry, and commits the change to GitHub. Trigger this skill when the user asks to remove, uninstall, or delete an agent.
---

# Remove Agent

## Step 1 — Identify the agent

Ask the user which agent they want to remove if not already clear. Then look it up:

- **Global agents**: check `~/ClaudeSystem/Agents/AGENTS-REGISTRY.md`
- **Project agents**: check `<project-root>/.claude/PROJECT-AGENTS.md`

Read the registry row to determine:
- **Agent name** and **file location**
- **Type** (Mine, Local file)

If the agent isn't found in either registry, say so and stop.

## Step 2 — Confirm before deleting

Show the user what will be removed:

> *"I'll remove `<agent-name>` (`<file-path>`). This will delete the agent file and remove it from the registry. OK to proceed?"*

Wait for confirmation.

## Step 3 — Remove the file

### Global agent (Mine or Local file)
```bash
rm ~/ClaudeSystem/Agents/mine/<agent-name>.md           # if Mine
rm ~/ClaudeSystem/Agents/local/<agent-name>.md          # if Local file
rm ~/ClaudeSystem/Agents/local/.<agent-name>.source     # if source file exists
```

### Project agent
```bash
rm <project-root>/.claude/agents/<agent-name>.md
```

## Step 4 — Remove from registry

Delete the agent's row from the relevant registry file:
- Global: `~/ClaudeSystem/Agents/AGENTS-REGISTRY.md`
- Project: `<project-root>/.claude/PROJECT-AGENTS.md`

## Step 5 — Commit and push (global agents only)

```bash
cd ~/Claude\ Code
git add -A
git commit -m "Remove agent: <agent-name>"
git push
```

Confirm to the user: *"`<agent-name>` has been removed and the backup updated."*
