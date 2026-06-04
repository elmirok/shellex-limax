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

2026-06-04 implementation update: Shellex OS now has the first transaction-safe rollback path. `limax undo [latest|transaction-id]` restores the rollback snapshot recorded for a package transaction, rebuilds the live installed-app registry from `/apps/*.sapp.json`, prunes stale app windows and records a new undo transaction. Limax also has an initial signed trust path: registry indexes and package records can carry ECDSA-P256-SHA256 signature metadata, package plans can report `signed`, lock/transaction records preserve publisher key identity, signed registry sync pins publisher keys in `/system/limax/trust-pins.json`, and policy can require signed packages or pinned publisher keys. Repo records now support `channel`, `pinnedVersion` and `pinnedSha256`, with `limax pin` for vault-local channel/version/hash holds.

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

Current-source notes:

- Debian APT's security model centers on signed repository release metadata and hash chains from repository metadata to packages. Limax now starts that direction with optional signed registry indexes, optional signed package metadata, and SHA-256 provenance for every installed package.
- DNF exposes transaction history, `history undo` and `history rollback`. Limax should make undo a first-class command rather than a manual snapshot restore.
- Nix generations make rollback simple, but users complain about learning curve and storage complexity. Limax should copy the rollback ergonomics, not the language/store complexity.
- Arch/pacman shows that speed and simplicity matter, but package signing and keyring UX must be visible enough for humans to recover from trust failures.
- FreeBSD/OpenBSD separate binary packages from ports/source builds. Limax should keep `.sapp` as the install artifact and avoid running arbitrary source builds in the vault.
- Homebrew wins discoverability and publishing friendliness; MacPorts gets technical praise for isolation and controlled dependency trees. Limax should be easy like Homebrew but vault-local and isolated like MacPorts.
- Community review themes across Reddit/Fedora/Mac/package-manager threads: people love rollback, speed, simple names and discoverability; they complain about opaque trust errors, slow metadata refresh, OS upgrade breakage and global path conflicts.

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
- Package validation now lives in a focused `src/limax/package-validator.ts` module and enforces manifest shape, id/version patterns, permission syntax, safe file paths and package size limits.
- Package planning now lives in a focused `src/limax/package-plan.ts` module and powers read-only `limax plan <repo-or-app-name>` previews.
- Repo install and update apply paths now consume the same focused plan object that `limax plan` previews.
- Remove planning is available through `limax plan remove <app-id>`, and uninstall applies the same focused remove plan object.
- Package diagnostics now live in `src/limax/doctor.ts` and are exposed through `limax doctor` with repair suggestions and `--json` output.
- Package policy now lives at `/system/limax/policy.json` and is exposed through `limax policy`; it blocks same-version hash changes and downgrades by default, and warns on permission expansion or host-runtime repo packages.
- Package and registry signature verification now live in `src/limax/trust.ts`; registry records can provide `publisherKeyId`, `publisherPublicKeyJwk`, `signatureAlgorithm`, `registrySignature` and per-package `packageSignature`.
- Lock, transaction, update and plan outputs now preserve publisher key identity when signed package metadata is present, and `limax trust` reports publisher keys pinned from signed registry syncs.
- Repo channel and pin metadata now flows through registry sync, search, plan, update checks, lock records, transactions and `/system/apps/registry.json`.
- `limax pin` lets vault owners set channel, version and SHA-256 pins locally; `limax update -all` reports pinned packages and does not apply them.
- Repo update checks use controlled concurrency.
- Shell exposes `limax search`, `limax plan`, `limax history` and `limax undo`.
- `npm test` in `shellex-os` now guards Limax architecture invariants.

Current architectural gaps:

- Signed registry and signed package support have initial verifiers and policy hooks, but no publisher key management UI or explicit trusted-key onboarding flow yet.
- Channels and pins exist as repo metadata and vault-local holds; richer channel UX and signed channel tooling are still needed.
- Browser-only private repo failures are handled, but they should become more actionable in update/install output.
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
- `signed`: package signature verified against publisher key metadata from the repository record.
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
limax trust
```

`undo` restores the snapshot associated with the transaction when available and then reconciles live runtime state from the restored vault files.

## Phased Refactor Plan

### Phase 1: Package Repo Foundation

Status: in progress in this repository.

- Generate `package.sapp.json` from source files.
- Validate package consistency with `npm test`.
- Keep package contents explicit in `package.files.json`.
- Ship this research/architecture plan with the Limax package.

### Phase 2: Core Validator Upgrade

Target repo: `shellex-os`.

Status: complete for the current validator scope in Shellex OS.

- Safe paths, file count, package size, manifest id/version format and permission format are enforced.
- Validation errors are surfaced through Shell/Limax install paths.
- Validation lives in `src/limax/package-validator.ts`, guarded by the Limax architecture test and TypeScript.
- Remaining work: add direct behavior fixtures for accepted/rejected packages once Shellex OS has a richer test runner.

### Phase 3: Fast Catalog and Search

Target repo: `shellex-os` plus `shellex-repos`.

- Status: started with offline `limax search [query]` over known repo records and installed apps, plus concurrent repo update checks.
- Add `limax search [query]`.
- Add cached registry/index reads.
- Parallelize package checks with a small concurrency limit.
- Display installable packages without fetching every full `.sapp`.

### Phase 4: Plans, History and Undo

Target repo: `shellex-os`.

- Status: started with `src/limax/package-plan.ts`, `limax plan`, `/system/limax/transactions.json`, `limax history`, `limax undo` and pre-operation rollback snapshot ids.
- Repo install/update apply paths consume the same plan object shown by `limax plan`.
- Remove planning also shows file, permission and rollback impact before uninstall.
- Keep improving undo with richer transaction previews and policy-aware permission diffs.

### Phase 5: Trust Policy

Target repo: `shellex-os` plus app repos.

- Status: started with `/system/limax/policy.json`, `limax policy`, `limax trust`, apply-time policy checks, optional signed package metadata, signed registry indexes, publisher trust pins, `requireSignedRepoPackages` and `requireTrustedPublisherKeys`.
- Status: channel/version/hash pins are started with repo metadata, `limax pin`, update holds, and apply-time pin enforcement through policy.
- Add publisher key onboarding and trust-pin review/rotation UI.
- Add signed index tooling so app repos can generate registry signatures consistently.
- Add explicit user overrides for blocked policy decisions.
- Block changed same-version packages unless explicitly trusted.

### Phase 6: Developer Experience

Target repos: app package repos and Shellex DevHub.

- Standardize `npm run build`, `npm run check`, `npm test` for every Shellex app package repo.
- Expand package diagnostics with future automated repair actions after user confirmation.
- Add publish checklist and package lint output in DevHub.

## Immediate Next Code Targets

The highest-leverage Shellex core changes are:

1. Add publisher key onboarding, trust-pin review and rotation UI.
2. Add signed index generation tooling for app repos.
3. Add confirmed repair actions for selected `limax doctor` findings.
4. Add direct behavior fixtures for validator, planner and trust modules.
5. Add policy-aware permission prompts for high-risk package changes.

These changes preserve the existing Shellex boundary while moving Limax toward a serious package manager architecture.

## Sources

- Debian package management: https://wiki.debian.org/PackageManagement
- Debian SecureApt: https://wiki.debian.org/SecureApt
- Debian Reference, package management: https://www.debian.org/doc/manuals/debian-reference/ch02
- DNF command reference: https://dnf.readthedocs.io/en/stable/command_ref.html
- Arch pacman documentation: https://wiki.archlinux.org/title/pacman
- Arch pacman package signing: https://wiki.archlinux.org/title/Pacman/Package_signing
- FreeBSD packages and ports: https://docs.freebsd.org/en/books/handbook/ports/
- OpenBSD package management FAQ: https://www.openbsd.org/faq/faq15.html
- pkgsrc guide: https://www.netbsd.org/docs/pkgsrc/pkgsrc.html
- Homebrew manual: https://docs.brew.sh/Manpage
- Homebrew taps: https://docs.brew.sh/Taps
- Homebrew bottles: https://docs.brew.sh/Bottles
- MacPorts guide: https://guide.macports.org/
- Nix profiles and generations: https://nix.dev/manual/nix/latest/package-management/profiles.html
- Nix rollback: https://nix.dev/manual/nix/2.30/command-ref/nix-env/rollback.html
- Community review sample, Homebrew vs MacPorts: https://www.reddit.com/r/MacOS/comments/17e85da/homebrew_vs_macports/
- Community review sample, DNF undo/rollback reliability: https://www.reddit.com/r/Fedora/comments/bruaob/how_much_reliable_are_dnf_commands_like_history/
- GNU Guix package description: https://packages.guix.gnu.org/packages/guix/
- Flatpak sandbox permissions: https://docs.flatpak.org/en/latest/sandbox-permissions.html
- Snap channels and refresh behavior: https://snapcraft.io/docs/channels
- Reddit user discussion, Linux package-manager preferences: https://www.reddit.com/r/linuxquestions/comments/1oaqvgt/whats_your_favorite_package_manager_and_why/
- Reddit user discussion, Homebrew vs MacPorts: https://www.reddit.com/r/MacOS/comments/1ohbh2n/homebrew_or_macports/
- Reddit user discussion, modern Nix pain points: https://www.reddit.com/r/NixOS/comments/1o31ym1/what_would_a_new_modern_nix_look_like_technically/
