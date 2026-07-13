# Electron Major Upgrade Plan: v27 → v35+ (or Latest)

## Overview
- **Current**: Electron 27.3.11 (EOL: February 2024) — **No security patches since EOL**
- **Target**: Electron 35+ (LTS) or latest 43.x
- **React**: 18.3 → 19 (required for Electron 35+)
- **Vite**: 5.4 → 6+ (compatible with Electron 35+)
- **electron-builder**: 24 → 26+

---

## Risk Assessment

| Area | Risk | Impact |
|------|------|--------|
| **Electron API Breaking Changes** | High | `BrowserWindow` options, `webPreferences`, IPC, `nativeImage`, `shell` |
| **Node.js Version** | High | Electron 27: Node 18 → Electron 35: Node 20 / Electron 43: Node 22 |
| **Vite Plugin Ecosystem** | Medium | `vite-plugin-electron` 0.x → 1.x (complete rewrite) |
| **React 19 Migration** | Medium | Concurrent features, `use` hook, form actions |
| **Native Modules** | Low | No native deps currently, but `electron-rebuild` may be needed |
| **Code Signing/Notarization** | Medium | macOS hardened runtime changes, Windows EV cert requirements |

---

## Phase 1: Preparation & Analysis (Week 1)

### 1.1 Audit Current Electron APIs Used
Search codebase for:
- `require('electron')` / `import { ... } from 'electron'`
- `BrowserWindow` options: `webPreferences`, `nodeIntegration`, `contextIsolation`, `sandbox`
- IPC: `ipcMain`, `ipcRenderer`, `contextBridge`
- `shell`, `nativeImage`, `clipboard`, `dialog`, `menu`
- `app` events: `ready`, `window-all-closed`, `activate`, `certificate-error`
- `webContents` methods: `executeJavaScript`, `send`, `on`
- `session`, `protocol`, `net`
- Preload script patterns

### 1.2 Document Current Versions
```json
{
  "electron": "27.3.11",
  "node": "18.x (bundled)",
  "chrome": "118.x (bundled)",
  "vite": "5.4.21",
  "react": "18.3.1",
  "electron-builder": "24.13.3",
  "vite-plugin-electron": "0.15.6"
}
```

### 1.3 Create Test Matrix
| Platform | Electron 27 | Electron 35 | Electron 43 |
|----------|-------------|-------------|-------------|
| macOS ARM64 | ✅ | ⬜ | ⬜ |
| macOS x64 | ⬜ | ⬜ | ⬜ |
| Windows x64 | ✅ | ⬜ | ⬜ |
| Windows ia32 | ⬜ | ❌ (dropped) | ❌ |

---

## Phase 2: Incremental Upgrade Path (Week 2-3)

### Step 1: Electron 27 → 29 (Intermediate)
- Node 18 → 20
- Last version with `vite-plugin-electron` 0.x compatibility
- Test all IPC, window management, file dialogs

### Step 2: Electron 29 → 32
- V8 updates, new `UtilityProcess` API
- `BrowserWindow` `webPreferences` defaults change
- `contextIsolation: true` enforced

### Step 3: Electron 32 → 35 (LTS Target)
- Node 20
- **React 19 required**
- Vite 6+ required
- `vite-plugin-electron` 1.x migration

---

## Phase 3: Code Migration Tasks

### 3.1 Main Process (`src/main/`)
| File | Changes Needed |
|------|----------------|
| `main.ts` | Update `BrowserWindow` options, `webPreferences` defaults |
| `preload.ts` | Verify `contextBridge` API, `ipcRenderer` exposure |
| `updater.ts` | Check `electron-updater` 6.x compatibility |
| `vite.config.ts` | Migrate to `vite-plugin-electron` 1.x config |

**Key Breaking Changes to Address:**
- `webPreferences.nodeIntegration` → default `false`
- `webPreferences.contextIsolation` → default `true` (enforced)
- `webPreferences.sandbox` → default `true`
- `BrowserWindow` `webPreferences.preload` path resolution
- `app.enableSandbox()` may be needed
- `protocol.registerSchemesAsPrivileged` → `protocol.handle`
- `net` module → `fetch` API preferred

### 3.2 Preload Script (`src/main/preload.ts`)
- Verify all exposed APIs work with `contextIsolation: true`
- Remove any `nodeIntegration: true` dependencies
- Ensure `ipcRenderer.invoke` / `on` / `send` wrappers work

### 3.3 Renderer Process (`src/renderer/`)
| Area | Changes |
|------|---------|
| `window.updater` | Verify `electron-updater` 6.8+ types |
| `AuthenticatedImage` | Check `fetch` / `blob` handling |
| File drag-drop | `webContents` file path handling |
| Native `fs` / `path` | Must go through IPC (no Node in renderer) |

### 3.4 Package.json Updates
```json
{
  "dependencies": {
    "electron": "^35.0.0",
    "electron-builder": "^26.0.0",
    "electron-updater": "^6.8.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite-plugin-electron": "^1.0.0",
    "vite-plugin-electron-renderer": "^1.0.0",
    "typescript": "^5.5.0",
    "electron": "^35.0.0"
  }
}
```

---

## Phase 4: Vite Plugin Migration (Critical)

### `vite-plugin-electron` 0.x → 1.x
**Old (0.x):**
```ts
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  plugins: [
    vue(),
    electron([
      { entry: 'electron/main.ts' },
      { entry: 'electron/preload.ts', onstart: () => {} }
    ]),
    renderer()
  ]
});
```

**New (1.x):**
```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pluginElectron, pluginElectronRenderer } from 'vite-plugin-electron';

export default defineConfig({
  plugins: [
    react(),
    pluginElectron({
      main: { entry: 'electron/main.ts' },
      preload: { entry: 'electron/preload.ts' }
    }),
    pluginElectronRenderer()
  ]
});
```

---

## Phase 5: React 19 Migration

### Required Changes
- Update `@types/react` and `@types/react-dom` to v19
- Replace `React.FC` with explicit types
- Update `ref` usage (string refs removed)
- Test `useId`, `useOptimistic`, `useFormStatus` if adopted
- Check `react-markdown`, `react-window`, `@toast-ui/editor` compatibility

### Dependencies to Verify
| Package | React 19 Compatible? | Alternative |
|---------|---------------------|-------------|
| `@toast-ui/editor` | v3.2+ | ✅ |
| `react-window` | v2.2+ | ✅ |
| `react-markdown` | v9+ | ✅ |
| `react-router-dom` | v7+ | ✅ |

---

## Phase 6: electron-builder 26 Config Updates

### Config Changes
- `build.directories.output` → `build.directories.output` (same)
- `build.files` pattern matching changes
- macOS: `hardenedRuntime`, `gatekeeperAssess` defaults
- Windows: NSIS config, `signAndEditExecutable`
- `publish` provider config unchanged

### Check `package.json` build section for:
- `asar: true` (default)
- `compression: "maximum"`
- `extraResources` patterns
- `dmg`, `nsis`, `appx` target configs

---

## Phase 7: Testing Checklist

### Functional Tests
- [ ] App launches without console errors
- [ ] Main window renders, sidebar/list/detail panes work
- [ ] Project/version loading from Redmine API
- [ ] Issue list: grouping, filtering, sorting
- [ ] Issue detail: markdown rendering, attachments, history
- [ ] Issue actions: status, priority, assignee, version updates
- [ ] Create/edit issues (RichEditor)
- [ ] Image lightbox (zoom, drag, keyboard)
- [ ] Settings panel (transparency, auto-update)
- [ ] Auto-update check/download/install flow
- [ ] Deep linking (`redmine://` protocol)
- [ ] Window resize, pane resizers, indicator sync
- [ ] macOS: vibrancy, traffic lights, menu bar
- [ ] Windows: taskbar, context menus

### Security Tests
- [ ] `contextIsolation: true` enforced
- [ ] No Node.js APIs accessible in renderer
- [ ] Preload exposes only intended APIs
- [ ] CSP headers if applicable
- [ ] No `nodeIntegration: true` anywhere

### Performance Tests
- [ ] Large issue list with 500+ items: scroll performance ]
- [ Rapid version switching: no memory leaks ]
- [ Image loading: caching works ]
- [ Background refresh: no UI jank ]

---

## Phase 8: CI/CD Updates

### GitHub Actions (`.github/workflows/release.yml`)
- Update `node-version: '20'` → `'22'` (for Electron 35+)
- Update Electron download URLs if pinned
- Verify `electron-builder` 26 outputs
- Test artifact upload/download

---

## Rollback Plan

1. **Git branch**: `upgrade/electron-35`
2. **Tag**: `pre-electron-upgrade` on main before merge
3. **Rollback**: `git checkout main && git reset --hard pre-electron-upgrade`
4. **Release**: Keep Electron 27 build artifacts for emergency hotfix

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Preparation | 3 days | — |
| 2. Electron 27→29 | 2 days | Phase 1 |
| 3. Electron 29→32 | 3 days | Phase 2 |
| 4. Electron 32→35 + React 19 | 5 days | Phase 3 |
| 5. Vite Plugin Migration | 2 days | Phase 3 |
| 6. electron-builder Config | 1 day | Phase 4 |
| 7. Full Testing | 5 days | All above |
| 8. CI/CD + Release Prep | 2 days | Phase 7 |
| **Total** | **~23 days** | |

---

## Success Criteria

- ✅ All functional tests pass on macOS ARM64 + Windows x64
- ✅ No high/critical npm audit vulnerabilities
- ✅ Build size within 10% of current
- ✅ Startup time < 3s (cold), < 1s (warm)
- ✅ Memory usage < 300MB typical
- ✅ Code signing/notarization succeeds
- ✅ Auto-update works end-to-end

---

## References

- [Electron 28-35 Release Notes](https://www.electronjs.org/blog)
- [Electron 35 Breaking Changes](https://www.electronjs.org/docs/latest/tutorial/breaking-changes)
- [Vite Plugin Electron 1.x Migration](https://github.com/electron-vite/vite-plugin-electron)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/12/05/react-19)
- [electron-builder 26 Changelog](https://github.com/electron-userland/electron-builder/releases)

---

## Notes

- **Do not upgrade to Electron 43 directly** — too many breaking changes at once
- **Target Electron 35 (LTS)** for stability, then consider 38+ later
- **Test on clean VMs** for code signing/notarization
- **Keep `ia32` Windows build** only if user analytics show need (Electron 35+ drops ia32)