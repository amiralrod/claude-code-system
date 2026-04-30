---
name: add-agent
description: Installs a Claude Code agent either globally (~/.claude/agents/ via ~/ClaudeSystem/Agents/) or project-locally (.claude/agents/), following the correct folder structure and registry conventions. Use this skill whenever the user mentions adding, installing, or creating an agent — even if they just share a GitHub link, a downloaded .md file, or describe a role they want without saying "add agent" explicitly. Also triggers when the user asks where to put an agent, how to create an agent role, or whether an agent should be global or project-specific.
---

# Add Agent

Agents are higher-risk than skills. An agent's markdown body **replaces Claude's entire system prompt** and runs in an isolated context window. The security review here is stricter than for skills.

---

## Step 0 — Global or Project-Specific?

**If running from `~/ClaudeSystem/`** — default to global. Still ask if they want project scope.

**If running from any other project directory** — ask explicitly:
> *"Do you want this agent globally (available in all your projects) or just for this project?"*

- **Global** → installs into `~/ClaudeSystem/Agents/`, updates `AGENTS-REGISTRY.md`
- **Project** → installs into `<project-root>/.claude/agents/`, updates `<project-root>/.claude/PROJECT-AGENTS.md`

---

## Step 1 — Conflict Check

Read the relevant registry and compare the new agent's name and description against every installed agent.

- **Global install**: check `~/ClaudeSystem/Agents/AGENTS-REGISTRY.md`
- **Project install**: check `.claude/PROJECT-AGENTS.md` AND the global registry

**If the name already exists:** Stop and ask whether to replace or rename.

**If the description overlaps significantly:** Show a side-by-side comparison and ask to install both with distinct descriptions, replace, or skip.

---

## Step 2 — Identify What You Have

| What you see | Path |
|---|---|
| A GitHub repo URL | → **Path A** |
| A downloaded file, pasted content, or `.md` file | → **Path B** |
| A description of a role the user wants to create | → **Path C** (author a new agent) |

---

## Step 3 — Security & Quality Review (STRICTER than skills)

Agents replace Claude's system prompt entirely. Run both sub-checks.

### 3a. Platform signals

**subagents.cc** — try `https://subagents.cc/<agent-name>`:
- User rating, install count, any community flags

**GitHub** — check the repo page:
- Stars, forks, last commit date
- Open issues, especially security-related

**If no signals are available:** Flag it explicitly — "No external signals found. Proceeding to scanner only."

Report a summary, e.g.:
> *"subagents.cc: ⭐ 4.2/5 · 320 installs · GitHub: 800 stars · last commit 3 weeks ago"*

Flag and confirm if: rating below 3/5, under 50 installs, last commit over a year ago with open issues, or no signals at all for a complex agent.

### 3b. repo-forensics scan + agent-specific field review

**Part 1 — repo-forensics scan:**

Run the scanner on the agent file/repo before installing. This covers prompt injection, credential theft, supply chain attacks, hidden backdoors, CVEs, CISA KEV, and more.

**Path A (GitHub repo):** Clone to the destination first, scan, then delete and abort if the scan fails:

```bash
# Clone to final destination
git clone <url> ~/ClaudeSystem/Agents/local/<agent-name>

# Full scan for agents (more thorough than --skill-scan)
~/ClaudeSystem/Skills/repo-forensics/skills/repo-forensics/scripts/run_forensics.sh \
  ~/ClaudeSystem/Agents/local/<agent-name>
```

If the scan returns exit code 2 (CRITICAL), delete and stop:
```bash
rm -rf ~/ClaudeSystem/Agents/local/<agent-name>
```

**Path B (downloaded .md file):** Save to its destination and scan it there:

```bash
~/ClaudeSystem/Skills/repo-forensics/skills/repo-forensics/scripts/run_forensics.sh \
  ~/ClaudeSystem/Agents/local/<agent-name>
```

If the scan fails (exit 2), delete the file and stop.

**Act on the exit code — do not skip this:**
- **Exit 0** — no findings, or LOW only. Safe to continue to Part 2.
- **Exit 1** — MEDIUM or HIGH findings. Show the full output and ask: *"repo-forensics flagged [N] issues. See above. OK to continue?"*
- **Exit 2** — CRITICAL findings. **Stop.** Do not install. Say: *"repo-forensics found CRITICAL issues — do not install without careful review."*

Always show the full scanner output to the user before asking for confirmation.

**Part 2 — Agent-specific frontmatter review (manual, not covered by the scanner):**

Read the agent's frontmatter and flag these fields specifically:

- **`permissionMode: bypassPermissions`** — major red flag. Confirm explicitly: *"This agent declares bypassPermissions, which means it will execute commands without asking you. Are you sure you want to install it?"*
- **`mcpServers`** — list the servers and ask: *"This agent connects to these MCP servers: [list]. Do you want to allow this?"*
- **`tools: Bash` or `tools: Write`** — flag if the agent's stated role doesn't clearly require them

### 3c. Combined verdict
- ✅ **Clear**: "Platform signals positive, repo-forensics passed, no dangerous frontmatter fields. Safe to install."
- ⚠️ **Warning**: "Issue flagged — [from scanner or frontmatter]. OK to continue?"
- 🚫 **Stop**: "repo-forensics found CRITICAL findings or dangerous permission fields — do not install without careful review."

---

## Installation — Global Scope

### Path A — GitHub Repo (global)

1. Fetch the `.md` file(s) from the repo.
2. **Confirm**: *"I'll install `<agent-name>` to `~/ClaudeSystem/Agents/mine/` (or `local/`). OK?"*
3. Save to `~/ClaudeSystem/Agents/local/<agent-name>.md`
4. If a source URL is known, save it to `~/ClaudeSystem/Agents/local/.<agent-name>.source` for future reference.

### Path B — Downloaded File (global)

1. Save to `~/ClaudeSystem/Agents/local/<agent-name>.md`
2. If source URL known, save to `~/ClaudeSystem/Agents/local/.<agent-name>.source`

### Path C — Author a New Agent (global)

1. Interview the user: what role, what tools needed, what should the system prompt say?
2. Draft the agent file together.
3. Save to `~/ClaudeSystem/Agents/mine/<agent-name>.md`

---

## Installation — Project Scope

1. Save to `<project-root>/.claude/agents/<agent-name>.md`
2. If `.claude/PROJECT-AGENTS.md` doesn't exist, create it:

```markdown
# Project Agents Registry

Agents installed locally for this project only. See `~/ClaudeSystem/Agents/AGENTS-REGISTRY.md` for global agents.

## Installed Agents

| Agent | Description | Role | Type | Source |
|---|---|---|---|---|
```

3. If `.claude/update-project-agents.sh` doesn't exist, create it:

```bash
#!/bin/bash
# Updates project-local agents in .claude/agents/
# Run manually or add as a git hook.

AGENTS_DIR="$(cd "$(dirname "$0")/agents" && pwd)"

# Update local agents with source URLs
for source_file in "$AGENTS_DIR"/.*.source; do
    [ -f "$source_file" ] || continue
    agent_name=$(basename "$source_file" .source | sed 's/^\.//')
    agent_md="$AGENTS_DIR/$agent_name.md"
    [ -f "$agent_md" ] || continue
    source_url=$(tr -d '[:space:]' < "$source_file")
    remote_content=$(curl -sf "$source_url")
    [ $? -ne 0 ] || [ -z "$remote_content" ] && continue
    current_content=$(cat "$agent_md")
    if [ "$remote_content" != "$current_content" ]; then
        diff <(echo "$current_content") <(echo "$remote_content") > "$AGENTS_DIR/.$agent_name.last-update-diff"
        printf '%s' "$remote_content" > "$agent_md"
        echo "Updated $agent_name"
    fi
done

echo "Done."
```

Make it executable:
```bash
chmod +x <project-root>/.claude/update-project-agents.sh
```

---

## Step 4 — Update Registry

- **Global install**: add a row to `~/ClaudeSystem/Agents/AGENTS-REGISTRY.md`
- **Project install**: add a row to `<project-root>/.claude/PROJECT-AGENTS.md`

Row format:
```
| <agent-name> | <short description> | <role> | <type> | <source> |
```

Where `<type>` is one of: `Mine`, `Local file`

---

## Note — No Discovery Symlink Needed for Global Agents

Unlike skills, global agents do **not** need a symlink in `~/.claude/agents/`. That directory is already a symlink to `~/ClaudeSystem/Agents/` — so any agent saved there is automatically discoverable in every project. No extra step needed.

(For reference: skills need per-skill symlinks in `~/.claude/skills/` because that directory is a real folder, not a symlink to the whole Skills directory.)

---

## Step 5 — Clean Up Test Artifacts

If any test files were created during authoring, delete them before finishing.

---

## Quick Reference

```
~/ClaudeSystem/Agents/
  mine/<agent-name>.md         ← agents you created
  local/<agent-name>.md        ← downloaded agents
    .<agent-name>.source       ← optional: upstream URL
  AGENTS-REGISTRY.md           ← global registry
```

Agent frontmatter fields:
- `name` — identifier
- `description` — used for auto-delegation (be specific)
- `tools` — allowlist (be restrictive)
- `model` — sonnet / opus / haiku / inherit
- `permissionMode` — omit unless you wrote this agent yourself
- `mcpServers` — list any custom tool connections