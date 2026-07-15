# Changelog

All notable changes to this project are documented here, generated from
[GitHub Releases](https://github.com/buluma/Redmine-desktop/releases).

## v2.4.0 (2026-07-15)

## Changes

- chore: bump version to 2.4.0 (72e5953)
- Merge pull request #27 from buluma/feat/adjustable-transparency (b51a5dc)
- feat: replace transparency toggle with an adjustable slider (2544e00)

---
**Full Changelog**: [v2.3.0...v2.4.0](https://github.com/buluma/Redmine-desktop/compare/v2.3.0...v2.4.0)


## v2.3.0 (2026-07-15)

## Changes

- chore: bump version to 2.3.0 (892fdae)
- Merge pull request #26 from buluma/chore/ui-polish-pass (fd80759)
- chore: UI polish pass — a11y, focus states, token consistency, icon cleanup (8f79234)

---
**Full Changelog**: [v2.2.1...v2.3.0](https://github.com/buluma/Redmine-desktop/compare/v2.2.1...v2.3.0)


## v2.2.1 (2026-07-15)

## Changes

- chore: bump version to 2.2.1 (e072dba)
- Merge pull request #25 from buluma/fix/tray-icon-visibility (595f9a7)
- fix: replace illegible tray icon with a legible bold badge (86db230)
- Merge pull request #24 from buluma/feat/cleanup-stale-server-caches (9289428)
- fix: clean up orphaned per-server IndexedDB caches (e219d3f)
- Merge pull request #23 from buluma/chore/gate-console-log-dev-only (2eb686b)
- chore: gate console.log noise behind a dev-only logger (41ef32f)
- Merge pull request #22 from buluma/refactor/inline-field-select-component (a66ccf5)
- refactor: extract InlineFieldSelect for priority/version/assignee dropdowns (6aa6ede)
- Merge pull request #21 from buluma/fix/version-issue-cap-warning (50e352a)
- fix: warn when a version's issues are silently truncated at 500 (dc18989)

---
**Full Changelog**: [v2.2.0...v2.2.1](https://github.com/buluma/Redmine-desktop/compare/v2.2.0...v2.2.1)


## v2.2.0 (2026-07-15)

## Changes

- chore: bump version to 2.2.0 (59c0a02)
- Merge pull request #20 from buluma/docs/update-agents-md (6a6a45f)
- docs: fix stale architecture claims in AGENTS.md, add PRs #8-19 (fc68dbd)
- Merge pull request #19 from buluma/feat/scope-issuecache-per-server (b7a22a7)
- feat: scope IndexedDB issue cache per Redmine server (fbb3ec8)
- Merge pull request #18 from buluma/chore/remove-unused-issuecache-functions (80f18a9)
- chore: remove unused IssueCache functions (95a0134)
- Merge pull request #17 from buluma/fix/optimistic-update-rollback-race (fedbbfa)
- fix: optimistic-update rollback/success no longer clobbers concurrent edits (0b820a1)
- Merge pull request #16 from buluma/feat/offline-retry-backoff (aad5ce0)
- feat: pace offline queue retries with exponential backoff (ce9f515)
- Merge pull request #15 from buluma/feat/conflict-dialog-a11y (c092e75)
- feat: add accessibility to ConflictDialog (75fec76)
- Merge pull request #14 from buluma/feat/wire-keyboard-shortcuts (65be3cb)
- feat: wire up keyboard shortcuts (was fully built, never connected) (b0adcf3)

---
**Full Changelog**: [v2.1.5...v2.2.0](https://github.com/buluma/Redmine-desktop/compare/v2.1.5...v2.2.0)


## v2.1.5 (2026-07-15)

## Changes

- chore: bump version to 2.1.5 (3a06a3e)
- Merge pull request #13 from buluma/fix/tray-icon-color (09f17df)
- fix: tray icon urgency colors were invisible due to template-image mode (ea3876d)

---
**Full Changelog**: [v2.1.4...v2.1.5](https://github.com/buluma/Redmine-desktop/compare/v2.1.4...v2.1.5)


## v2.1.4 (2026-07-15)

## Changes

- chore: bump version to 2.1.4 (ff72f6d)
- Merge pull request #12 from buluma/fix/tray-status-no-filter-trap (371b932)
- fix: tray status click no longer traps you behind an invisible filter (74c3607)

---
**Full Changelog**: [v2.1.3...v2.1.4](https://github.com/buluma/Redmine-desktop/compare/v2.1.3...v2.1.4)


## v2.1.3 (2026-07-15)

## Changes

- chore: bump version to 2.1.3 (14cabe0)
- Merge pull request #11 from buluma/feat/collapsed-groups-tray-counters (5f8320e)
- feat: collapse status groups by default, replace tray issue list with status counts (2d767ea)

---
**Full Changelog**: [v2.1.2...v2.1.3](https://github.com/buluma/Redmine-desktop/compare/v2.1.2...v2.1.3)


## v2.1.2 (2026-07-15)

## Changes

- chore: bump version to 2.1.2 (f9720d7)
- Merge pull request #10 from buluma/feat/tray-top-issues (acbba79)
- feat: show top assigned issues in the tray menu (8add66a)

---
**Full Changelog**: [v2.1.1...v2.1.2](https://github.com/buluma/Redmine-desktop/compare/v2.1.1...v2.1.2)


## v2.1.1 (2026-07-15)

## Changes

- chore: bump version to 2.1.1 (b9251b1)
- Merge pull request #9 from buluma/fix/all-projects-empty (ab2332c)
- fix: All Projects view always showed zero issues (4c6fb3b)

---
**Full Changelog**: [v2.1.0...v2.1.1](https://github.com/buluma/Redmine-desktop/compare/v2.1.0...v2.1.1)


## v2.1.0 (2026-07-15)

## Changes

- fix: stop electron-builder from racing the release job on publish (7421b37)
- chore: bump version to 2.1.0 (ef55cb5)
- Merge pull request #8 from buluma/fix/optimistic-assignee-version (7c5358f)
- fix: look up real assignee/version names for optimistic issue updates (abf59bf)
- Merge pull request #7 from buluma/fix/audit-issues (af67d13)
- Merge remote-tracking branch 'origin/main' into fix/audit-issues (f21eed1)
- fix: restore secure key storage, IndexedDB cache, and optimistic updates on main (5067e86)
- Merge pull request #4 from buluma/feat/optimistic-ui (bfae5d4)
- Merge remote-tracking branch 'origin/main' into feat/optimistic-ui (c14e939)
- Merge pull request #3 from buluma/feat/lazy-version-view (29cce28)
- Merge pull request #2 from buluma/feat/indexeddb-cache (7e86c60)
- Merge pull request #1 from buluma/refactor/quick-wins-architecture (063f615)
- fix: wire offline queue to a real service and guard against duplicate syncs (7558a05)
- chore: remove unused useFilteredIssues hook and TabbedIssueList component (bfd6673)
- fix: invalidate version view cache when allIssues changes (63d1276)
- fix: guard localStorage migration steps independently and cache/network race (36ed73c)
- fix: optimistic status/priority update now shows real name, not stale one (2253f9d)
- fix: migrate legacy plaintext redmineAPIKey out of localStorage (3be9feb)
- docs: update audit report and development log (bff729e)
- fix: resolve audit issues - type safety and code organization (083eb9f)
- feat: integrate conflict resolution into offline sync (8c84387)
- feat: conflict detection and resolution (febca5a)
- feat: offline support with retry queue (b634b0b)
- feat: optimistic UI for status/priority changes (700160e)
- perf: lazy versionViewData computation (e0127f2)
- feat: migrate issue cache from localStorage to IndexedDB (4070dc5)
- refactor: split useAppViewModel into focused hooks (6ed0452)
- refactor: architecture improvements & quick wins (15f9bd9)
- Remove non-functional tray menu items (Quick Add, My Tasks) (bfea4dc)
- Improve tray icon with colored variants, right-click context menu, and urgency-aware badges (7aa1282)
- i18n: final UI string translations; fix TS error; status matching bilingual (a15808f)
- Translate all Chinese text to English (comments, UI strings, tooltips, placeholders) (17a6742)
- i18n: translate remaining Chinese UI strings to English (search, filters, quick add, issue detail, attachments) (39aacf4)
- chore: untrack ELECTRON_UPGRADE_PLAN.md (24337cd)
- i18n: translate remaining Chinese UI strings to English; fix vibrancy by removing transparent flag (Electron 33+) (5dd781d)
- chore: upgrade Electron to 43.1.0 (latest), Vite 6, electron-builder 26 - all high/critical vulns resolved (45fbf0d)
- chore: upgrade build toolchain - Electron 35 LTS, Vite 6, electron-builder 26, vite-plugin-electron 1.x (3cd7129)
- chore: upgrade to Electron 35 LTS, Vite 6, electron-builder 26, vite-plugin-electron 1.x (a207139)
- chore: upgrade Electron from 27 to 35.7.5 (LTS) (2d49350)

---
**Full Changelog**: [v2.0.1...v2.1.0](https://github.com/buluma/Redmine-desktop/compare/v2.0.1...v2.1.0)


## v2.0.1 (2026-07-13)

## Changes

- preset 2.0.1 (e5e2c3b)

---
**Full Changelog**: [v2.0.0...v2.0.1](https://github.com/buluma/Redmine-desktop/compare/v2.0.0...v2.0.1)


## v1.0.29 (2026-07-13)



## v2.0.0 (2026-07-13)

## Changes

- docs: translate release workflow and AGENTS.md to English (9074494)
- fix: links updated (9358b14)
- Merge branch 'main' of https://github.com/jheroy/Redmine-desktop (b0add40)
- feat: add copy id+title button and modernize icons (8736038)
- chore: bump version to 1.0.27 and fix infinite refresh loop (6d47224)
- feat: 添加远程搜索功能 (b83e196)

---
**Full Changelog**: [v1.0.29...v2.0.0](https://github.com/buluma/Redmine-desktop/compare/v1.0.29...v2.0.0)


