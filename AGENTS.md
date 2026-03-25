# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

This is a **VS Code extension** (Cursor Orchestrator) that runs inside Cursor IDE. It has two build targets:

1. **Extension host** (`cursor-orchestrator/`) — TypeScript bundled with esbuild, externalizes `vscode`.
2. **Webview** (`cursor-orchestrator/webview/`) — React 18 app built with Vite into `cursor-orchestrator/dist/webview/`.

### Build commands

From `cursor-orchestrator/`:

| Command | Purpose |
|---------|---------|
| `npm run build` | Bundle extension host via esbuild → `dist/extension.js` |
| `npm run build:webview` | Build React webview via Vite → `dist/webview/` |
| `npm run lint` | ESLint on `src/` and `extension.ts` |
| `npm run package` | Package as `.vsix` using `@vscode/vsce` |

### Important caveats

- **Two separate `npm install` locations**: `cursor-orchestrator/` and `cursor-orchestrator/webview/` each have their own `package.json` and `node_modules/`. Both must be installed.
- **No lock files**: The repo does not commit `package-lock.json` files, so `npm install` will resolve latest compatible versions each time.
- **No automated test suite**: There are no unit/integration tests configured. Validation is done via build + lint + packaging.
- **End-to-end testing requires Cursor IDE**: The extension uses `vscode.lm` API and VS Code extension APIs. It cannot be fully tested outside of a VS Code/Cursor environment. In Cloud Agent VMs, verify correctness via build, lint, and `.vsix` packaging.
- **ESLint ignores the webview directory**: The `.eslintrc.json` has `"ignorePatterns": ["dist", "node_modules", "webview"]`, so lint only covers the extension host code.
