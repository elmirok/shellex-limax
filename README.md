# Limax

Limax is the Shellex OS package manager app and command.

Current MVP: local `.sapp` install, repository registry sync, remote app install from configured repos, installed package listing, package info, package removal, source repository records and repo update checks.

Version 1.0.2 improves the Limax window layout in Shellex OS with separate Installed, Sources and Updates tabs plus a toggleable update log panel.

Useful commands:

```txt
limax repo sync
limax repos
limax install W3
limax update
limax update -all
```

Run `limax help` in Shell for usage.

## Shellex package

- App id: `system.limax.local`
- Version: `1.0.2`
- Runtime: `host`
- Type: `system-app`
