# Releasing

## Cutting a release

1. Bump `version` in `package.json`.
2. Commit and push to `main` (via PR — see branch protection below).
3. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. `.github/workflows/release.yml` builds macOS (arm64) and Windows
   (x64/ia32), then publishes a GitHub Release with auto-generated notes
   from the commit log since the previous tag.

## Code signing (not yet configured)

Release builds are currently unsigned on both platforms (`identity: null`,
`hardenedRuntime: false` in `package.json`'s `build` config, and
`CSC_IDENTITY_AUTO_DISCOVERY: false` in the release workflow). This means:

- macOS shows "unidentified developer" on first launch (worked around today
  with `xattr -cr` after install).
- Windows SmartScreen shows an "unrecognized app" warning.
- `electron-updater`'s auto-update flow works, but without code-signing
  there's no OS-level integrity guarantee beyond the sha512 checksums
  `electron-builder` embeds in `latest.yml`/`latest-mac.yml`.

To turn on signing:

**macOS** — requires an [Apple Developer Program](https://developer.apple.com/programs/)
membership ($99/yr):
1. Create a "Developer ID Application" certificate, export it as a
   password-protected `.p12`.
2. Add repo secrets: `CSC_LINK` (base64 of the `.p12`), `CSC_KEY_PASSWORD`,
   `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
3. Remove `"identity": null` from `package.json`'s `build.mac`, set
   `"hardenedRuntime": true`, and add a `"notarize": { "teamId": "..." }`
   block (electron-builder picks up notarization credentials from the env
   vars above automatically).
4. Remove `CSC_IDENTITY_AUTO_DISCOVERY: false` from the macOS build step in
   `release.yml` (or leave it — once `CSC_LINK` is set, electron-builder
   uses it explicitly rather than searching the keychain).

**Windows** — requires a code-signing certificate from a CA (e.g. a
standard OV cert, ~$100-300/yr, or an EV cert for instant SmartScreen
reputation):
1. Add repo secrets: `CSC_LINK` (base64 of the `.pfx`), `CSC_KEY_PASSWORD`.
2. No `package.json` changes needed — electron-builder signs automatically
   once those env vars are present in the Windows build step.

Don't flip these locally without testing — `CSC_IDENTITY_AUTO_DISCOVERY`
defaults to `true` outside CI, so removing `identity: null` on a dev
machine with *any* signing identity in the keychain will change what
`npm run build` produces.

## Branch protection

`main` requires the `CI / verify` check (`.github/workflows/ci.yml`) to
pass and changes to land via pull request. Repo admins can still push
directly in an emergency (`enforce_admins` is off), but the normal flow is
PR → CI green → merge.
