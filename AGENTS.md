# Redmine-Desktop Development Log (AGENTS.md)

This project is a cross-platform Redmine client designed to provide a smooth, beautiful, and efficient task management experience. The project was migrated from a legacy Swift/SwiftUI version to the current Electron + React + Vite architecture.

## Tech Stack
- **Core**: Electron, React (Functional Components + Hooks)
- **State Management**: Custom `useAppViewModel` (Reactive State Management)
- **Build Tool**: Vite, TypeScript
- **Packaging**: electron-builder
- **Styling**: Vanilla CSS (Focused on Performance & GPU Acceleration)

## Development Milestones & History

### v1.0.0 - v1.0.3: Foundation & Performance Baseline
- **Core Logic Migration**: Complete migration from native Swift logic to TypeScript-driven service layer.
- **Performance Optimizations**:
    - Introduced `content-visibility: auto` to optimize long-list rendering.
    - Used `transform` instead of `top/left` for GPU-accelerated selection indicator animations.
    - Implemented `AuthenticatedImage` caching mechanism to reduce redundant API requests.
- **UI Enhancements**:
    - Implemented smooth sliding indicators for sidebar project/version lists.
    - Added adjustable-width responsive panels (Sidebar & Issue List Ratio).
    - Added top title bar drag region.

### v1.0.4: Grouping & Filter Enhancements
- **Issue Grouping**: Added "Group by Status" and "Group by Assignee" toggle functionality.
- **Dynamic Filters**: Filter options adapt dynamically based on grouping mode (e.g., show assignee filter when grouping by status).
- **Sync Indicator**: Fixed bug where selection indicator position didn't update on window resize.

### v1.0.5 - v1.0.7: Visual Effects (Transparency & Vibrancy)
- **macOS Vibrancy**: Introduced native frosted glass effect (`vibrancy: 'under-window'`).
- **Glassmorphism UI**: Optimized `issue-item` backgrounds in transparent mode for a more translucent Glassmorphism effect.
- **Light Mode Optimization**: Deep-tuned transparency effects for light mode, reducing gray haze and improving clarity.

### v1.0.8 (Current): Stability & Theme Adaptation
- **Strategy Change**: Due to limitations of frosted glass in light mode, decided to **automatically disable transparency in Light Mode**, maintaining a stable, consistent solid background.
- **Engineering**: Improved `.gitignore` to filter unnecessary binaries and build artifacts.

### v1.0.10: Auto-Update Feature
- **Core Feature**: Auto-update system based on GitHub Releases, implemented with `electron-updater`.
- **Update Check**: Automatic update check 3 seconds after app launch (production only).
- **Update UI**: Added `UpdaterModal` component with a polished update interface:
    - Displays current and new version info
    - Download progress bar (real-time speed and progress)
    - Supports manual check, download, and install
    - One-click open GitHub Releases page
- **Integration Entry**: Added "Check for Updates" button in Settings panel.
- **Logging**: Uses `electron-log` to record update process.

### v1.0.11: Architecture Improvements & Offline Support (Current Development)

#### Architecture Refactoring (attempted, then reverted -- see note)
- **ViewModel Split (reverted)**: `useAppViewModel.ts` was decomposed into `useSettings.ts`,
  `useProjects.ts`, `useIssues.ts`, `useSearch.ts`, `useFilteredIssues.ts`. A later PR
  (lazy `versionViewData` computation) was built against the pre-split file, and merging
  it silently replaced the composed-hooks version with a monolithic one again -- the split
  hook files ended up orphaned (unimported, but still on disk with passing tests) until
  discovered and cleaned up. **`useAppViewModel.ts` is monolithic today** (~1450 lines);
  the split files no longer exist. See "Key Technical Details" #2 below.
- **Component Split (reverted)**: `App.tsx` was similarly split into `TabbedIssueList.tsx`,
  `IssueListContent.tsx`, `NoteEditor.tsx`, `RemoteSearchResults.tsx`, `IssueItem.tsx` --
  same fate, same cause. **`App.tsx` defines these as local components today**, not
  separate files.
- **Still separate files** (survived, not touched by the revert): `ErrorBoundary.tsx`,
  `Toast.tsx`, `useKeyboardShortcuts.ts`, `constants/status.ts`.
- If you're an agent reading this: before assuming a hook/component lives in its own file
  because an older PR or doc says so, grep for it. This codebase has silently reverted
  a "split into focused files" refactor at least once.

#### Performance Optimizations
- **IndexedDB Cache**: Implemented Dexie.js-based caching for issues (`IssueCache.ts`)
    - Auto-migration from localStorage
    - Cache invalidation on updates
    - Scoped per Redmine server (PR #19) -- switching `redmineURL` gets its own
      database instead of sharing one cache across accounts
    - 14 tests for cache operations
- **Lazy versionViewData**: Replaced eager computation with on-demand loading
    - Computes only when tab/view changes
    - Caches results by key
- **Virtualization**: Added `content-visibility: auto` for long lists

#### Offline Support
- **OfflineQueue.ts**: IndexedDB-backed mutation queue with:
    - Exponential backoff retry: `1000ms * 2^retryCount`, capped at 30s (so the
      first retry after a failure waits 2s, then 4s, 8s, ...). `getRetryDelay()`
      existed unused until PR #16 actually wired it into `useOffline.ts`'s retry
      loop -- retries fired immediately with no pacing before that.
    - Max retry limit (5 attempts)
    - Automatic queue processing when online
    - 14 tests for queue operations
- **useOffline.ts**: Hook for online/offline detection
    - Window event listeners for online/offline
    - Auto-process queue on reconnect
    - 7 tests for offline behavior
- **OfflineBanner.tsx**: Visual indicator of offline status
    - Shows pending mutation count
    - Manual queue retry button
    - 6 tests for banner display

#### Conflict Resolution
- **ConflictResolver.ts**: Server-side conflict detection
    - Compares expected vs actual server state
    - Per-field conflict detection
    - Auto-merge for non-conflicting changes
    - 12 tests for conflict scenarios
- **ConflictDialog.tsx**: UI for conflict resolution
    - Shows local vs server values
    - Options: Use Local, Use Server, Auto-Merge
    - Accessible modal (role/aria-modal/focus-trap/Escape -- added in PR #15,
      was a bare `<div>` with no ARIA semantics before that)
    - 5 tests for dialog behavior
- **Integration**: Conflicts detected during queue processing

#### Security Improvements
- **Safe Storage**: API key encryption using Electron's `safeStorage`
- **Scoped Certificate Bypass**: Removed global `ignore-certificate-errors`
- **Type Safety**: Replaced `any` types with proper interfaces
    - `MutationBody`, `UpdateIssueBody`, `CreateIssueBody`
    - Proper error handling with `catch (e: unknown)`

#### Testing
- **Vitest Setup**: Configured Vitest with jsdom
- **Test Files**: 11 test suites, 128 tests total (current as of PR #19; re-run
  `npx vitest run --dir src/renderer` rather than trusting this count long-term)
    - `constants/status.test.ts` - 29 tests
    - `hooks/useKeyboardShortcuts.test.ts` - 14 tests
    - `hooks/useAppViewModel.test.ts` - 13 tests (covers what used to be
      `useSettings`/`useFilteredIssues`/`useIssues`-level behavior -- see the
      architecture-revert note above, it's all one file/hook now)
    - `services/IssueCache.test.ts` - 14 tests
    - `services/OfflineQueue.test.ts` - 14 tests
    - `hooks/useOffline.test.ts` - 9 tests
    - `services/ConflictResolver.test.ts` - 12 tests
    - `components/ConflictDialog.test.tsx` - 5 tests
    - `components/OfflineBanner.test.tsx` - 6 tests
    - `components/ErrorBoundary.test.tsx` - 5 tests
    - `components/Toast.test.tsx` - 7 tests
- There is no `App.tsx` test harness in this repo. UI-wiring changes there are
  verified by `tsc --noEmit` + manual click-through, not automated tests.

#### Pull Requests
- PR #1: Architecture refactor (63 tests) -- hook/component split, later reverted (see above)
- PR #2: IndexedDB cache (17 tests)
- PR #3: Lazy versionViewData (9 tests) -- the commit that reverted PR #1's split
- PR #4: Optimistic UI (6 tests)
- PR #5: Offline support (27 tests) -- superseded by PR #7
- PR #6: Conflict resolution (20 tests) -- superseded by PR #7
- PR #7: Audit fixes - type safety and code organization
- PR #8: Fix assignee/version optimistic-update blank-name gap
- PR #9: Fix "All Projects" view always showing zero issues
- PR #10: Tray menu: top assigned issues (later replaced by #11)
- PR #11: Collapse status groups by default on load; tray menu: status counts instead of a per-issue list
- PR #12: Fix tray status-count click leaving an invisible, unclearable filter
- PR #13: Fix tray icon urgency colors (were invisible due to `setTemplateImage`)
- PR #14: Wire up `useKeyboardShortcuts` (was built, never connected to `App.tsx`)
- PR #15: Add accessibility (role/aria-modal/focus-trap/Escape) to `ConflictDialog`
- PR #16: Wire `OfflineQueue` exponential backoff into the retry loop
- PR #17: Fix optimistic-update rollback/success clobbering a concurrent edit's field
- PR #18: Remove unused `IssueCache` functions (8 with zero callers)
- PR #19: Scope the IndexedDB issue cache per Redmine server

## Key Technical Details (For Agent Reference)

### 1. Indicator Sync Logic
Due to window resizing and text wrapping causing instant element height jumps, the indicator update uses a multi-frame sync strategy:
```typescript
const sync = () => {
    update(); // Calculate element position and setStyle
    if (count < 15) { // Continuous sync for 15 frames to ensure stability
        count++;
        rafId = requestAnimationFrame(sync);
    }
};
```

### 2. State Management (ViewModel)
All business logic is encapsulated in `src/renderer/hooks/useAppViewModel.ts`. UI accesses data and methods via `vm`.
- Key State: `selectedProjectId`, `selectedVersionId`, `groupedIssues` (with caching).

### 3. Transparency Mode Control
Transparency mode depends on `localStorage.getItem('enableTransparency')` and `isMac` environment.
CSS Class Control: `.transparency-enabled` (effective only in Dark Mode).

### 4. Auto-Update Architecture
- **Main Process Module**: `src/main/updater.ts` - Handles GitHub Release check, download, install.
- **Preload Bridge**: `src/main/preload.ts` - Exposes `window.updater` API.
- **Renderer UI**: `src/renderer/components/UpdaterModal.tsx` - Update interface component.
- **Config**: `package.json` build.publish configured with GitHub provider.

## TODO / Future Optimizations
- [ ] Add more custom filter conditions.
- [ ] Explore Windows Acrylic/Mica effects (similar to macOS blur effects).
- [ ] Keyboard j/k navigation (`useKeyboardShortcuts`, wired in PR #14) can select an
      issue inside a collapsed status group -- collapse state lives in `App.tsx`'s
      `IssueListContent` and isn't synced with keyboard nav, so the list may not
      visibly scroll to it (the detail pane still updates correctly).
- [ ] Consider getting an Apple Developer certificate for real macOS code signing.
      The app is currently unsigned (`identity: null` in `package.json`'s build
      config), so every fresh download triggers Gatekeeper's "app is damaged"
      dialog; the workaround is `xattr -cr` on the downloaded `.app`.