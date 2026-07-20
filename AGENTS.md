# HabitHero Agent Instructions

## Installed Skills and Tools

The user has installed several global skills and MCP/CLI tools. Use them when the task matches their purpose, but do not force them into unrelated work.

### UI/UX and Design

- Use `ui-ux-pro-max` for UI structure, visual design decisions, interaction patterns, accessibility, responsive layout, typography, color, animation, data visualization, or UI quality review.
  - Installed at: `~/.agents/skills/ui-ux-pro-max`
  - Before using it, read its `SKILL.md`.
  - For new pages or larger visual redesigns, prefer its design-system workflow before implementing.
  - Do not persist generated design-system files unless the user asks or the change clearly requires a project design source of truth.

- Use `apple-design` when the user wants Apple-native polish, fluid interfaces, gesture-driven UI, spring motion, interruptible transitions, sheets, translucent materials, depth, refined typography, or reduced-motion behavior.
  - Installed at: `~/.codex/skills/apple-design`
  - Before using it, read its `SKILL.md`.
  - Apply it especially to mobile-like interactions, drag/swipe/sheet UI, and motion polish.

- Use `extract-design-system` when the user wants to reverse-engineer a public website's visual primitives into design tokens or starter assets.
  - Installed at: `~/.agents/skills/extract-design-system`
  - Before using it, read its `SKILL.md`.
  - Ask for the target public URL and whether the user wants extraction only or starter files.
  - Do not overwrite existing app styling, design-system files, or config without explicit confirmation.

### Spec-Driven Development

- GitHub Spec Kit is installed via the `specify` CLI.
  - Use `specify version` to verify the installed CLI.
  - Use Spec Kit when the user asks for specs, product requirements, implementation plans, or spec-driven development.
  - Do not run `specify init` in this repo unless the user explicitly confirms they want `.specify/` project files created.

### Codebase Memory

- `codebase-memory-mcp` is installed and configured as a Codex MCP server.
  - Command: `/Users/studio.vv/.local/bin/codebase-memory-mcp`
  - Use it when the task benefits from codebase-level memory, architecture lookup, recurring project knowledge, or semantic understanding across files.
  - Do not create or refresh indexes if that would write project artifacts unless the user confirms.

### Headroom

- `headroom` is installed and configured as a Codex MCP server.
  - Command: `/Users/studio.vv/.local/bin/headroom mcp serve`
  - Use Headroom retrieval/compression tools when large outputs or long context would benefit from compressed-cache-retrieve behavior.
  - The proxy is not expected to be running by default. Do not route all model traffic through Headroom unless the user asks to use `headroom wrap codex` or start `headroom proxy`.

## Default Behavior

- For ordinary coding tasks, inspect the repo first and use the existing project patterns.
- For visual/frontend work, prefer `ui-ux-pro-max` as the general design skill and add `apple-design` only when the interaction or requested style calls for it.
- For design-token extraction from an external site, use `extract-design-system` instead of hand-copying colors or typography.
- For feature planning/specification work, consider Spec Kit, but ask before initializing project files.
- Keep project changes scoped and explain any generated files before asking the user to confirm.
