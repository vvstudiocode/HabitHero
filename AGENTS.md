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

- **CSS 修改前必讀**：請先閱讀 [`CSS_RULES.md`](./CSS_RULES.md)。它是 HabitHero 的 CSS 分層、selector owner、responsive、狀態與驗證流程的唯一維護規則；禁止直接追加覆蓋式 CSS 來修問題。
- For ordinary coding tasks, inspect the repo first and use the existing project patterns.
- For visual/frontend work, prefer `ui-ux-pro-max` as the general design skill and add `apple-design` only when the interaction or requested style calls for it.
- For design-token extraction from an external site, use `extract-design-system` instead of hand-copying colors or typography.
- For feature planning/specification work, consider Spec Kit, but ask before initializing project files.
- Do not start a local preview/dev server unless the user explicitly asks for it.
- Keep project changes scoped and explain any generated files before asking the user to confirm.

## iOS Build and Supabase Configuration

- The iOS app embeds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` into the bundled web assets at build time. A valid Web/Vercel deployment does not guarantee that the local iOS bundle has valid credentials.
- Before testing or distributing an iOS build, verify that the local publishable key is the current Vercel Production key for project `habit-hero`; never use a placeholder/demo JWT or a service-role key in the app.
- Validate the key against `https://<project-ref>.supabase.co/auth/v1/settings` with the `apikey` header. A response containing `UNAUTHORIZED_INVALID_API_KEY` or `Invalid API key` means the build must not proceed.
- After changing the key, always run `npm run cap:sync` before opening, archiving, or uploading with Xcode; old archives and installed apps retain the previous embedded key.
- If iOS login and registration both return HTTP 401 while Web works, first inspect the embedded Supabase URL/key and request response. This is an Auth Gateway configuration problem, not a SQL migration problem. Check `push_devices` SQL/RLS only after Auth succeeds.
- For a new App Store Connect upload, increment `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`; do not reuse an already-uploaded build number.
