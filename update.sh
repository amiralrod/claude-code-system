#!/bin/bash
# Auto-updates all skills and agents in your ClaudeSystem installation.
# Runs daily via launchd (Mac) or cron (Linux) — set up by setup.sh.
# Run manually: bash ~/ClaudeSystem/update.sh
#
# What it does:
#   1. Git repos    — git pull on skill repos, notify on new skill folders
#   2. Local skills — fetch from .skill-source URL, show diff if changed
#   3. Local agents — fetch from .<agent>.source URL, show diff if changed
#   4. Plugins      — sync installed Claude Code plugins to SKILLS-REGISTRY.md
#   5. Backup       — commit + push to your GitHub backup repo (if configured)

# ─── Configuration ────────────────────────────────────────────────────────────

# Install directory — auto-detected from this script's location
CLAUDE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$CLAUDE_DIR/Skills"
AGENTS_DIR="$CLAUDE_DIR/Agents"
REGISTRY="$SKILLS_DIR/SKILLS-REGISTRY.md"
PLUGINS_DIR="$HOME/.claude/plugins/cache"

# Optional: set your GitHub backup repo URL to enable automatic backups.
# Example: BACKUP_REPO_URL="https://github.com/yourusername/my-claude-system.git"
BACKUP_REPO_URL=""

# ─── Notifications ────────────────────────────────────────────────────────────

notify() {
    if [[ "$(uname -s)" == "Darwin" ]]; then
        osascript -e "display notification \"$1\" with title \"Claude Code\""
    else
        echo "[Claude System] $1"
    fi
}

# ─── Part 1: Update git repos (up to 2 levels deep) ──────────────────────────

for repo_dir in "$SKILLS_DIR"/*/ "$SKILLS_DIR"/*/*/; do
    [ -d "$repo_dir/.git" ] || continue

    repo_name=$(basename "$repo_dir")

    before=$(find "$repo_dir" -maxdepth 1 -mindepth 1 -type d ! -name ".*" ! -name "images" | sort)
    git -C "$repo_dir" pull --quiet
    after=$(find "$repo_dir" -maxdepth 1 -mindepth 1 -type d ! -name ".*" ! -name "images" | sort)

    new_skills=$(comm -13 <(echo "$before") <(echo "$after") | xargs -I{} basename {})
    if [ -n "$new_skills" ]; then
        skill_list=$(echo "$new_skills" | tr '\n' ', ' | sed 's/,$//')
        notify "New skills in $repo_name: $skill_list"
    fi
done

# ─── Part 2: Update local skills with .skill-source URLs ─────────────────────

for skill_dir in "$SKILLS_DIR"/local/*/; do
    source_file="$skill_dir/.skill-source"
    skill_md="$skill_dir/SKILL.md"

    [ -f "$source_file" ] && [ -f "$skill_md" ] || continue

    source_url=$(tr -d '[:space:]' < "$source_file")
    skill_name=$(basename "$skill_dir")

    remote_content=$(curl -sf "$source_url")
    [ $? -ne 0 ] || [ -z "$remote_content" ] && continue

    current_content=$(cat "$skill_md")
    [ "$remote_content" = "$current_content" ] && continue

    diff_summary=$(diff <(echo "$current_content") <(echo "$remote_content") \
        | grep '^[<>]' \
        | head -5 \
        | sed 's/^< /removed: /; s/^> /added: /' \
        | tr '\n' ' ')

    diff_file="$skill_dir/.last-update-diff"
    diff <(echo "$current_content") <(echo "$remote_content") > "$diff_file"
    printf '%s' "$remote_content" > "$skill_md"

    notify "Updated skill $skill_name — see .last-update-diff for changes. Preview: $diff_summary"
done

# ─── Part 3: Update local agents with .<agent>.source URLs ───────────────────

for source_file in "$AGENTS_DIR"/local/.*.source; do
    [ -f "$source_file" ] || continue

    agent_name=$(basename "$source_file" .source | sed 's/^\.//')
    agent_md="$AGENTS_DIR/local/$agent_name.md"

    [ -f "$agent_md" ] || continue

    source_url=$(tr -d '[:space:]' < "$source_file")
    remote_content=$(curl -sf "$source_url")
    [ $? -ne 0 ] || [ -z "$remote_content" ] && continue

    current_content=$(cat "$agent_md")
    [ "$remote_content" = "$current_content" ] && continue

    diff_summary=$(diff <(echo "$current_content") <(echo "$remote_content") \
        | grep '^[<>]' \
        | head -5 \
        | sed 's/^< /removed: /; s/^> /added: /' \
        | tr '\n' ' ')

    diff_file="$AGENTS_DIR/local/.$agent_name.last-update-diff"
    diff <(echo "$current_content") <(echo "$remote_content") > "$diff_file"
    printf '%s' "$remote_content" > "$agent_md"

    notify "Updated agent $agent_name — see .$agent_name.last-update-diff for changes. Preview: $diff_summary"
done

# ─── Part 4: Sync installed Claude Code plugins to SKILLS-REGISTRY.md ────────

if [ -d "$PLUGINS_DIR" ]; then
    for marketplace_dir in "$PLUGINS_DIR"/*/; do
        marketplace=$(basename "$marketplace_dir")
        for plugin_dir in "$marketplace_dir"*/; do
            [ -d "$plugin_dir" ] || continue
            plugin_name=$(basename "$plugin_dir")

            if ! grep -q "| $plugin_name |" "$REGISTRY"; then
                new_row="| $plugin_name | Auto-detected plugin — add description | — | Plugin | $marketplace |"
                sed -i '' "/^| find-skills /a\\
$new_row
" "$REGISTRY"
                notify "New plugin detected in registry: $plugin_name"
            fi
        done
    done

    while IFS= read -r line; do
        plugin=$(echo "$line" | awk -F'|' '{print $2}' | tr -d ' ')
        if [ -n "$plugin" ] && ! [ -d "$PLUGINS_DIR"/*/"$plugin" ] 2>/dev/null; then
            if echo "$line" | grep -q "| Plugin |"; then
                notify "Plugin '$plugin' is in registry but no longer installed — consider removing it"
            fi
        fi
    done < <(grep "| Plugin |" "$REGISTRY")
fi

# ─── Part 5: Backup to GitHub ─────────────────────────────────────────────────
# Commits any changes and pushes to your GitHub backup repo.
# Set BACKUP_REPO_URL at the top of this file to enable.

if [ -n "$BACKUP_REPO_URL" ] && [ -d "$CLAUDE_DIR/.git" ]; then
    cd "$CLAUDE_DIR"
    # Set remote if not already configured
    if ! git remote get-url origin &>/dev/null; then
        git remote add origin "$BACKUP_REPO_URL"
    fi
    if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        git add -A
        git commit -m "Auto-backup: $(date '+%Y-%m-%d')" --quiet
        git push --quiet
    fi
fi
