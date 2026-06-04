# Limax

Limax is the Shellex OS package manager app and command.

Current MVP: local `.sapp` install, repository registry sync, remote app install from configured repos, installed package listing, package info, package removal, source repository records, package SHA-256 trust records and repo update checks.

Version 1.0.5 aligns the package docs with `limax search` and `limax history` transaction records.

Research and next architecture targets live in `docs/package-manager-research.md`.

Useful commands:

```txt
limax repo sync
limax repos
limax search W3
limax install W3
limax lock
limax history
limax update
limax update -all
```

Run `limax help` in Shell for usage.

## Development

```txt
npm run build
npm run check
npm test
```

Release flow:

1. Update `manifest.json`.
2. Update this README.
3. Run `npm run build`.
4. Run `npm run check`.
5. Commit the generated `package.sapp.json` with the source changes.
6. Update `shellex-repos/repos.json` with the new package SHA-256.

## Shellex package

- App id: `system.limax.local`
- Version: `1.0.5`
- Runtime: `host`
- Type: `system-app`
