# Limax Package Manager Research and Architecture Plan

Date: 2026-06-04

This document turns package-manager research and a local Shellex architecture audit into a practical Limax roadmap. It is intentionally biased toward changes that make Limax easy, fast, inspectable and safe inside a vault-first browser OS.

## Executive Summary

Limax should not copy any single existing package manager. The winning design for Shellex is a hybrid:

- Pacman-style speed and simple package format.
- DNF-style transaction history and explainable operations.
- Nix/Guix-style rollback thinking, adapted to Shellex vault snapshots instead of a global immutable store.
- BSD ports/pkg separation: source/catalog metadata is separate from installable binary package artifacts.
- Homebrew-style discoverability and developer-friendly publishing, without hidden global side effects.
- Flatpak/Snap-style app permissions, channels and trust prompts, but controlled by the encrypted vault and Kernella boundary.

The most important architectural move is to split Limax into four layers:

1. Catalog layer: find apps, channels and versions.
2. Package layer: fetch exact `.sapp` artifacts by URL plus hash.
3. Trust layer: verify hash/signature/provenance before install.
4. Transaction layer: plan, preview, apply, record and undo vault changes.

## Research Comparison

| System | What users like | What users complain about | Lesson for Limax |
| --- | --- | --- | --- |
| APT / dpkg | Mature ecosystem, reliable dependency resolution, familiar commands on Debian/Ubuntu. | Split mental model across `apt`, `apt-get`, `dpkg`, `aptitude`; rollback story is weak compared with transactional systems. | Keep one coherent CLI and record every install/update as a reversible transaction. |
| DNF | Dependency solving, transaction history, undo/redo vocabulary, system-wide update flow. | Metadata refresh and historical speed complaints; DNF4/DNF5 history compatibility concerns. | Make metadata refresh visible and cached; keep transaction history schema stable. |
| Pacman | Fast, simple binary packages, transparent official/user-built package flow. | Short flag syntax is powerful but unfriendly to new users; speed alone does not equal safety. | Optimize for fast repo checks, but keep commands readable: `install`, `search`, `plan`, `undo`. |
| FreeBSD pkg + Ports | Clear binary package vs source ports split; packages and ports understand dependencies. | Source builds need separate tooling; users must choose the right lane. | Keep `.sapp` as the install artifact and repo/catalog metadata as the source lane. |
| OpenBSD pkg tools | Strong preference for binary packages as the output of ports work; simple package tools. | Less feature-rich than Linux package managers; package availability varies by architecture/license. | Prefer installable packages over arbitrary source execution. Be honest when browser-only Limax cannot fetch private packages. |
| pkgsrc | Portable package framework across Unix-like systems with binary or source paths. | Portability adds complexity and depends on active platform maintenance. | Keep package metadata portable and boring: JSON, hashes, runtime tags, capabilities. |
| Nix / Guix | Reproducibility, immutable store concepts, per-user profiles, atomic upgrades and rollback. | Steep learning curve, storage overhead, language/config complexity. | Use the rollback idea, not the complexity: vault snapshot before mutation, transaction log after mutation. |
| Homebrew / MacPorts | Homebrew wins on popularity, discovery and convenience; MacPorts wins praise for technical isolation and `/opt/local` discipline. | Homebrew has recurring complaints around update slowness, downgrade/hermetic difficulty and path/global-state surprises. | Make publishing easy, but installs must be explicit, vault-local and provenance-recorded. |
| Flatpak / Snap | App sandboxing, permission surfaces, channels/tracks and app-focused distribution. | Permission UX can be confusing; automatic updates need user control. | Add channels and permission diffs, but always show the install/update plan before changing the vault. |

## User Pain Points to Design Against

- Slow or opaque metadata refresh.
- Cryptic command flags.
- Package source ambiguity.
- Weak rollback/undo.
- Same-version package changes without clear trust warnings.
- Fragmented package formats and duplicated commands.
- Private repository failures that look like generic network errors.
- Updates that do too much without a clear plan.
- App permissions that are only visible after something goes wrong.

## Local Shellex Architecture Audit

Inspected neighboring repository: `shellex-os`.

Current strengths:

- Vault-first model: installed packages live inside the encrypted `.shellex-vault`.
- Clear core/app boundary: Shellex core owns boot, installer, updater and app registry; app packages live in their own repositories.
- Limax repo records live at `/system/limax/repos.json`.
- Limax lock records live at `/system/limax/lock.json`.
- Package lock records include source type, repo name, repo URL, package URL and SHA-256.
- The updater already detects same-version hash changes and avoids auto-applying them.
- The Limax window already separates Installed, Sources and Updates, with logs.
- `npm run check` in `shellex-os` passes with `tsc --noEmit`.

Current architectural gaps:

- Package validation is still minimal: id/name/entry/runtime checks exist, but package file paths, version syntax, permission syntax, manifest shape and size limits need stricter validation.
- Repo checks are sequential, so many repos make Limax feel slower than necessary.
- No first-class `limax search` command or indexed catalog view.
- No explicit install/update plan object shown before repo installs.
- No transaction history command such as `limax history` or `limax undo`.
- No signed package support yet; SHA-256 lock records are provenance, not publisher identity.
- No channels/tracks such as stable, beta or pinned.
- Browser-only private repo failures are handled, but they should become actionable diagnostics.
- Dependency metadata is not modeled yet.

## Target Architecture

```txt
repos.json / registry index
  -> catalog resolver
  -> package fetcher
  -> package validator
  -> trust verifier
  -> transaction planner
  -> vault snapshot
  -> package install/update/remove
  -> app registry sync
  -> lockfile + transaction log
```

### Catalog Layer

Add a registry/index format that can list apps without fetching every app package:

```json
{
  "schema": "shellex-limax-index-v1",
  "updatedAt": "2026-06-04T00:00:00.000Z",
  "repos": [
    {
      "name": "Limax",
      "appId": "system.limax.local",
      "url": "https://github.com/elmirok/shellex-limax",
      "channel": "stable",
      "version": "1.0.2",
      "packageUrl": "https://raw.githubusercontent.com/elmirok/shellex-limax/refs/heads/main/package.sapp.json",
      "sha256": "..."
    }
  ]
}
```

This gives Limax instant search and update summaries, while still verifying the exact fetched package before install.

### Package Layer

Keep `.sapp` JSON as the current package artifact, but define it more strictly:

- `manifest` is canonical metadata.
- `files` is a map of relative package paths to UTF-8 text payloads.
- Entry file must exist in `files`.
- Paths must be relative, normalized and cannot contain `..`.
- Package size and file count limits should be enforced before install.
- Runtime-specific required files should be validated.

### Trust Layer

Trust should be visible as a state, not hidden in implementation:

- `recorded`: first install or no expected hash.
- `verified`: hash matches an expected hash from the repo/index.
- `changed`: same version, different hash than installed lock record.
- `signed`: future package signature verified against a trusted publisher key.
- `blocked`: trust policy refused install/update.

Limax should never auto-apply `changed` or `blocked` packages.

### Transaction Layer

Every package operation should produce a plan:

```json
{
  "operation": "update",
  "appId": "system.limax.local",
  "fromVersion": "1.0.2",
  "toVersion": "1.0.3",
  "sourceRepoUrl": "https://github.com/elmirok/shellex-limax",
  "packageSha256": "...",
  "permissionDiff": {
    "added": [],
    "removed": []
  },
  "filesChanged": 2,
  "trustStatus": "verified"
}
```

Before mutating the vault, Limax should create a vault snapshot and then write a transaction record:

```txt
/system/limax/transactions.json
```

Commands:

```txt
limax plan <app>
limax install <app>
limax update
limax update -all
limax history
limax undo <transaction-id>
limax doctor
```

`undo` should restore the snapshot associated with the transaction when available.

## Phased Refactor Plan

### Phase 1: Package Repo Foundation

Status: in progress in this repository.

- Generate `package.sapp.json` from source files.
- Validate package consistency with `npm test`.
- Keep package contents explicit in `package.files.json`.
- Ship this research/architecture plan with the Limax package.

### Phase 2: Core Validator Upgrade

Target repo: `shellex-os`.

- Extract package validation into a focused module.
- Enforce safe paths, file count, package size, manifest id/version format and permission format.
- Add unit-like validation fixtures or TypeScript checks if the project adds a test runner.
- Make validation errors readable from Shell and Limax UI.

### Phase 3: Fast Catalog and Search

Target repo: `shellex-os` plus `shellex-repos`.

- Status: started with offline `limax search [query]` over known repo records and installed apps.
- Add `limax search [query]`.
- Add cached registry/index reads.
- Parallelize package checks with a small concurrency limit.
- Display installable packages without fetching every full `.sapp`.

### Phase 4: Plans, History and Undo

Target repo: `shellex-os`.

- Status: started with `/system/limax/transactions.json`, `limax history` and pre-operation rollback snapshot ids.
- Add plan generation before install/update/remove.
- Add `/system/limax/transactions.json`.
- Create a vault snapshot before applying package transactions.
- Add `limax history` and `limax undo <id>`.

### Phase 5: Trust Policy

Target repo: `shellex-os` plus app repos.

- Add optional publisher keys to registry metadata.
- Add package signatures or signed index records.
- Add trust policy settings in `/system/limax/policy.json`.
- Block changed same-version packages unless explicitly trusted.

### Phase 6: Developer Experience

Target repos: app package repos and Shellex DevHub.

- Standardize `npm run build`, `npm run check`, `npm test` for every Shellex app package repo.
- Add package diagnostics: `limax doctor`.
- Add publish checklist and package lint output in DevHub.

## Immediate Next Code Targets

The highest-leverage Shellex core changes are:

1. Harden `validateAppPackage`.
2. Add a transaction plan type and return it from repo install/update paths.
3. Add `limax search`.
4. Parallelize update checks with controlled concurrency.
5. Add `limax history` backed by `/system/limax/transactions.json`.

These changes preserve the existing Shellex boundary while moving Limax toward a serious package manager architecture.

## Sources

- Debian package management: https://wiki.debian.org/PackageManagement
- Debian Reference, package management: https://www.debian.org/doc/manuals/debian-reference/ch02
- Fedora DNF documentation: https://docs.fedoraproject.org/
- Arch pacman documentation: https://wiki.archlinux.org/title/pacman
- FreeBSD packages and ports: https://docs.freebsd.org/en/books/handbook/ports/
- OpenBSD package management FAQ: https://www.openbsd.org/faq/faq15.html
- pkgsrc guide: https://www.netbsd.org/docs/pkgsrc/pkgsrc.html
- Homebrew manual: https://docs.brew.sh/Manpage
- Nix profiles and generations: https://nix.dev/manual/nix/latest/package-management/profiles.html
- GNU Guix package description: https://packages.guix.gnu.org/packages/guix/
- Flatpak sandbox permissions: https://docs.flatpak.org/en/latest/sandbox-permissions.html
- Snap channels and refresh behavior: https://snapcraft.io/docs/channels
- Reddit user discussion, Linux package-manager preferences: https://www.reddit.com/r/linuxquestions/comments/1oaqvgt/whats_your_favorite_package_manager_and_why/
- Reddit user discussion, Homebrew vs MacPorts: https://www.reddit.com/r/MacOS/comments/1ohbh2n/homebrew_or_macports/
- Reddit user discussion, modern Nix pain points: https://www.reddit.com/r/NixOS/comments/1o31ym1/what_would_a_new_modern_nix_look_like_technically/
