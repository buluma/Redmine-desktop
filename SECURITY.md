# Security Policy

## Supported Versions

Only the latest released version is supported with security fixes. Please
update to the newest release before reporting an issue.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report it privately via [GitHub Security Advisories](https://github.com/buluma/Redmine-desktop/security/advisories/new)
for this repository. Include:

- A description of the vulnerability and its impact
- Steps to reproduce
- Affected version(s)

You should receive an initial response within a few days. Once a fix is
available, a new release will be published and the advisory disclosed.

## Known Limitations

- Release builds are currently **unsigned** on both macOS and Windows (no
  Apple Developer ID / Windows code-signing certificate yet). This means the
  OS will show an "unidentified developer" / SmartScreen warning on install.
  Verify downloads come from the official
  [GitHub Releases page](https://github.com/buluma/Redmine-desktop/releases)
  before bypassing that warning.
- The Redmine API key is stored using Electron's `safeStorage` (OS keychain)
  where available; on platforms without OS-level encryption support it falls
  back to local storage.
