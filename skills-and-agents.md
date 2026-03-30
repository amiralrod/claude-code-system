# Claude Code — Skills & Agents Guide

This guide covers the full system for managing Claude Code skills and agents: what they are, how they're organized, global vs project scope, updates, backup, restore, and cross-tool support.

- **Skills registry:** `System/Skills/SKILLS-REGISTRY.md`
- **Agents registry:** `System/Agents/AGENTS-REGISTRY.md`
- **To add a skill:** use the `add-skill` skill (`System/Skills/mine/add-skill/SKILL.md`)
- **To add an agent:** use the `add-agent` skill (`System/Skills/mine/add-agent/SKILL.md`)

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
| **Registry** | `System/Skills/SKILLS-REGISTRY.md` | `.claude/PROJECT-SKILLS.md` |
| **Updates** | Daily via launchd at 7:33 AM Israel time | Run `.claude/update-project-skills.sh` manually |
| **Backup** | Auto-pushed to GitHub | Backed up with the project repo |

**Rule of thumb:** Global if you'd want it in every project. Project-specific if it only makes sense in one context.

### Folder Structure

```
~/ClaudeSystem/
  System/
    Skills/
      <repo-name>/               ← git repo: single skill or collection (auto-updates)
      local/
        <skill-name>/            ← downloaded skill
          SKILL.md
          .skill-source          ← optional: raw URL to upstream SKILL.md (enables auto-update)
          .last-update-diff      ← created when an update is detected
      mine/                      ← skills you created yourself
        add-skill/               ← meta-skill: installs skills
        remove-skill/            ← meta-skill: removes skills
        add-agent/               ← meta-skill: installs agents
        remove-agent/            ← meta-skill: removes agents
        find-agents/             ← meta-skill: discovers agents
      codex-skills               ← symlink → ~/.codex/skills/ (Codex skills available here)
      SKILLS-REGISTRY.md         ← global registry (canonical)
    Agents/                      ← see Agents section below
    update.sh                    ← daily update script (runs from ~/ClaudeSystem/)
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
7. **Cleanup** — deletes any test workspace and evals folders created by skill-creator
8. **Registry update** — adds a row to the right registry

Trigger: *"add this skill: [link or description]"*

### Removing a Skill

Use the `remove-skill` skill: looks up the skill, confirms, deletes folder, cleans `.gitignore`, removes registry row, commits.

Trigger: *"remove skill X"*

### Updating Skills

`update.sh` runs daily at **7:33 AM Israel time** via launchd. Runs on next wake if asleep.

- **Git repos**: `git pull` on every repo up to 2 levels deep
- **Local skills with `.skill-source`**: fetches upstream, diffs, notifies if changed
- **Local agents with `.<name>.source`**: same pattern *(active but no local agents yet)*
- **Plugins**: syncs `~/.claude/plugins/cache/` to registry
- **Backup**: commits everything and pushes to GitHub

Run manually: `bash ~/ClaudeSystem/update.sh`
Logs: `/tmp/update-skills.log`

---

## Agents

### What is an Agent?

An agent is a named sub-agent with a defined role, system prompt, and tool access. Unlike skills (which add to Claude's context), an agent **replaces** Claude's system prompt entirely and runs in its own isolated context window. Agents can be called by name or auto-delegated when Claude determines the task matches.

### Security Note

Agents are higher-risk than skills to install from third parties:
- The agent's body **replaces your entire system prompt** — the author controls Claude's behavior completely
- `permissionMode: bypassPermissions` makes the agent execute commands without asking you
- Agents can declare their own `mcpServers` (custom tool connections)
- Known unresolved bug: agents can bypass permission deny rules

Always review third-party agents carefully before installing. The `add-agent` skill enforces a strict security review.

### Global vs Project Agents

| | Global | Project |
|---|---|---|
| **Where it lives** | `~/.claude/agents/` (symlinked from `~/ClaudeSystem/Agents/`) | `<project-root>/.claude/agents/` |
| **Available in** | Every project | That project only |
| **Registry** | `System/Agents/AGENTS-REGISTRY.md` | `.claude/PROJECT-AGENTS.md` |
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
5. **Install** — save to `System/Agents/mine/` or `System/Agents/local/`
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

Note: there is no single authoritative platform for agents yet (unlike skills.sh for skills). When a dedicated find-agents platform matures, the `find-agents` skill will be updated to use it.

Trigger: *"find an agent for [task]"*

---

## Cross-Tool Support (Codex)

Both skills and agents use the same file format across Claude Code and OpenAI Codex. Symlinks share them automatically.

### Skills (bidirectional)

```bash
# Your skills → Codex
ln -s ~/ClaudeSystem/Skills ~/.codex/skills/claude-code-skills

# Codex skills → Claude Code
ln -s ~/.codex/skills ~/ClaudeSystem/Skills/codex-skills
```

Both are already set up.

### Agents (Claude Code only for now)

Codex uses `AGENTS.md` for project instructions but does not have a sub-agents system equivalent to Claude Code's `~/.claude/agents/`. Codex agent symlinks will be added here when Codex supports named sub-agents.

### Updates & Backup (cross-tool)

- **Your skills/agents** → backed up to GitHub daily
- **Codex skills** → Codex manages its own; excluded from your git backup
- Symlinks mean both tools always see the latest without extra steps

---

## Backup & Restore

### Backup

Everything in `~/ClaudeSystem/` (System/Skills/ and System/Agents/) is tracked in one git repo pushed to GitHub. The daily script auto-commits and pushes any changes.

- **Project skills/agents**: backed up automatically with the project repo

### Restore on a new machine

1. Clone the repo:
   ```bash
   git clone https://github.com/amiralrod/my-claude-code ~/Claude\ Code
   ```
2. Re-install third-party skills from `SKILLS-REGISTRY.md`:
   - **Git repo**: `git clone <source>` into `Skills/`; add to `Skills/.gitignore`
   - **Local file**: `curl <source-url>` into `Skills/local/<name>/SKILL.md`; create `.skill-source`
   - **Plugin**: install via Claude Code → Manage Plugins
3. Re-install agents from `AGENTS-REGISTRY.md` similarly
4. Re-create symlinks:
   ```bash
   ln -s ~/Claude\ Code/Skills ~/.codex/skills/claude-code-skills
   ln -s ~/.codex/skills ~/Claude\ Code/Skills/codex-skills
   ln -s ~/Claude\ Code/Agents ~/.claude/agents
   ```
5. Re-register the launchd job:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.amir.update-skills.plist
   ```

---

## Plugin Marketplace Skills

Some skills are installed via Claude Code's built-in **Manage Plugins** UI (⌘+Shift+P → Manage Plugins). These are managed by Claude Code itself — do not clone them manually.

- **Marketplaces tab**: add a GitHub repo URL as a source
- **Plugins tab**: install/uninstall individual skills

Installed plugins are tracked in `SKILLS-REGISTRY.md` automatically by the daily update script.

---

## launchd Job

The global update runs via launchd, not cron. `StartCalendarInterval` fires at 7:33 AM daily and also runs on the next wake if the Mac was asleep — no `StartInterval` needed.

Script: `~/ClaudeSystem/update.sh`
Plist: `~/Library/LaunchAgents/com.amir.update-skills.plist`

```bash
# Reload after editing:
launchctl unload ~/Library/LaunchAgents/com.amir.update-skills.plist
launchctl load ~/Library/LaunchAgents/com.amir.update-skills.plist

# Check status:
launchctl list | grep update-skills
```

---

## Structure Symmetry — Disabled / Future-Ready Elements

The Skills and Agents systems are intentionally symmetric. Some elements exist in structure but are not yet active. They will activate automatically as you use them — no changes needed.

| Element | Skills | Agents | Status |
|---|---|---|---|
| Update script | `update.sh` (Part 1–2) | `update.sh` (Part 3) | Agents part active, no local agents yet |
| Registry | `Skills/SKILLS-REGISTRY.md` | `Agents/AGENTS-REGISTRY.md` | Both active |
| `mine/` folder | `Skills/mine/` | `Agents/mine/` | Both active |
| `local/` folder | `Skills/local/` | `Agents/local/` | Both present; agents local/ empty |
| `.gitignore` | `Skills/.gitignore` | `Agents/.gitignore` | Both present |
| Project registry | `PROJECT-SKILLS.md` | `PROJECT-AGENTS.md` | Created by add-skill / add-agent |
| Project update script | `update-project-skills.sh` | `update-project-agents.sh` | Created by add-skill / add-agent |
| Codex symlink (skills) | `Skills/codex-skills` → `~/.codex/skills/` | — | Active |
| Codex symlink (agents) | — | `Agents/codex-agents` | **Disabled** — Codex has no sub-agents system yet; placeholder in `.gitignore` |
| `~/.claude/agents` symlink | — | `~/.claude/agents` → `Agents/` | Active |
| find-* meta-skill | `find-skills` (via skills.sh) | `find-agents` (via subagents.cc + GitHub) | Both active |
| Meta-skills | add-skill, remove-skill | add-agent, remove-agent | All active |
