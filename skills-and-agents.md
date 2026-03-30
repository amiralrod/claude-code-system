# Claude Code — Skills & Agents Guide

This guide covers the full system for managing Claude Code skills and agents: what they are, how they're organized, global vs project scope, updates, backup, and restore.

- **Skills registry:** `Skills/SKILLS-REGISTRY.md`
- **Agents registry:** `Agents/AGENTS-REGISTRY.md`
- **To add a skill:** use the `add-skill` skill (`Skills/local/add-skill/SKILL.md`)
- **To add an agent:** use the `add-agent` skill (`Skills/local/add-agent/SKILL.md`)

---

## Skills vs Agents — What's the Difference?

| | Skills | Agents |
|---|---|---|
| **What it is** | Instructions injected into Claude's context | A named sub-agent with its own system prompt and role |
| **File format** | `SKILL.md` with YAML frontmatter | `.md` file with YAML frontmatter |
| **Where it lives** | `~/ClaudeSystem/Skills/` | `~/ClaudeSystem/Agents/` → symlinked to `~/.claude/agents/` |
| **How it activates** | Auto-triggers based on description, or explicitly | Called by name (`@agent-name`) or auto-delegated |
| **System prompt** | Adds to Claude's existing context | **Replaces** Claude's system prompt entirely |
| **Tool access** | Inherited from session | Explicitly declared per agent |
| **Security risk** | Low | Higher — can declare `bypassPermissions`, inject MCP servers |
| **Meta-skills** | add-skill, remove-skill, find-skills | add-agent, remove-agent, find-agents |

---

## Skills

### What is a Skill?

A skill is a folder containing a `SKILL.md` file. It gives Claude specialized knowledge or a workflow for a specific task — loaded automatically when the context matches, or triggered explicitly.

Skills are not code. They're instructions, frameworks, and domain knowledge written in Markdown.

### Global vs Project Skills

| | Global | Project |
|---|---|---|
| **Where it lives** | `~/ClaudeSystem/Skills/` | `<project-root>/.claude/skills/` |
| **Available in** | Every project | That project only |
| **Registry** | `Skills/SKILLS-REGISTRY.md` | `.claude/PROJECT-SKILLS.md` |
| **Updates** | Daily via launchd (Mac) or cron (Linux) | Run `.claude/update-project-skills.sh` manually |
| **Backup** | Auto-pushed to GitHub | Backed up with the project repo |

**Rule of thumb:** Global if you'd want it in every project. Project-specific if it only makes sense in one context.

### Folder Structure

```
~/ClaudeSystem/
  Skills/
    local/
      <skill-name>/            ← third-party or downloaded skill
        SKILL.md
        .skill-source          ← raw URL to upstream SKILL.md (enables auto-update)
        .last-update-diff      ← created when an update is detected
      find-skills/             ← pre-installed: discover new skills
      add-skill/               ← pre-installed: install skills
      remove-skill/            ← pre-installed: remove skills
      add-agent/               ← pre-installed: install agents
      remove-agent/            ← pre-installed: remove agents
      find-agents/             ← pre-installed: discover agents
    mine/                      ← skills YOU build yourself (never auto-updated from outside)
    SKILLS-REGISTRY.md         ← global registry (canonical)
  Agents/
  update.sh
  setup.sh
  skills-and-agents.md         ← this guide
```

### Adding a Skill

Use the `add-skill` skill. Steps:
1. **Scope** — global or project-specific
2. **Conflict check** — compares against existing registries
3. **Identify type** — GitHub repo, downloaded file, or plugin marketplace
4. **Security & quality review** — skills.sh audits, user rating, install count, GitHub signals, manual content review
5. **Install** — clones, saves, or directs to Manage Plugins
6. **Project setup** — creates `.claude/CLAUDE.md`, `PROJECT-SKILLS.md`, `update-project-skills.sh` if needed
7. **Registry update** — adds a row to the right registry

Trigger: *"add this skill: [link or description]"*

### Removing a Skill

Use the `remove-skill` skill: looks up the skill, confirms, deletes folder, cleans `.gitignore`, removes registry row, commits.

Trigger: *"remove skill X"*

### Updating Skills

`update.sh` runs daily at **7:33 AM** via launchd (Mac) or cron (Linux). Runs on next wake if asleep.

- **Git repos**: `git pull` on every repo up to 2 levels deep
- **Local skills with `.skill-source`**: fetches upstream, diffs, notifies if changed
- **Local agents with `.<name>.source`**: same pattern
- **Plugins**: syncs `~/.claude/plugins/cache/` to registry
- **Backup**: commits everything and pushes to GitHub (if configured)

Run manually: `bash ~/ClaudeSystem/update.sh`
Logs: `/tmp/claude-system-update.log`

---

## Agents

### What is an Agent?

An agent is a named sub-agent with a defined role, system prompt, and tool access. Unlike skills (which add to Claude's context), an agent **replaces** Claude's system prompt entirely and runs in its own isolated context window. Agents can be called by name or auto-delegated when Claude determines the task matches.

### Security Note

Agents are higher-risk than skills to install from third parties:
- The agent's body **replaces your entire system prompt** — the author controls Claude's behavior completely
- `permissionMode: bypassPermissions` makes the agent execute commands without asking you
- Agents can declare their own `mcpServers` (custom tool connections)

Always review third-party agents carefully before installing. The `add-agent` skill enforces a strict security review.

### Global vs Project Agents

| | Global | Project |
|---|---|---|
| **Where it lives** | `~/.claude/agents/` (symlinked from `~/ClaudeSystem/Agents/`) | `<project-root>/.claude/agents/` |
| **Available in** | Every project | That project only |
| **Registry** | `Agents/AGENTS-REGISTRY.md` | `.claude/PROJECT-AGENTS.md` |
| **Updates** | Agents don't auto-update (static definitions) | Same |
| **Backup** | Auto-pushed to GitHub | Backed up with the project repo |

### Folder Structure

```
~/ClaudeSystem/Agents/   ← symlinked to ~/.claude/agents/
  mine/                        ← agents you created yourself
    <agent-name>.md
  local/                       ← downloaded third-party agents
    <agent-name>.md
    .<agent-name>.source        ← optional: upstream URL for the agent file
  AGENTS-REGISTRY.md           ← global registry (canonical)
```

Agent file format:
```markdown
---
name: agent-name
description: What this agent does and when to use it.
tools: Read, Grep, Glob, Bash
model: sonnet
---

You are a [role]. When invoked, [what you do]...
```

Key frontmatter fields:
- `name` — identifier for @-mentioning
- `description` — used for auto-delegation (make it specific)
- `tools` — allowlist of tools (be restrictive — principle of least privilege)
- `model` — `sonnet`, `opus`, `haiku`, or `inherit`
- `permissionMode` — avoid `bypassPermissions` unless you wrote it yourself

### Adding an Agent

Use the `add-agent` skill. Steps:
1. **Scope** — global or project-specific
2. **Conflict check** — compares name and description against existing agents
3. **Source** — GitHub repo, downloaded file, or write your own
4. **Security review (stricter than skills)**:
   - Flag `bypassPermissions` — confirm explicitly before installing
   - Flag any `mcpServers` declarations — confirm each one
   - Flag unusual tool access — confirm `Bash` or `Write` for agents that shouldn't need them
   - Check source signals: subagents.cc rating, GitHub stars, last commit
   - Read the full agent body — it becomes the system prompt
5. **Install** — save to `Agents/mine/` or `Agents/local/`
6. **Registry update** — add a row to AGENTS-REGISTRY.md

Trigger: *"add this agent: [link or description]"* or *"I want to create an agent for [role]"*

### Removing an Agent

Use the `remove-agent` skill: looks up the agent, confirms, deletes the file, removes registry row, commits.

Trigger: *"remove agent X"*

### Finding Agents

Use the `find-agents` skill. Searches:
- **subagents.cc** — primary community directory
- **VoltAgent/awesome-claude-code-subagents** — 127+ agents on GitHub
- **hesreallyhim/a-list-of-claude-code-agents** — community list

Trigger: *"find an agent for [task]"*

---

## Backup & Restore

### Backup

Set `BACKUP_REPO_URL` in `update.sh` to enable automatic daily backup to your own GitHub repo. The script commits and pushes any changes.

- **Project skills/agents**: backed up automatically with the project repo

### Restore on a New Machine

1. Clone the system repo:
   ```bash
   git clone https://github.com/amiralrod/claude-code-system ~/ClaudeSystem
   ```
2. Run setup:
   ```bash
   bash ~/ClaudeSystem/setup.sh
   ```
3. Re-install any additional skills/agents from your `SKILLS-REGISTRY.md` and `AGENTS-REGISTRY.md`:
   - **Git repo**: `git clone <source>` into `Skills/`; add to `Skills/.gitignore`
   - **Local file**: restore from `.skill-source` URL — `update.sh` will fetch it automatically on next run
   - **Plugin**: install via Claude Code → Manage Plugins

---

## Plugin Marketplace Skills

Some skills are installed via Claude Code's built-in **Manage Plugins** UI (⌘+Shift+P → Manage Plugins). These are managed by Claude Code itself — do not clone them manually.

- **Marketplaces tab**: add a GitHub repo URL as a source
- **Plugins tab**: install/uninstall individual skills

Installed plugins are tracked in `SKILLS-REGISTRY.md` automatically by the daily update script.

---

## Auto-Update Scheduler

`setup.sh` installs a daily job that runs `update.sh` at 7:33 AM:

- **Mac**: launchd job at `~/Library/LaunchAgents/com.claudesystem.update.plist`
- **Linux**: add to crontab (`crontab -e` → `33 7 * * * bash ~/ClaudeSystem/update.sh`)

```bash
# Mac — reload after editing update.sh:
launchctl unload ~/Library/LaunchAgents/com.claudesystem.update.plist
launchctl load ~/Library/LaunchAgents/com.claudesystem.update.plist

# Check status:
launchctl list | grep claudesystem
```

Logs: `/tmp/claude-system-update.log`

---

## Structure Symmetry — Disabled / Future-Ready Elements

The Skills and Agents systems are intentionally symmetric. Some elements exist in structure but are not yet active — they will activate automatically as you use them.

| Element | Skills | Agents | Status |
|---|---|---|---|
| Update script | `update.sh` (Part 1–2) | `update.sh` (Part 3) | Agents part active, no local agents yet |
| Registry | `Skills/SKILLS-REGISTRY.md` | `Agents/AGENTS-REGISTRY.md` | Both active |
| `mine/` folder | `Skills/mine/` | `Agents/mine/` | Both active |
| `local/` folder | `Skills/local/` | `Agents/local/` | Both present; agents local/ empty |
| `.gitignore` | `Skills/.gitignore` | — | Present |
| Project registry | `PROJECT-SKILLS.md` | `PROJECT-AGENTS.md` | Created by add-skill / add-agent |
| Project update script | `update-project-skills.sh` | `update-project-agents.sh` | Created by add-skill / add-agent |
| `~/.claude/agents` symlink | — | `~/.claude/agents` → `Agents/` | Active (set up by setup.sh) |
| find-* meta-skill | `find-skills` (via skills.sh) | `find-agents` (via subagents.cc + GitHub) | Both active |
| Meta-skills | add-skill, remove-skill | add-agent, remove-agent | All active |
