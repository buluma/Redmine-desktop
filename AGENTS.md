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