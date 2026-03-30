---
name: remove-skill
description: Removes a Claude Code skill cleanly — deletes the folder, removes the registry entry, cleans up .gitignore if it was a cloned repo, and commits the change to GitHub. Trigger this skill when the user asks to remove, uninstall, or delete a skill.
---

# Remove Skill

## Step 1 — Identify the skill

Ask the user which skill they want to remove if not already clear. Then look it up:

- **Global skills**: check `~/ClaudeSystem/Skills/SKILLS-REGISTRY.md`
- **Project skills**: check `<project-root>/.claude/PROJECT-SKILLS.md`

Read the registry row to determine:
- **Skill name** and **folder location**
- **Type** (Git repo, Local file, Plugin, Mine)

If the skill isn't found in either registry, say so and stop.

## Step 2 — Confirm before deleting

Show the user what will be removed:

> *"I'll remove `<skill-name>` (`<folder-path>`). This will delete the folder and remove it from the registry. OK to proceed?"*

Wait for confirmation.

## Step 3 — Remove based on type

### Git repo (cloned from GitHub)
1. Delete the folder:
   ```bash
   rm -rf ~/ClaudeSystem/Skills/<repo-name>
   ```
2. Remove the entry from `~/ClaudeSystem/Skills/.gitignore`

### Local file
1. Delete the folder:
   ```bash
   rm -rf ~/ClaudeSystem/Skills/local/<skill-name>
   ```

### Mine (custom skill)
1. Delete the folder:
   ```bash
   rm -rf ~/ClaudeSystem/Skills/mine/<skill-name>
   ```

### Plugin
1. Uninstall via Claude Code → `⌘+Shift+P` → Manage Plugins → Plugins tab → Uninstall
2. The registry row will be removed in Step 4 — no folder to delete.

### Project skill
Same logic as above, but paths are under `<project-root>/.claude/skills/` and registry is `<project-root>/.claude/PROJECT-SKILLS.md`.

## Step 4 — Remove from registry

Delete the skill's row from the relevant registry file:
- Global: `~/ClaudeSystem/Skills/SKILLS-REGISTRY.md`
- Project: `<project-root>/.claude/PROJECT-SKILLS.md`

## Step 5 — Commit and push (global skills only)

```bash
cd ~/ClaudeSystem/Skills
git add -A
git commit -m "Remove skill: <skill-name>"
git push
```

Confirm to the user: *"`<skill-name>` has been removed and the backup updated."*
