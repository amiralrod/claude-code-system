#!/bin/bash
# Claude Code System — One-time setup script
# Run this once after cloning the repo.
# Usage: bash setup.sh

set -e

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
OS="$(uname -s)"

echo ""
echo "Claude Code System — Setup"
echo "Install directory: $INSTALL_DIR"
echo ""

# ─── 1. Create ~/.claude if it doesn't exist ──────────────────────────────────

mkdir -p "$CLAUDE_DIR"

# ─── 2. Create ~/.claude/agents symlink ───────────────────────────────────────

AGENTS_TARGET="$INSTALL_DIR/Agents"
AGENTS_LINK="$CLAUDE_DIR/agents"

if [ -L "$AGENTS_LINK" ]; then
    existing=$(readlink "$AGENTS_LINK")
    if [ "$existing" = "$AGENTS_TARGET" ]; then
        echo "✓ Symlink ~/.claude/agents already correct — skipping"
    else
        echo "  Updating symlink ~/.claude/agents ($existing → $AGENTS_TARGET)"
        rm "$AGENTS_LINK"
        ln -s "$AGENTS_TARGET" "$AGENTS_LINK"
        echo "✓ Symlink updated"
    fi
elif [ -e "$AGENTS_LINK" ]; then
    echo "  Warning: ~/.claude/agents exists but is not a symlink — skipping"
    echo "  To fix manually: rm ~/.claude/agents && ln -s \"$AGENTS_TARGET\" ~/.claude/agents"
else
    ln -s "$AGENTS_TARGET" "$AGENTS_LINK"
    echo "✓ Created symlink ~/.claude/agents → $AGENTS_TARGET"
fi

# ─── 3. Create ~/.claude/skills/ symlinks ─────────────────────────────────────
# Claude Code discovers skills by scanning ~/.claude/skills/.
# Without symlinks there, skills won't appear in "Available Skills" in any project.

SKILLS_CLAUDE_DIR="$CLAUDE_DIR/skills"
mkdir -p "$SKILLS_CLAUDE_DIR"

# mine/ and local/ skills
for skill_dir in "$INSTALL_DIR/Skills/mine"/*/ "$INSTALL_DIR/Skills/local"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    target="$SKILLS_CLAUDE_DIR/$skill_name"
    if [ -L "$target" ]; then
        echo "✓ Symlink ~/.claude/skills/$skill_name already exists — skipping"
    elif [ -e "$target" ]; then
        echo "  Warning: ~/.claude/skills/$skill_name exists but is not a symlink — skipping"
    else
        ln -s "$skill_dir" "$target"
        echo "✓ Created symlink ~/.claude/skills/$skill_name"
    fi
done

# Top-level git repo skills (awesome-pm-skills, notebooklm-py, etc.)
for repo_dir in "$INSTALL_DIR/Skills"/*/; do
    [ -d "${repo_dir}.git" ] || continue
    repo_name=$(basename "$repo_dir")
    target="$SKILLS_CLAUDE_DIR/$repo_name"
    if [ -L "$target" ]; then
        echo "✓ Symlink ~/.claude/skills/$repo_name already exists — skipping"
    elif [ -e "$target" ]; then
        echo "  Warning: ~/.claude/skills/$repo_name exists but is not a symlink — skipping"
    else
        ln -s "$repo_dir" "$target"
        echo "✓ Created symlink ~/.claude/skills/$repo_name"
    fi
done

echo ""

# ─── 4. Patch ~/.claude/CLAUDE.md ─────────────────────────────────────────────

CLAUDE_MD="$CLAUDE_DIR/CLAUDE.md"

if grep -q "Skills & Agents" "$CLAUDE_MD" 2>/dev/null; then
    echo "✓ CLAUDE.md already has Skills & Agents section — skipping"
else
    cat >> "$CLAUDE_MD" << EOF

## Skills & Agents
I have skills at \`$INSTALL_DIR/Skills/\` and agents at \`$INSTALL_DIR/Agents/\` (symlinked to \`~/.claude/agents/\`). Both are global and available in every project.

- Before starting any non-trivial task, check if a relevant skill or agent exists. If one does, use it.
- Auto-activate relevant skills and agents based on what I'm working on
- **Skills registry:** \`$INSTALL_DIR/Skills/SKILLS-REGISTRY.md\`
- **Agents registry:** \`$INSTALL_DIR/Agents/AGENTS-REGISTRY.md\`
- **Full guide:** \`$INSTALL_DIR/skills-and-agents.md\`
- To add a skill: \`add-skill\` (\`$INSTALL_DIR/Skills/mine/add-skill/SKILL.md\`)
- To remove a skill: \`remove-skill\` (\`$INSTALL_DIR/Skills/mine/remove-skill/SKILL.md\`)
- To add an agent: \`add-agent\` (\`$INSTALL_DIR/Skills/mine/add-agent/SKILL.md\`)
- To remove an agent: \`remove-agent\` (\`$INSTALL_DIR/Skills/mine/remove-agent/SKILL.md\`)
EOF
    echo "✓ Added Skills & Agents section to ~/.claude/CLAUDE.md"
fi

# ─── 5. Make update.sh executable ─────────────────────────────────────────────

chmod +x "$INSTALL_DIR/update.sh"
echo "✓ Made update.sh executable"

# ─── 6. OS-specific: auto-update scheduler ────────────────────────────────────

if [ "$OS" = "Darwin" ]; then
    # macOS — install launchd job (runs daily at 7:33 AM, survives sleep/wake)
    PLIST_LABEL="com.claudesystem.update"
    PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

    cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_LABEL</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$INSTALL_DIR/update.sh</string>
    </array>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>7</integer>
        <key>Minute</key>
        <integer>33</integer>
    </dict>

    <key>ProcessType</key>
    <string>Background</string>

    <key>LowPriorityIO</key>
    <true/>

    <key>RunAtLoad</key>
    <false/>

    <key>StandardOutPath</key>
    <string>/tmp/claude-system-update.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/claude-system-update.log</string>
</dict>
</plist>
PLIST

    launchctl load "$PLIST_PATH" 2>/dev/null || true
    echo "✓ Installed launchd job — update.sh runs daily at 7:33 AM"
    echo "  Log: /tmp/claude-system-update.log"

elif [ "$OS" = "Linux" ]; then
    echo ""
    echo "→ To enable daily auto-updates on Linux, add this line to your crontab:"
    echo "  Run: crontab -e"
    echo "  Add: 33 7 * * * bash \"$INSTALL_DIR/update.sh\" >> /tmp/claude-system-update.log 2>&1"

else
    echo ""
    echo "→ Windows detected."
    echo "  Auto-updates require Git Bash or WSL. To set up manually:"
    echo "  Use Task Scheduler to run: bash \"$INSTALL_DIR/update.sh\""
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "Setup complete."
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code to pick up the new CLAUDE.md settings"
echo "  2. Ask Claude: 'what skills do I have?' to confirm everything loaded"
echo "  3. Optional: set BACKUP_REPO_URL in update.sh to enable GitHub backup"
echo ""
