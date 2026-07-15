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

#### Architecture Refactoring
- **ViewModel Split**: Decomposed monolithic `useAppViewModel.ts` (~1340 lines) into focused hooks:
    - `useSettings.ts` - Theme, server settings
    - `useProjects.ts` - Project/version selection
    - `useIssues.ts` - Issue state, optimistic updates, offline queue
    - `useSearch.ts` - Remote search functionality
    - `useFilteredIssues.ts` - Filtering, grouping, sorting
- **Component Split**: Broke `App.tsx` into focused components:
    - `TabbedIssueList.tsx` - Issue list with tabs
    - `IssueListContent.tsx` - Filtered/grouped issue display
    - `NoteEditor.tsx` - Issue note creation
    - `RemoteSearchResults.tsx` - Search results
- **Component Extraction**: Created reusable components:
    - `ErrorBoundary.tsx` - React error boundary with Toast notifications
    - `Toast.tsx` - Notification system
    - `IssueItem.tsx` - Individual issue display
- **Custom Hooks**:
    - `useKeyboardShortcuts.ts` - Keyboard navigation (14 tests)
    - `useSettings.ts` - Settings persistence with safeStorage
- **Constants**: Extracted status constants into `constants/status.ts` with helper functions

#### Performance Optimizations
- **IndexedDB Cache**: Implemented Dexie.js-based caching for issues
    - Auto-migration from localStorage
    - Cache invalidation on updates
    - 17 tests for cache operations
- **Lazy versionViewData**: Replaced eager computation with on-demand loading
    - Computes only when tab/view changes
    - Caches results by key
- **Virtualization**: Added `content-visibility: auto` for long lists

#### Offline Support
- **OfflineQueue.ts**: IndexedDB-backed mutation queue with:
    - Exponential backoff retry (1s → 2s → 4s → 8s, max 30s)
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
    - 12 tests for dialog behavior
- **Integration**: Conflicts detected during queue processing

#### Security Improvements
- **Safe Storage**: API key encryption using Electron's `safeStorage`
- **Scoped Certificate Bypass**: Removed global `ignore-certificate-errors`
- **Type Safety**: Replaced `any` types with proper interfaces
    - `MutationBody`, `UpdateIssueBody`, `CreateIssueBody`
    - Proper error handling with `catch (e: unknown)`

#### Testing
- **Vitest Setup**: Configured Vitest with jsdom
- **Test Files**: 10 test suites, 108 tests total
    - `status.test.ts` - 29 tests
    - `useKeyboardShortcuts.test.ts` - 14 tests
    - `useSettings.test.ts` - 6 tests
    - `useFilteredIssues.test.ts` - 9 tests
    - `useIssues.test.ts` - 9 tests
    - `IssueCache.test.ts` - 17 tests
    - `OfflineQueue.test.ts` - 14 tests
    - `useOffline.test.ts` - 7 tests
    - `ConflictResolver.test.ts` - 12 tests
    - `ConflictDialog.test.tsx` - 12 tests
    - `OfflineBanner.test.tsx` - 6 tests
    - `ErrorBoundary.test.tsx` - 5 tests

#### Pull Requests
- PR #1: Architecture refactor (63 tests)
- PR #2: IndexedDB cache (17 tests)
- PR #3: Lazy versionViewData (9 tests)
- PR #4: Optimistic UI (6 tests)
- PR #5: Offline support (27 tests)
- PR #6: Conflict resolution (20 tests)
- PR #7: Audit fixes - type safety and code organization

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
- [ ] Optimize offline storage mechanism.
- [ ] Explore Windows Acrylic/Mica effects (similar to macOS blur effects).