# Claude Code System

A skills and agents management system for Claude Code — install once, works across every project.

## What it is

Claude Code can be extended with **skills** (specialized knowledge and workflows Claude reads as context) and **agents** (sub-agents with their own roles and system prompts). This system gives you:

- A structured folder to install, organize, and update skills and agents globally
- Meta-skills that manage themselves: install new skills, remove old ones, find what's available
- Daily auto-updates for any skill that has a source URL
- Optional GitHub backup of your entire setup

## What you get out of the box

| Name | Type | What it does |
|---|---|---|
| `add-skill` | Meta-skill | Installs a skill: security review, conflict check, folder placement, registry update |
| `remove-skill` | Meta-skill | Removes a skill cleanly with registry cleanup |
| `add-agent` | Meta-skill | Installs an agent with strict security review (bypassPermissions, mcpServers, tools) |
| `remove-agent` | Meta-skill | Removes an agent cleanly |
| `find-agents` | Meta-skill | Searches subagents.cc and GitHub to discover agents for any role |
| `find-skills` | Local skill | Searches the skills.sh ecosystem to discover skills for any task |

## Install

```bash
git clone https://github.com/amiralrod/claude-code-system ~/ClaudeSystem
bash ~/ClaudeSystem/setup.sh
```

Then restart Claude Code.

That's it. Ask Claude "what skills do I have?" to confirm everything loaded.

## How it works

```
~/ClaudeSystem/
  Skills/
    mine/          ← skills you create yourself
    local/         ← third-party skills (auto-update via source URL)
      find-skills/
    SKILLS-REGISTRY.md
  Agents/
    mine/          ← agents you create
    local/         ← downloaded agents
    AGENTS-REGISTRY.md
  update.sh        ← runs daily, updates all skills and agents
  setup.sh         ← one-time setup (you already ran this)
  skills-and-agents.md  ← full guide
```

**Skills** load automatically when the context matches — Claude reads the registry and activates the right skill for the task. **Agents** are called by name (`@agent-name`) or auto-delegated.

Full documentation: [skills-and-agents.md](skills-and-agents.md)

## Adding more skills

Once installed, just ask Claude:

> *"Find me a skill for [task]"* — uses `find-skills` to search the ecosystem
> *"Add this skill: [GitHub URL or file]"* — uses `add-skill` with security review
> *"Find me an agent for [role]"* — uses `find-agents` to search subagents.cc and GitHub

## Backup your setup

To back up your customizations to your own GitHub repo, set `BACKUP_REPO_URL` in `update.sh`. The daily update will then commit and push automatically.

## Auto-updates

`setup.sh` configures a daily job (launchd on Mac, cron on Linux) that:
1. Pulls updates for any git-cloned skill repos
2. Fetches updated SKILL.md files from `.skill-source` URLs
3. Syncs your plugin registry
4. Pushes your backup (if configured)

Logs go to `/tmp/claude-system-update.log`.
