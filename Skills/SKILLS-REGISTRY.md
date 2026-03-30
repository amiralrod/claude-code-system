# Claude Code Skills — Global Registry

This file is the authoritative registry of all Claude Code skills installed at `~/ClaudeSystem/Skills/`. It is loaded globally across all projects via `~/.claude/CLAUDE.md`.

**To see what skills you have:** Ask Claude "what skills do I have?" or "do I have a skill for X?" — Claude reads this file.

---

## Folder Structure

```
~/ClaudeSystem/
  Skills/
    local/                ← third-party skills (auto-update via .skill-source URLs)
      find-skills/        ← discover new skills to install
      add-skill/          ← install skills with security review
      remove-skill/       ← remove skills cleanly
      add-agent/          ← install agents with security review
      remove-agent/       ← remove agents cleanly
      find-agents/        ← discover agents from subagents.cc and GitHub
    mine/                 ← skills YOU build yourself (never auto-updated from outside)
    SKILLS-REGISTRY.md   ← this file
  Agents/                 ← agents registry and files
  update.sh               ← auto-update script (runs on a schedule)
  skills-and-agents.md    ← full guide
```

**Folder naming convention:** Folders are named after the skill or its source, not its topic. Topic and description live in this registry.

> This is the **global** registry. Project-specific skills are tracked in `<project-root>/.claude/PROJECT-SKILLS.md` within each project.

---

## Installed Skills

| Skill | Description | Topic | Type | Source |
|---|---|---|---|---|
| find-skills | Searches the skills.sh ecosystem to discover and recommend installable skills for any task | Skills Discovery | Local file (source URL tracked) | raw.githubusercontent.com/vercel-labs/skills/main/skills/find-skills/SKILL.md |
| add-skill | Guides the full process of adding a third-party skill: security review, conflict check, folder placement, and registry update | Skills Management | Local file (source URL tracked) | raw.githubusercontent.com/amiralrod/claude-code-system/main/Skills/local/add-skill/SKILL.md |
| remove-skill | Removes a skill cleanly: deletes the folder, cleans up .gitignore, removes the registry row, and commits to GitHub | Skills Management | Local file (source URL tracked) | raw.githubusercontent.com/amiralrod/claude-code-system/main/Skills/local/remove-skill/SKILL.md |
| add-agent | Installs a Claude Code agent with strict security review (checks bypassPermissions, mcpServers, tool access), conflict check, and registry update | Agents Management | Local file (source URL tracked) | raw.githubusercontent.com/amiralrod/claude-code-system/main/Skills/local/add-agent/SKILL.md |
| remove-agent | Removes an agent cleanly: deletes the file, removes the registry row, and commits to GitHub | Agents Management | Local file (source URL tracked) | raw.githubusercontent.com/amiralrod/claude-code-system/main/Skills/local/remove-agent/SKILL.md |
| find-agents | Searches subagents.cc and GitHub collections to discover and recommend installable agents for any role | Agents Discovery | Local file (source URL tracked) | raw.githubusercontent.com/amiralrod/claude-code-system/main/Skills/local/find-agents/SKILL.md |

---

## Type Reference

| Type | Meaning | Auto-updates? |
|---|---|---|
| Git collection | Full repo with many skills inside | Yes — `git pull` |
| Git single skill | Repo containing one skill | Yes — `git pull` |
| Local file (source URL tracked) | SKILL.md saved locally with `.skill-source` file | Yes — fetch & compare |
| Mine | Skills you created | Never from outside |
| Plugin | Installed via Claude Code's Manage Plugins UI | Managed by Claude Code |

---

## Auto-Update & Backup

`update.sh` runs daily at **7:33 AM** via launchd (Mac) or cron (Linux). Logs to `/tmp/claude-system-update.log`.

Each run:
1. **Git repos** — `git pull` on all repos up to 2 levels deep, notifies on new skill folders
2. **Local skills** — fetches from `.skill-source` URL, shows diff if changed
3. **Local agents** — same pattern for agent files
4. **Plugins** — scans `~/.claude/plugins/cache/` and syncs plugin registry entries
5. **Backup** — commits any changes and pushes to your GitHub backup repo (if configured)

To run manually:
```bash
bash ~/ClaudeSystem/update.sh
```

## Restore from Backup

See `~/ClaudeSystem/skills-and-agents.md` → Backup & Restore section for full instructions.
