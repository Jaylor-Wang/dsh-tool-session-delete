# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.1.0 — 2026-10-24

- Renamed and rebranded plugin as `dsh-tool-session-delete`.
- Updated plugin identifiers, bundle patch configurations, and metadata.

### Added

- Two screenshots in `docs/`, embedded in the README: the sidebar's per-session
  `…` menu with the **删除会话** row below Archive, and the confirmation dialog
  (永久删除会话？ / 会话日志约 41 KB。 / 取消 · 永久删除).
- `screenshots.json` listing the two images, for the app storefronts that read
  it. The registry probe accepts a plain path array, so the file is one.
- `screenshots.json` and `docs/*.png` added to `files[]`, so a future tarball
  actually carries them. npm skips a listed file that does not exist, silently.

### Changed

- The README gained a **Localization** section. The screenshots are in
  Simplified Chinese while the README is in English, which reads as an
  inconsistency unless it is explained: the plugin ships `zh` (Simplified) and
  `en` and follows the app's language setting; Traditional Chinese is owned by
  the separate [`dsh-zh-hant`](https://github.com/wilsonchengassistant/dsh-zh-hant)
  language pack, and without it the dialog is expected to read in Simplified.

The screenshots were captured from a scratch DSH profile with a throwaway
session, so no real conversation is in frame, and in the Simplified Chinese UI
the plugin ships by default. The session title was shortened through
`session/rename` so it renders without truncation.

## 1.0.1 — 2026-10-19

- Tracked `1.0.1` in `package.json` to match npm's `latest` tag. The version
  had been published as `1.0.1`; the repository still said `1.0.0`.

## 1.0.0 — 2026-10-19

First public release, published as `dsh-tool-session-delete`.

- Adds one row to the per-session `…` menu in the left sidebar, ordered after
  Pin / Rename / Fork / Archive.
- A confirmation dialog that reports whether the session is still open on this
  machine, the log size about to be removed, and the running turns, subagents,
  background jobs and reminders bound to the session.
- Deleting releases the id from every registry that would otherwise keep
  listing it — the Host's session corpus is `persistence ∪ live`, so removing
  the log alone lets the row come back.
- The postcondition is checked against the disk: a successful `rm` is not
  treated as proof, and `removeLog()` stats the path afterwards.
- English and Simplified Chinese dictionaries with identical key sets.
- Zero runtime dependencies; one Host module and one browser bundle.
