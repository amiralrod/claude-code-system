---
name: find-agents
description: Searches available sources to discover Claude Code agents for a given task or role. Use this skill when the user asks to find, search, or discover an agent — even if they don't use the word "agent" and instead describe a role or capability they want (e.g. "is there an agent that acts as a code reviewer?"). Also triggers before using add-agent if no specific source has been provided.
---

# Find Agents

The agent ecosystem is newer and more fragmented than skills. Search all available sources and be transparent about what you find and what's missing.

## Sources to search

### 1. subagents.cc
The primary community directory for Claude Code agents. Try:
- `https://subagents.cc/` — browse by category
- Search for the user's task/role

Report: name, description, rating, install count if available.

### 2. VoltAgent/awesome-claude-code-subagents
A GitHub collection of 127+ agents in 10 categories:
- `https://github.com/VoltAgent/awesome-claude-code-subagents`

Scan the README for agents matching the user's need.

### 3. hesreallyhim/a-list-of-claude-code-agents
Community-maintained list, accepts PRs. Less curated but broader:
- `https://github.com/hesreallyhim/a-list-of-claude-code-agents`

## What to report

For each relevant agent found:
- Name and description
- Source URL
- Rating / install count (if available)
- Any security flags worth noting (bypassPermissions, mcpServers, unusual tools)

## If nothing relevant is found

Say so clearly, then offer:
> *"I didn't find an existing agent for this. Would you like to create one? I can use the `add-agent` skill to help you author it."*

## Note on ecosystem maturity

The agent discovery ecosystem is still early — there is no single authoritative platform like skills.sh is for skills. If a dedicated find-agents platform emerges, this skill will be updated to use it. For now, these three sources cover most of what's publicly available.

## Next step

Once the user selects an agent, hand off to the `add-agent` skill:
> *"Found it. Want me to install it? I'll run a security review first."*
