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
1. Delete the folder (this also removes `.skill-source`, `.skill-source-folder`, and any downloaded files):
   ```bash
   rm -rf ~/ClaudeSystem/Skills/local/<skill-name>
   ```

### Mine (custom skill)
1. Delete the folder:
   ```bash
   rm -rf ~/ClaudeSystem/Skills/mine/<skill-name>
   ```

### Shared skill (two-Mac setup only: in `~/home-work-shared-skills/skills/`)
Skip this section if that folder does not exist.
Removing it here removes it from **both** Macs. Say so when confirming in Step 2.
1. Delete the folder and the pointer: `rm -rf ~/home-work-shared-skills/skills/<skill-name>` and
   `rm ~/.claude/skills/<skill-name>`
2. Remove its row from `~/home-work-shared-skills/SHARED-REGISTRY.md`.
3. Run `bash ~/home-work-shared-skills/system/sync.sh`. The other Mac's daily update then finds a
   broken pointer for it; tell the user to delete `~/.claude/skills/<skill-name>` there too.

### Third-party skill listed in `~/home-work-shared-skills/THIRD-PARTY.md`
While it is on that list, this Mac will keep reporting it as "waiting to be installed". So remove
its row and recipe from THIRD-PARTY.md and sync, and tell the user to run remove-skill for it on the
other Mac too if they want it gone there as well.

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

The git repo may be bigger than the skills folder (on the home Mac it is all of `~/Claude Code`),
so a bare `git add -A` would sweep in unrelated work in progress. Stage only the skills folder:

```bash
cd ~/ClaudeSystem/Skills
git add -A -- .
git diff --cached --stat        # confirm ONLY skills files are staged
git commit -m "Remove skill: <skill-name>"
git push
```

If `git diff --cached --stat` lists anything outside the skills folder, it was already staged before
you started. Unstage it (`git restore --staged <path>`) rather than committing someone else's work.

Confirm to the user: *"`<skill-name>` has been removed and the backup updated."*